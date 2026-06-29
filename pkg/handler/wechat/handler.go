// anheyu-app/pkg/handler/wechat/handler.go
package wechat

import (
	"log"
	"net/http"

	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	wechat_service "github.com/anzhiyu-c/anheyu-app/pkg/service/wechat"
	"github.com/gin-gonic/gin"
)

// Handler 微信JS-SDK处理器
type Handler struct {
	jssdkService *wechat_service.JSSDKService
}

// NewHandler 创建处理器
func NewHandler(jssdkService *wechat_service.JSSDKService) *Handler {
	return &Handler{
		jssdkService: jssdkService,
	}
}

// GetJSSDKConfigRequest 获取JS-SDK配置请求
type GetJSSDKConfigRequest struct {
	URL string `json:"url" form:"url" binding:"required"` // 需要签名的URL
}

// GetJSSDKConfig 获取JS-SDK配置
// @Summary      获取微信JS-SDK配置
// @Description  获取用于微信分享等功能的JS-SDK配置信息
// @Tags         微信分享
// @Accept       json
// @Produce      json
// @Param        url query string true "需要签名的页面URL"
// @Success      200 {object} response.Response{data=wechat_service.JSSDKConfig} "获取成功"
// @Failure      400 {object} response.Response "参数错误"
// @Failure      500 {object} response.Response "获取失败"
// @Router       /wechat/jssdk/config [get]
func (h *Handler) GetJSSDKConfig(c *gin.Context) {
	var req GetJSSDKConfigRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		log.Printf("[微信JS-SDK] 参数错误: %v", err)
		response.Fail(c, http.StatusBadRequest, "参数错误: 缺少url参数")
		return
	}

	// 检查服务是否已配置
	if h.jssdkService == nil || !h.jssdkService.IsConfigured() {
		log.Println("[微信JS-SDK] 服务未配置")
		response.Fail(c, http.StatusServiceUnavailable, "微信分享功能未配置")
		return
	}

	log.Printf("[微信JS-SDK] 获取配置: url=%s", req.URL)

	config, err := h.jssdkService.GetJSSDKConfig(c.Request.Context(), req.URL)
	if err != nil {
		log.Printf("[微信JS-SDK] 获取配置失败: %v", err)
		response.Fail(c, http.StatusInternalServerError, "获取JS-SDK配置失败")
		return
	}

	log.Printf("[微信JS-SDK] 获取配置成功: appId=%s, timestamp=%d", config.AppID, config.Timestamp)

	response.Success(c, config, "")
}

// CheckShareEnabled 检查分享功能是否启用
// @Summary      检查微信分享功能状态
// @Description  检查微信分享功能是否已配置并启用
// @Tags         微信分享
// @Produce      json
// @Success      200 {object} response.Response{data=object{enabled=bool}} "查询成功"
// @Router       /wechat/jssdk/status [get]
func (h *Handler) CheckShareEnabled(c *gin.Context) {
	enabled := h.jssdkService != nil && h.jssdkService.IsConfigured()
	response.Success(c, map[string]interface{}{
		"enabled": enabled,
	}, "")
}
