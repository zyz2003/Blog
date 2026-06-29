/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-15 12:16:18
 * @LastEditTime: 2025-07-18 19:08:52
 * @LastEditors: 安知鱼
 */
package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response 是统一的API返回结构体
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

// Success 成功响应
func Success(c *gin.Context, data interface{}, message string) {
	c.JSON(http.StatusOK, Response{
		Code:    http.StatusOK,
		Message: message,
		Data:    data,
	})
}

// Fail 失败响应
func Fail(c *gin.Context, code int, message string) {
	c.JSON(code, Response{
		Code:    code,
		Message: message,
		Data:    nil,
	})
}

// SuccessWithStatus 成功响应，但允许自定义 HTTP 状态码。
// 这对于返回 201 Created 或 202 Accepted 等状态非常有用。
func SuccessWithStatus(c *gin.Context, code int, data interface{}, message string) {
	c.JSON(code, Response{
		Code:    code,
		Message: message,
		Data:    data,
	})
}
