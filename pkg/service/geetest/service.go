// pkg/service/geetest/service.go
/*
 * @Description: 极验 GeeTest 4.0 人机验证服务
 * @Author: 安知鱼
 * @Date: 2026-01-20
 */
package geetest

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

const (
	// 极验 4.0 验证 API 地址
	GeetestVerifyURL = "https://gcaptcha4.geetest.com/validate"
)

// GeetestService 定义了极验验证服务的接口
type GeetestService interface {
	// IsEnabled 检查极验是否启用
	IsEnabled() bool
	// GetCaptchaId 获取 CaptchaId（前端使用）
	GetCaptchaId() string
	// Verify 验证极验 token
	Verify(ctx context.Context, lotNumber, captchaOutput, passToken, genTime string) error
}

// geetestService 是 GeetestService 的实现
type geetestService struct {
	settingSvc setting.SettingService
	httpClient *http.Client
}

// NewGeetestService 创建一个新的 GeetestService 实例
func NewGeetestService(settingSvc setting.SettingService) GeetestService {
	return &geetestService{
		settingSvc: settingSvc,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// GeetestVerifyResponse 定义极验返回的验证响应
type GeetestVerifyResponse struct {
	Status      string `json:"status,omitempty"`
	Result      string `json:"result"`
	Reason      string `json:"reason"`
	Code        string `json:"code,omitempty"`
	Msg         string `json:"msg,omitempty"`
	CaptchaArgs struct {
		UsedType  string `json:"used_type"`
		UserIP    string `json:"user_ip"`
		LotNumber string `json:"lot_number"`
		Scene     string `json:"scene"`
		Referer   string `json:"referer"`
	} `json:"captcha_args,omitempty"`
}

// IsEnabled 检查极验是否启用
func (s *geetestService) IsEnabled() bool {
	captchaId := s.settingSvc.Get(constant.KeyGeetestCaptchaId.String())
	captchaKey := s.settingSvc.Get(constant.KeyGeetestCaptchaKey.String())
	return captchaId != "" && captchaKey != ""
}

// GetCaptchaId 获取 CaptchaId
func (s *geetestService) GetCaptchaId() string {
	return s.settingSvc.Get(constant.KeyGeetestCaptchaId.String())
}

// Verify 验证极验 token
func (s *geetestService) Verify(ctx context.Context, lotNumber, captchaOutput, passToken, genTime string) error {
	// 检查必要参数
	if lotNumber == "" || captchaOutput == "" || passToken == "" || genTime == "" {
		return errors.New("请完成人机验证")
	}

	// 获取 Captcha Key
	captchaId := s.settingSvc.Get(constant.KeyGeetestCaptchaId.String())
	captchaKey := s.settingSvc.Get(constant.KeyGeetestCaptchaKey.String())
	if captchaId == "" || captchaKey == "" {
		return errors.New("极验配置错误：缺少 Captcha ID 或 Captcha Key")
	}

	// 生成签名
	// 使用 HMAC-SHA256 算法，以 lot_number 为消息，captcha_key 为密钥
	signToken := generateSignToken(lotNumber, captchaKey)

	// 构建请求 URL（captcha_id 作为查询参数）
	reqURL := GeetestVerifyURL + "?captcha_id=" + url.QueryEscape(captchaId)

	// 构建 form-urlencoded 请求体（极验 v4 API 要求使用 form 格式而非 JSON）
	formData := url.Values{}
	formData.Set("lot_number", lotNumber)
	formData.Set("captcha_output", captchaOutput)
	formData.Set("pass_token", passToken)
	formData.Set("gen_time", genTime)
	formData.Set("sign_token", signToken)

	// 发送验证请求
	req, err := http.NewRequestWithContext(ctx, "POST", reqURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return errors.New("人机验证请求创建失败")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		// 当极验 API 异常时，为了不影响业务流程，可以选择放行
		// 根据业务需求，这里返回错误让用户重试
		return errors.New("人机验证服务暂时不可用，请稍后重试")
	}
	defer resp.Body.Close()

	// 检查 HTTP 状态码
	if resp.StatusCode != http.StatusOK {
		return errors.New("人机验证服务响应异常")
	}

	// 解析响应
	var verifyResp GeetestVerifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&verifyResp); err != nil {
		return errors.New("人机验证响应解析失败")
	}

	// 检查是否有错误状态
	if verifyResp.Status == "error" {
		switch verifyResp.Code {
		case "-50005":
			return errors.New("人机验证参数无效：gen_time 格式错误")
		case "-50004":
			return errors.New("人机验证参数无效：sign_token 验证失败")
		default:
			if verifyResp.Msg != "" {
				return errors.New("人机验证失败：" + verifyResp.Msg)
			}
			return errors.New("人机验证失败，请重试")
		}
	}

	// 检查验证结果
	if verifyResp.Result != "success" {
		switch verifyResp.Reason {
		case "pass_token expire":
			return errors.New("人机验证已过期，请刷新页面后重试")
		case "":
			return errors.New("人机验证失败，请重试")
		default:
			return errors.New("人机验证失败：" + verifyResp.Reason)
		}
	}

	return nil
}

// generateSignToken 生成签名
// 使用 HMAC-SHA256 算法，以 lot_number 为消息，captcha_key 为密钥
func generateSignToken(lotNumber, captchaKey string) string {
	h := hmac.New(sha256.New, []byte(captchaKey))
	h.Write([]byte(lotNumber))
	return hex.EncodeToString(h.Sum(nil))
}
