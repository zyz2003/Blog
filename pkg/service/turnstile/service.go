// pkg/service/turnstile/service.go
/*
 * @Description: Cloudflare Turnstile 人机验证服务
 * @Author: 安知鱼
 * @Date: 2026-01-12
 */
package turnstile

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

const (
	// Cloudflare Turnstile 验证 API 地址
	TurnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
)

// TurnstileService 定义了 Turnstile 验证服务的接口
type TurnstileService interface {
	// IsEnabled 检查 Turnstile 是否启用
	IsEnabled() bool
	// Verify 验证 Turnstile token
	Verify(ctx context.Context, token string, remoteIP string) error
}

// turnstileService 是 TurnstileService 的实现
type turnstileService struct {
	settingSvc setting.SettingService
	httpClient *http.Client
}

// NewTurnstileService 创建一个新的 TurnstileService 实例
func NewTurnstileService(settingSvc setting.SettingService) TurnstileService {
	return &turnstileService{
		settingSvc: settingSvc,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// TurnstileVerifyRequest 定义发送给 Cloudflare 的验证请求
type TurnstileVerifyRequest struct {
	Secret   string `json:"secret"`
	Response string `json:"response"`
	RemoteIP string `json:"remoteip,omitempty"`
}

// TurnstileVerifyResponse 定义 Cloudflare 返回的验证响应
type TurnstileVerifyResponse struct {
	Success     bool     `json:"success"`
	ChallengeTS string   `json:"challenge_ts,omitempty"`
	Hostname    string   `json:"hostname,omitempty"`
	ErrorCodes  []string `json:"error-codes,omitempty"`
	Action      string   `json:"action,omitempty"`
	CData       string   `json:"cdata,omitempty"`
}

// IsEnabled 检查 Turnstile 是否启用
func (s *turnstileService) IsEnabled() bool {
	enabled := s.settingSvc.Get(constant.KeyTurnstileEnable.String())
	return enabled == "true"
}

// Verify 验证 Turnstile token（由 CaptchaService 统一调度，不再自行检查 turnstile.enable）
func (s *turnstileService) Verify(ctx context.Context, token string, remoteIP string) error {
	if token == "" {
		return errors.New("请完成人机验证")
	}

	// 获取 Secret Key
	secretKey := s.settingSvc.Get(constant.KeyTurnstileSecretKey.String())
	if secretKey == "" {
		// 如果启用了但未配置密钥，记录警告并跳过验证
		return errors.New("Turnstile 配置错误：缺少 Secret Key")
	}

	// 构建请求体
	reqBody := TurnstileVerifyRequest{
		Secret:   secretKey,
		Response: token,
		RemoteIP: remoteIP,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return errors.New("人机验证请求构建失败")
	}

	// 发送验证请求
	req, err := http.NewRequestWithContext(ctx, "POST", TurnstileVerifyURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return errors.New("人机验证请求创建失败")
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return errors.New("人机验证服务暂时不可用，请稍后重试")
	}
	defer resp.Body.Close()

	// 解析响应
	var verifyResp TurnstileVerifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&verifyResp); err != nil {
		return errors.New("人机验证响应解析失败")
	}

	// 检查验证结果
	if !verifyResp.Success {
		// 根据错误码返回更具体的错误信息
		if len(verifyResp.ErrorCodes) > 0 {
			switch verifyResp.ErrorCodes[0] {
			case "missing-input-secret":
				return errors.New("Turnstile 配置错误：缺少 Secret Key")
			case "invalid-input-secret":
				return errors.New("Turnstile 配置错误：Secret Key 无效")
			case "missing-input-response":
				return errors.New("请完成人机验证")
			case "invalid-input-response":
				return errors.New("人机验证失败，请刷新页面后重试")
			case "bad-request":
				return errors.New("人机验证请求格式错误")
			case "timeout-or-duplicate":
				return errors.New("人机验证已过期，请刷新页面后重试")
			case "internal-error":
				return errors.New("人机验证服务内部错误，请稍后重试")
			default:
				return errors.New("人机验证失败，请重试")
			}
		}
		return errors.New("人机验证失败，请重试")
	}

	return nil
}
