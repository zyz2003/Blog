// pkg/handler/subscriber/handler.go
package subscriber

import (
	"net/http"

	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/captcha"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/subscriber"

	"github.com/gin-gonic/gin"
)

// Handler 订阅功能处理器
type Handler struct {
	svc        *subscriber.Service
	captchaSvc captcha.CaptchaService
}

// NewHandler 创建订阅处理器实例
func NewHandler(svc *subscriber.Service, captchaSvc captcha.CaptchaService) *Handler {
	return &Handler{
		svc:        svc,
		captchaSvc: captchaSvc,
	}
}

// SubscribeRequest 订阅请求
type SubscribeRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required"`
}

// UnsubscribeRequest 退订请求
type UnsubscribeRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// Subscribe
// @Summary      订阅博客更新
// @Description  用户输入邮箱订阅博客，新文章发布时会收到邮件通知
// @Tags         订阅
// @Accept       json
// @Produce      json
// @Param        subscribe_request body SubscribeRequest true "订阅请求"
// @Success      200 {object} response.Response "订阅成功"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      409 {object} response.Response "邮箱已订阅"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /public/subscribe [post]
func (h *Handler) Subscribe(c *gin.Context) {
	var req SubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请输入有效的邮箱地址")
		return
	}

	err := h.svc.Subscribe(c.Request.Context(), req.Email, req.Code)
	if err != nil {
		if err.Error() == "该邮箱已订阅" {
			response.Fail(c, http.StatusConflict, err.Error())
			return
		}
		response.Fail(c, http.StatusInternalServerError, "订阅失败: "+err.Error())
		return
	}

	response.Success(c, nil, "订阅成功！您将在新文章发布时收到邮件通知")
}

// Unsubscribe
// @Summary      取消订阅
// @Description  用户输入邮箱取消订阅
// @Tags         订阅
// @Accept       json
// @Produce      json
// @Param        unsubscribe_request body UnsubscribeRequest true "退订请求"
// @Success      200 {object} response.Response "退订成功"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      404 {object} response.Response "订阅不存在"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /public/subscribe [delete]
func (h *Handler) Unsubscribe(c *gin.Context) {
	var req UnsubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请输入有效的邮箱地址")
		return
	}

	err := h.svc.Unsubscribe(c.Request.Context(), req.Email)
	if err != nil {
		if err.Error() == "订阅不存在" {
			response.Fail(c, http.StatusNotFound, err.Error())
			return
		}
		response.Fail(c, http.StatusInternalServerError, "退订失败: "+err.Error())
		return
	}

	response.Success(c, nil, "退订成功")
}

// UnsubscribeByToken
// @Summary      通过令牌取消订阅
// @Description  用户点击邮件中的退订链接，通过令牌取消订阅
// @Tags         订阅
// @Produce      json
// @Param        token path string true "退订令牌"
// @Success      200 {object} response.Response "退订成功"
// @Failure      400 {object} response.Response "令牌无效"
// @Failure      404 {object} response.Response "订阅不存在"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /public/unsubscribe/{token} [get]
func (h *Handler) UnsubscribeByToken(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		response.Fail(c, http.StatusBadRequest, "令牌不能为空")
		return
	}

	err := h.svc.UnsubscribeByToken(c.Request.Context(), token)
	if err != nil {
		if err.Error() == "订阅不存在或令牌无效" {
			response.Fail(c, http.StatusNotFound, err.Error())
			return
		}
		response.Fail(c, http.StatusInternalServerError, "退订失败: "+err.Error())
		return
	}

	response.Success(c, nil, "退订成功")
}

// CaptchaParams 统一验证码参数
type CaptchaParams struct {
	// Turnstile 参数
	TurnstileToken string `json:"turnstile_token,omitempty"`
	// 极验参数
	GeetestLotNumber     string `json:"geetest_lot_number,omitempty"`
	GeetestCaptchaOutput string `json:"geetest_captcha_output,omitempty"`
	GeetestPassToken     string `json:"geetest_pass_token,omitempty"`
	GeetestGenTime       string `json:"geetest_gen_time,omitempty"`
	// 系统验证码参数
	ImageCaptchaId     string `json:"image_captcha_id,omitempty"`
	ImageCaptchaAnswer string `json:"image_captcha_answer,omitempty"`
}

// SendVerificationCodeRequest 发送验证码请求
type SendVerificationCodeRequest struct {
	Email string `json:"email" binding:"required,email"`
	CaptchaParams
}

// SendVerificationCode
// @Summary      发送订阅验证码
// @Description  用户输入邮箱，发送验证码到邮箱
// @Tags         订阅
// @Accept       json
// @Produce      json
// @Param        request body SendVerificationCodeRequest true "发送验证码请求"
// @Success      200 {object} response.Response "发送成功"
// @Failure      400 {object} response.Response "请求参数错误"
// @Failure      500 {object} response.Response "服务器内部错误"
// @Router       /public/subscribe/code [post]
func (h *Handler) SendVerificationCode(c *gin.Context) {
	var req SendVerificationCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请输入有效的邮箱地址")
		return
	}

	// 验证人机验证（如果启用）
	captchaParams := captcha.CaptchaParams{
		TurnstileToken:       req.TurnstileToken,
		GeetestLotNumber:     req.GeetestLotNumber,
		GeetestCaptchaOutput: req.GeetestCaptchaOutput,
		GeetestPassToken:     req.GeetestPassToken,
		GeetestGenTime:       req.GeetestGenTime,
		ImageCaptchaId:       req.ImageCaptchaId,
		ImageCaptchaAnswer:   req.ImageCaptchaAnswer,
	}
	if err := h.captchaSvc.Verify(c.Request.Context(), captchaParams, c.ClientIP()); err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	err := h.svc.SendVerificationCode(c.Request.Context(), req.Email)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, nil, "验证码已发送，请查收邮件")
}
