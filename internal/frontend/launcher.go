// Package frontend manages the built-in Next.js frontend process lifecycle.
// Two modes are supported:
//   - Built-in: Go starts a Node.js process automatically (single-container deployment)
//   - External: an environment variable points to an already running Next.js service
package frontend

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

const (
	DefaultPort         = 3000
	DefaultFrontendDir  = "./frontend"
	HealthCheckTimeout  = 60 * time.Second
	HealthCheckInterval = 2 * time.Second
)

type Launcher struct {
	frontendDir string
	port        int
	externalURL string
	// skipStaticProxy：true 时不代理 /static，由 Go 提供（自定义主题目录）；默认 false，即 /static 代理到 Next.js
	skipStaticProxy bool

	cmd  *exec.Cmd
	mu   sync.RWMutex
	done chan struct{}
}

type Config struct {
	FrontendDir string
	Port        int
	ExternalURL string
	// SkipStaticProxy：true 时不代理 /static，由 Go 提供主题目录（自定义前端在 /static 时设为 true）；默认 false，即 /static 代理到 Next.js
	SkipStaticProxy bool
}

func NewLauncher(cfg Config) *Launcher {
	if cfg.FrontendDir == "" {
		cfg.FrontendDir = DefaultFrontendDir
	}
	if cfg.Port == 0 {
		cfg.Port = DefaultPort
	}
	if cfg.ExternalURL != "" {
		if u, err := url.Parse(cfg.ExternalURL); err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			log.Printf("[Frontend] 警告: ANHEYU_FRONTEND_URL 格式无效（仅允许 http/https），忽略: %s", cfg.ExternalURL)
			cfg.ExternalURL = ""
		}
	}
	return &Launcher{
		frontendDir:     cfg.FrontendDir,
		port:            cfg.Port,
		externalURL:     cfg.ExternalURL,
		skipStaticProxy: cfg.SkipStaticProxy,
		done:            make(chan struct{}),
	}
}

// SkipStaticProxy 为 true 时代理不处理 /static，由 Go 提供（自定义主题目录）；默认 false，/static 代理到 Next.js。
func (l *Launcher) SkipStaticProxy() bool {
	return l.skipStaticProxy
}

func (l *Launcher) GetFrontendURL() string {
	if l.externalURL != "" {
		return l.externalURL
	}
	return fmt.Sprintf("http://127.0.0.1:%d", l.port)
}

func (l *Launcher) IsExternal() bool {
	return l.externalURL != ""
}

func (l *Launcher) Start() error {
	if l.externalURL != "" {
		log.Printf("[Frontend] 使用外部前端服务: %s", l.externalURL)
		return nil
	}

	serverJS := filepath.Join(l.frontendDir, "server.js")
	if _, err := os.Stat(serverJS); os.IsNotExist(err) {
		standalonePath := filepath.Join(l.frontendDir, ".next", "standalone", "server.js")
		if _, statErr := os.Stat(standalonePath); statErr == nil {
			serverJS = standalonePath
		} else {
			return fmt.Errorf("frontend not built: %s not found (run 'make frontend-build' first)", serverJS)
		}
	}

	absDir, err := filepath.Abs(l.frontendDir)
	if err != nil {
		return fmt.Errorf("resolve frontend dir failed: %w", err)
	}

	cmd := exec.Command("node", "server.js")
	cmd.Dir = filepath.Dir(serverJS)
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("PORT=%d", l.port),
		"HOSTNAME=0.0.0.0",
		"API_URL=http://127.0.0.1:8091",
	)

	logFile, logErr := os.OpenFile(
		filepath.Join(absDir, "frontend.log"),
		os.O_CREATE|os.O_WRONLY|os.O_APPEND,
		0644,
	)
	if logErr == nil {
		cmd.Stdout = logFile
		cmd.Stderr = logFile
	} else {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start frontend process failed: %w", err)
	}

	l.mu.Lock()
	l.cmd = cmd
	l.mu.Unlock()

	go func() {
		_ = cmd.Wait()
		if logErr == nil && logFile != nil {
			logFile.Close()
		}
		l.mu.Lock()
		l.cmd = nil
		l.mu.Unlock()
		log.Println("[Frontend] Next.js 进程已退出")
		close(l.done)
	}()

	go l.waitForReady()

	log.Printf("[Frontend] Next.js 内置前端启动中: %s (端口 %d)", absDir, l.port)
	return nil
}

func (l *Launcher) Stop() {
	l.mu.RLock()
	cmd := l.cmd
	l.mu.RUnlock()

	if cmd == nil || cmd.Process == nil {
		return
	}

	log.Println("[Frontend] 正在停止 Next.js 前端进程...")

	if err := cmd.Process.Signal(syscall.SIGTERM); err != nil {
		cmd.Process.Kill()
		return
	}

	select {
	case <-l.done:
	case <-time.After(10 * time.Second):
		cmd.Process.Kill()
	}

	log.Println("[Frontend] Next.js 前端进程已停止")
}

func (l *Launcher) IsRunning() bool {
	if l.externalURL != "" {
		return true
	}
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.cmd != nil && l.cmd.Process != nil
}

func (l *Launcher) waitForReady() {
	healthURL := fmt.Sprintf("http://127.0.0.1:%d/", l.port)
	client := &http.Client{Timeout: 3 * time.Second}
	start := time.Now()

	for {
		if time.Since(start) > HealthCheckTimeout {
			log.Printf("[Frontend] ⚠️ Next.js 健康检查超时（已等待 %.0f 秒）", HealthCheckTimeout.Seconds())
			return
		}

		l.mu.RLock()
		running := l.cmd != nil && l.cmd.Process != nil
		l.mu.RUnlock()
		if !running {
			log.Println("[Frontend] 进程已退出，停止健康检查")
			return
		}

		resp, err := client.Get(healthURL)
		if err == nil {
			resp.Body.Close()
			log.Printf("[Frontend] ✅ Next.js 前端已就绪 (等待了 %.1f 秒)", time.Since(start).Seconds())
			return
		}

		time.Sleep(HealthCheckInterval)
	}
}
