/*
 * SSR 主题反向代理中间件
 * 当 SSR 主题运行时，自动将前台请求代理到 Node.js 进程
 */
package middleware

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"

	frontend_runtime "github.com/anzhiyu-c/anheyu-app/internal/frontend"
	"github.com/anzhiyu-c/anheyu-app/pkg/ssr"
	"github.com/gin-gonic/gin"
)

// CurrentSSRThemeChecker 检查当前是否应该使用 SSR 主题的回调函数
// 返回 (themeName, shouldProxy)
// - themeName: 当前 SSR 主题名称（如果应该代理）
// - shouldProxy: 是否应该代理到 SSR
type CurrentSSRThemeChecker func() (themeName string, shouldProxy bool)

// ssrThemeChecker 全局的 SSR 主题检查器
var ssrThemeChecker CurrentSSRThemeChecker

// ssrThemeCheckCache caches the result of the SSR theme checker with a TTL
// to avoid hitting the database on every request.
type ssrThemeCheckCache struct {
	mu         sync.RWMutex
	themeName  string
	shouldProxy bool
	expiresAt   time.Time
}

var ssrCheckCache = &ssrThemeCheckCache{}

const ssrCheckCacheTTL = 5 * time.Second

func (c *ssrThemeCheckCache) get() (themeName string, shouldProxy bool, ok bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if time.Now().Before(c.expiresAt) {
		return c.themeName, c.shouldProxy, true
	}
	return "", false, false
}

func (c *ssrThemeCheckCache) set(themeName string, shouldProxy bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.themeName = themeName
	c.shouldProxy = shouldProxy
	c.expiresAt = time.Now().Add(ssrCheckCacheTTL)
}

// cachedSSRThemeCheck returns the cached SSR theme check result,
// falling back to the database-backed checker on cache miss.
func cachedSSRThemeCheck() (themeName string, shouldProxy bool) {
	if themeName, shouldProxy, ok := ssrCheckCache.get(); ok {
		return themeName, shouldProxy
	}
	themeName, shouldProxy = ssrThemeChecker()
	ssrCheckCache.set(themeName, shouldProxy)
	return
}

// SetSSRThemeChecker 设置 SSR 主题检查器
// 应在应用启动时调用，传入检查数据库状态的回调函数
func SetSSRThemeChecker(checker CurrentSSRThemeChecker) {
	ssrThemeChecker = checker
}

// ssrProxyState holds the reusable reverse proxy and tracks the current SSR target.
type ssrProxyState struct {
	mu        sync.RWMutex
	proxy     *httputil.ReverseProxy
	targetURL string // current "http://localhost:PORT"
}

// newSSRProxyState creates the proxy state with a nil proxy (lazy init on first use).
func newSSRProxyState() *ssrProxyState {
	return &ssrProxyState{}
}

// getProxy returns the shared reverse proxy for the given target URL.
// It reuses the existing proxy if the target hasn't changed; otherwise creates a new one.
func (ps *ssrProxyState) getProxy(targetURL string, themeName string, port int) *httputil.ReverseProxy {
	ps.mu.RLock()
	same := ps.targetURL == targetURL && ps.proxy != nil
	ps.mu.RUnlock()
	if same {
		return ps.proxy
	}

	ps.mu.Lock()
	defer ps.mu.Unlock()

	// Double-check after acquiring write lock
	if ps.targetURL == targetURL && ps.proxy != nil {
		return ps.proxy
	}

	target, err := url.Parse(targetURL)
	if err != nil {
		log.Printf("[SSR 代理] 解析目标 URL 失败: %v", err)
		return nil
	}

	ps.proxy = &httputil.ReverseProxy{
		Transport: frontend_runtime.SharedTransport,
		Director: func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host
			req.Header.Set("X-Forwarded-Host", req.Header.Get("X-Forwarded-Host"))
			req.Header.Set("X-Real-IP", req.Header.Get("X-Real-IP"))
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			log.Printf("[SSR 代理] 错误: %v (主题: %s, 端口: %d)", err, themeName, port)
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>SSR 主题暂时不可用</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #333; }
        p { color: #666; }
    </style>
</head>
<body>
    <h1>SSR 主题暂时不可用</h1>
    <p>主题 "%s" 正在启动中或遇到问题，请稍后重试。</p>
    <p><a href="/admin">前往后台管理</a></p>
</body>
</html>`, themeName)))
		},
	}

	ps.targetURL = targetURL
	return ps.proxy
}

// SSRProxyMiddleware 创建 SSR 主题反向代理中间件
// 当有 SSR 主题运行时，将前台请求（非 API、非后台）代理到 SSR 主题
func SSRProxyMiddleware(ssrManager *ssr.Manager) gin.HandlerFunc {
	// Create reusable proxy state once at middleware creation time
	proxyState := newSSRProxyState()

	return func(c *gin.Context) {
		// 如果没有 SSR 管理器，直接跳过
		if ssrManager == nil {
			c.Next()
			return
		}

		path := c.Request.URL.Path

		// 排除不需要代理的路径
		if shouldSkipSSRProxy(path) {
			c.Next()
			return
		}

		// 自定义前端模式优先级更高：检测到 static 目录时，跳过 SSR 代理。
		// 这样可以确保外部 static 自定义前端始终生效。
		if frontend_runtime.IsStaticModeActive() {
			c.Next()
			return
		}

		// 优先使用 checker 检查数据库状态（如果已设置），使用缓存避免每次请求查库
		var runningTheme *ssr.ThemeInfo
		if ssrThemeChecker != nil {
			themeName, shouldProxy := cachedSSRThemeCheck()
			if !shouldProxy {
				// 数据库说当前不应该使用 SSR 主题，直接跳过代理
				c.Next()
				return
			}
			// 数据库说应该使用 SSR 主题，检查进程是否在运行
			if ssrManager.IsRunning(themeName) {
				runningTheme = &ssr.ThemeInfo{
					Name:   themeName,
					Status: ssr.StatusRunning,
					Port:   ssrManager.GetPort(themeName),
				}
			}
		} else {
			// 向后兼容：仅检查进程状态
			runningTheme = ssrManager.GetRunningTheme()
		}

		if runningTheme == nil {
			c.Next()
			return
		}

		// 创建或复用反向代理
		targetURL := fmt.Sprintf("http://localhost:%d", runningTheme.Port)
		proxy := proxyState.getProxy(targetURL, runningTheme.Name, runningTheme.Port)
		if proxy == nil {
			c.Next()
			return
		}

		// Set per-request headers on the incoming request
		c.Request.Header.Set("X-Forwarded-Host", c.Request.Host)
		c.Request.Header.Set("X-Real-IP", c.ClientIP())

		// 代理请求
		proxy.ServeHTTP(c.Writer, c.Request)
		c.Abort()
	}
}

// shouldSkipSSRProxy 判断是否应该跳过 SSR 代理
// 以下路径始终由 Go 后端处理，不代理到 SSR 主题
func shouldSkipSSRProxy(path string) bool {
	// 精确匹配的路径
	exactPaths := []string{
		"/robots.txt",
		"/sitemap.xml",
		"/rss.xml",
		"/feed.xml",
		"/atom.xml",
	}

	for _, exact := range exactPaths {
		if path == exact {
			return true
		}
	}

	// 前缀匹配的路径
	// 注意：/static/ 和 /assets/ 不在此列表中，因为它们应该由当前激活的主题控制
	// 当使用 SSR 主题时，这些路径会被代理到 SSR 进程
	// 后台专用的静态资源使用 /admin-static/ 和 /admin-assets/ 路径
	skipPrefixes := []string{
		"/api/",          // API 接口
		"/admin",         // 后台管理页面
		"/login",         // 登录页面
		"/admin-static/", // 后台静态资源（专用路径，不受主题影响）
		"/admin-assets/", // 后台 Vue 资源（专用路径，不受主题影响）
		"/f/",            // 文件服务
		"/needcache/",    // 缓存服务
	}

	for _, prefix := range skipPrefixes {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}

	return false
}
