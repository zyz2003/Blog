/*
 * @Description: 代理处理器，用于处理外部资源下载
 * @Author: 安知鱼
 * @Date: 2025-01-20 10:00:00
 * @LastEditTime: 2025-10-16 11:39:50
 * @LastEditors: 安知鱼
 */
package proxy

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const maxProxyResponseBytes = 100 << 20 // 100MB

// ProxyHandler 代理处理器
type ProxyHandler struct{}

// NewHandler 创建代理处理器
func NewHandler() *ProxyHandler {
	return &ProxyHandler{}
}

var privateIPNets []*net.IPNet

func init() {
	cidrs := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"127.0.0.0/8",
		"169.254.0.0/16",
		"::1/128",
		"fc00::/7",
		"fe80::/10",
	}
	for _, cidr := range cidrs {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			panic(fmt.Sprintf("invalid CIDR in privateIPNets: %s", cidr))
		}
		privateIPNets = append(privateIPNets, ipNet)
	}
}

func isPrivateOrReservedIP(ip net.IP) bool {
	for _, ipNet := range privateIPNets {
		if ipNet.Contains(ip) {
			return true
		}
	}
	return ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified()
}

// safeDialContext resolves DNS and connects to the target, rejecting private/reserved IPs
// at the connection level to prevent DNS rebinding (TOCTOU) attacks.
func safeDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}

	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, fmt.Errorf("DNS解析失败: %w", err)
	}
	if len(ips) == 0 {
		return nil, fmt.Errorf("DNS解析无结果: %s", host)
	}

	for _, ipAddr := range ips {
		if isPrivateOrReservedIP(ipAddr.IP) {
			return nil, fmt.Errorf("目标地址不允许访问")
		}
	}

	// 直接连接到已解析的 IP，防止 DNS rebinding
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
}

func sanitizeFilenameForHeader(filename string) string {
	replacer := strings.NewReplacer(
		`"`, "",
		`\`, "",
		"\r", "",
		"\n", "",
	)
	return replacer.Replace(filename)
}

// HandleDownload 处理外部文件下载代理
// @Summary      代理下载
// @Description  代理下载外部资源（主要用于图片）
// @Tags         代理服务
// @Produce      octet-stream
// @Param        url  query  string  true  "目标URL"
// @Success      200  {file}    file  "文件内容"
// @Failure      400  {object}  object{error=string}  "参数错误"
// @Failure      502  {object}  object{error=string}  "目标服务器错误"
// @Failure      500  {object}  object{error=string}  "代理失败"
// @Router       /proxy/download [get]
func (h *ProxyHandler) HandleDownload(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少url参数"})
		return
	}

	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的URL格式"})
		return
	}

	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "只支持http和https协议"})
		return
	}

	transport := &http.Transport{
		DialContext: safeDialContext,
	}
	client := &http.Client{
		Timeout:   60 * time.Second,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("重定向次数过多")
			}
			return nil
		},
	}

	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建请求失败"})
		return
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "image/webp,image/apng,image/*,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Pragma", "no-cache")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("代理请求失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "请求目标资源失败"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "目标服务器返回错误"})
		return
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	if !strings.HasPrefix(contentType, "image/") && contentType != "application/octet-stream" {
		c.JSON(http.StatusBadGateway, gin.H{"error": "目标不是图片文件"})
		return
	}

	c.Header("Content-Type", contentType)
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Methods", "GET, OPTIONS")
	c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept")
	c.Header("Cross-Origin-Resource-Policy", "cross-origin")
	c.Header("Timing-Allow-Origin", "*")

	contentLength := resp.Header.Get("Content-Length")
	if contentLength != "" {
		c.Header("Content-Length", contentLength)
	}

	filename := sanitizeFilenameForHeader(getFileName(targetURL))
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Header("Cache-Control", "no-cache")

	c.Header("Content-Encoding", "identity")
	c.Header("X-Content-Type-Options", "nosniff")

	limitedBody := io.LimitReader(resp.Body, maxProxyResponseBytes)
	buffer := make([]byte, 32*1024)
	flusher, ok := c.Writer.(http.Flusher)

	for {
		n, err := limitedBody.Read(buffer)
		if n > 0 {
			if _, writeErr := c.Writer.Write(buffer[:n]); writeErr != nil {
				log.Printf("写入数据到客户端时发生错误: %v", writeErr)
				return
			}

			if ok {
				flusher.Flush()
			}
		}

		if err != nil {
			if err != io.EOF {
				log.Printf("读取远程文件时发生错误: %v", err)
			}
			break
		}
	}
}

// HandleTest 测试代理下载功能
// @Summary      测试代理服务
// @Description  测试代理下载服务是否正常运行
// @Tags         代理服务
// @Produce      json
// @Success      200  {object}  object{message=string,timestamp=int,status=string}  "服务正常"
// @Router       /proxy/test [get]
func (h *ProxyHandler) HandleTest(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message":   "代理下载服务正常运行",
		"timestamp": time.Now().Unix(),
		"status":    "ok",
	})
}

// getFileName 从URL中提取文件名
func getFileName(urlStr string) string {
	// 优化：使用标准库 path.Base 来获取文件名，更健壮
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return "download"
	}

	filename := path.Base(parsedURL.Path)
	if filename == "." || filename == "/" {
		return "download"
	}

	return filename
}
