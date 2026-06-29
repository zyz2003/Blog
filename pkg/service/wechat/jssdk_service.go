// anheyu-app/pkg/service/wechat/jssdk_service.go
package wechat

import (
	"context"
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

// JSSDKService 微信JS-SDK服务
type JSSDKService struct {
	appID          string
	appSecret      string
	accessToken    string
	jsapiTicket    string
	tokenExpireAt  time.Time
	ticketExpireAt time.Time
	tokenMu        sync.RWMutex
	ticketMu       sync.RWMutex
}

// AccessTokenResponse 获取access_token响应
type AccessTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	ErrCode     int    `json:"errcode"`
	ErrMsg      string `json:"errmsg"`
}

// JSAPITicketResponse 获取jsapi_ticket响应
type JSAPITicketResponse struct {
	ErrCode   int    `json:"errcode"`
	ErrMsg    string `json:"errmsg"`
	Ticket    string `json:"ticket"`
	ExpiresIn int    `json:"expires_in"`
}

// JSSDKConfig JS-SDK配置
type JSSDKConfig struct {
	AppID     string `json:"appId"`
	Timestamp int64  `json:"timestamp"`
	NonceStr  string `json:"nonceStr"`
	Signature string `json:"signature"`
}

// ShareConfig 分享配置
type ShareConfig struct {
	Title  string `json:"title"`  // 分享标题
	Desc   string `json:"desc"`   // 分享描述
	Link   string `json:"link"`   // 分享链接
	ImgURL string `json:"imgUrl"` // 分享图标
}

// NewJSSDKService 创建JS-SDK服务
func NewJSSDKService(appID, appSecret string) *JSSDKService {
	return &JSSDKService{
		appID:     appID,
		appSecret: appSecret,
	}
}

// GetAccessToken 获取access_token
func (s *JSSDKService) GetAccessToken(ctx context.Context) (string, error) {
	s.tokenMu.RLock()
	// 如果token未过期，直接返回
	if s.accessToken != "" && time.Now().Before(s.tokenExpireAt) {
		token := s.accessToken
		s.tokenMu.RUnlock()
		return token, nil
	}
	s.tokenMu.RUnlock()

	s.tokenMu.Lock()
	defer s.tokenMu.Unlock()

	// 双重检查
	if s.accessToken != "" && time.Now().Before(s.tokenExpireAt) {
		return s.accessToken, nil
	}

	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s",
		s.appID, s.appSecret)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %w", err)
	}

	var result AccessTokenResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("解析响应失败: %w", err)
	}

	if result.ErrCode != 0 {
		return "", fmt.Errorf("获取access_token失败(code=%d): %s", result.ErrCode, result.ErrMsg)
	}

	s.accessToken = result.AccessToken
	// 提前5分钟过期
	s.tokenExpireAt = time.Now().Add(time.Duration(result.ExpiresIn-300) * time.Second)

	return s.accessToken, nil
}

// GetJSAPITicket 获取jsapi_ticket
func (s *JSSDKService) GetJSAPITicket(ctx context.Context) (string, error) {
	s.ticketMu.RLock()
	// 如果ticket未过期，直接返回
	if s.jsapiTicket != "" && time.Now().Before(s.ticketExpireAt) {
		ticket := s.jsapiTicket
		s.ticketMu.RUnlock()
		return ticket, nil
	}
	s.ticketMu.RUnlock()

	s.ticketMu.Lock()
	defer s.ticketMu.Unlock()

	// 双重检查
	if s.jsapiTicket != "" && time.Now().Before(s.ticketExpireAt) {
		return s.jsapiTicket, nil
	}

	// 先获取access_token
	accessToken, err := s.GetAccessToken(ctx)
	if err != nil {
		return "", fmt.Errorf("获取access_token失败: %w", err)
	}

	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=%s&type=jsapi", accessToken)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %w", err)
	}

	var result JSAPITicketResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("解析响应失败: %w", err)
	}

	if result.ErrCode != 0 {
		return "", fmt.Errorf("获取jsapi_ticket失败(code=%d): %s", result.ErrCode, result.ErrMsg)
	}

	s.jsapiTicket = result.Ticket
	// 提前5分钟过期
	s.ticketExpireAt = time.Now().Add(time.Duration(result.ExpiresIn-300) * time.Second)

	return s.jsapiTicket, nil
}

// GenerateSignature 生成JS-SDK签名
func (s *JSSDKService) GenerateSignature(jsapiTicket, nonceStr string, timestamp int64, url string) string {
	// 按照字典序排列参数
	str := fmt.Sprintf("jsapi_ticket=%s&noncestr=%s&timestamp=%d&url=%s",
		jsapiTicket, nonceStr, timestamp, url)

	// 进行sha1加密
	h := sha1.New()
	h.Write([]byte(str))
	return fmt.Sprintf("%x", h.Sum(nil))
}

// GetJSSDKConfig 获取JS-SDK配置
func (s *JSSDKService) GetJSSDKConfig(ctx context.Context, url string) (*JSSDKConfig, error) {
	// 获取jsapi_ticket
	ticket, err := s.GetJSAPITicket(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取jsapi_ticket失败: %w", err)
	}

	// 生成随机字符串
	nonceStr := uuid.New().String()[:16]
	// 生成时间戳
	timestamp := time.Now().Unix()
	// 生成签名
	signature := s.GenerateSignature(ticket, nonceStr, timestamp, url)

	return &JSSDKConfig{
		AppID:     s.appID,
		Timestamp: timestamp,
		NonceStr:  nonceStr,
		Signature: signature,
	}, nil
}

// IsConfigured 检查是否已配置
func (s *JSSDKService) IsConfigured() bool {
	return s.appID != "" && s.appSecret != ""
}
