// pkg/util/ip.go
package util

import (
	"fmt"
	"net"
	"strings"

	"github.com/gin-gonic/gin"
)

// TrustedProxyCIDRs 是可信代理的 CIDR 列表，供 Gin 和本包共同使用。
var TrustedProxyCIDRs = []string{
	"127.0.0.0/8",
	"::1/128",
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16",
}

var trustedProxyNets []*net.IPNet
var privateOrReservedNets []*net.IPNet

func init() {
	for _, cidr := range TrustedProxyCIDRs {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			panic(fmt.Sprintf("invalid CIDR in TrustedProxyCIDRs: %s", cidr))
		}
		trustedProxyNets = append(trustedProxyNets, ipNet)
	}

	reservedCIDRs := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"127.0.0.0/8",
		"169.254.0.0/16",
		"::1/128",
		"fc00::/7",
		"fe80::/10",
	}
	for _, cidr := range reservedCIDRs {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			panic(fmt.Sprintf("invalid CIDR in privateOrReservedNets: %s", cidr))
		}
		privateOrReservedNets = append(privateOrReservedNets, ipNet)
	}
}

func isTrustedProxy(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}

	for _, ipNet := range trustedProxyNets {
		if ipNet.Contains(ip) {
			return true
		}
	}
	return false
}

func extractIPFromHeader(value string) string {
	if value == "" {
		return ""
	}
	parts := strings.Split(value, ",")
	candidate := strings.TrimSpace(parts[0])
	if net.ParseIP(candidate) != nil {
		return candidate
	}
	return ""
}

// GetRealClientIP 获取客户端真实IP地址
// 仅当直连来源是可信代理时，才检查转发头部，防止客户端直接伪造代理头部。
func GetRealClientIP(c *gin.Context) string {
	if !isTrustedProxy(c.Request.RemoteAddr) {
		return c.ClientIP()
	}

	headers := []string{
		"X-Forwarded-For",
		"X-Real-IP",
		"CF-Connecting-IP",
		"EO-Connecting-IP",
		"Ali-CDN-Real-IP",
		"True-Client-IP",
	}

	for _, header := range headers {
		if ip := extractIPFromHeader(c.GetHeader(header)); ip != "" {
			return ip
		}
	}

	return c.ClientIP()
}

// IsValidIP 验证IP地址是否有效
func IsValidIP(ip string) bool {
	return net.ParseIP(ip) != nil
}

// IsPrivateIP 检查是否为私有或保留IP地址（含 IPv6、链路本地、云元数据地址段）
func IsPrivateIP(ip string) bool {
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return false
	}

	for _, ipNet := range privateOrReservedNets {
		if ipNet.Contains(parsedIP) {
			return true
		}
	}

	return parsedIP.IsLoopback() || parsedIP.IsLinkLocalUnicast() || parsedIP.IsLinkLocalMulticast() || parsedIP.IsUnspecified()
}
