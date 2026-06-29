// pkg/handler/captcha/handler.go
/*
 * @Description: 人机验证 Handler
 * @Author: 安知鱼
 * @Date: 2026-01-20
 */
package captcha

import (
	"net/http"

	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/captcha"

	"github.com/gin-gonic/gin"
)

// Handler 人机验证处理器
type Handler struct {
	captchaSvc captcha.CaptchaService
}

// NewHandler 创建人机验证处理器
func NewHandler(captchaSvc captcha.CaptchaService) *Handler {
	return &Handler{
		captchaSvc: captchaSvc,
	}
}

// GetConfig 获取验证码配置
// @Summary      获取验证码配置
// @Description  获取当前启用的验证码类型及相关配置
// @Tags         验证码
// @Produce      json
// @Success      200 {object} response.Response{data=captcha.CaptchaConfig}
// @Router       /public/captcha/config [get]
func (h *Handler) GetConfig(c *gin.Context) {
	config := h.captchaSvc.GetConfig()
	response.Success(c, config, "获取验证码配置成功")
}

// GenerateImage 生成图形验证码
// @Summary      生成图形验证码
// @Description  生成图形验证码（仅当验证方式为 image 时可用）
// @Tags         验证码
// @Produce      json
// @Success      200 {object} response.Response{data=captcha.ImageCaptchaResponse}
// @Failure      400 {object} response.Response "当前验证方式不支持生成图形验证码"
// @Failure      500 {object} response.Response "生成验证码失败"
// @Router       /public/captcha/image [get]
func (h *Handler) GenerateImage(c *gin.Context) {
	result, err := h.captchaSvc.GenerateImageCaptcha(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Success(c, result, "生成验证码成功")
}
