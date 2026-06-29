// internal/app/middleware/auth.go
package middleware

import (
	"log"
	"net/http"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	service_auth "github.com/anzhiyu-c/anheyu-app/pkg/service/auth"

	"github.com/gin-gonic/gin"
)

type Middleware struct {
	tokenSvc service_auth.TokenService
}

func NewMiddleware(tokenSvc service_auth.TokenService) *Middleware {
	return &Middleware{tokenSvc: tokenSvc}
}

// JWTAuth 是一个强制性的JWT认证中间件
func (m *Middleware) JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.Request.Header.Get("Authorization")
		if authHeader == "" {
			response.Fail(c, http.StatusUnauthorized, "请求未携带Token，无权限访问")
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			response.Fail(c, http.StatusUnauthorized, "Token格式不正确")
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims, err := m.tokenSvc.ParseAccessToken(c.Request.Context(), tokenString)
		if err != nil {
			log.Printf("[JWTAuth] JWT token解析失败: %v", err)
			response.Fail(c, http.StatusUnauthorized, "无效或过期的Token")
			c.Abort()
			return
		}

		c.Set(auth.ClaimsKey, claims)
		c.Next()
	}
}

// JWTAuthOptional 是一个可选的JWT认证中间件
// 如果没有Token，允许游客访问；如果有Token但过期，返回401触发自动刷新
func (m *Middleware) JWTAuthOptional() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.Request.Header.Get("Authorization")
		if authHeader == "" {
			c.Next() // 没有Token，直接放行（游客）
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			c.Next() // Token格式不正确，直接放行（游客）
			return
		}

		tokenString := parts[1]
		claims, err := m.tokenSvc.ParseAccessToken(c.Request.Context(), tokenString)
		if err != nil {
			// Token无效或过期，返回401触发前端自动刷新token
			log.Printf("[JWTAuthOptional] Token解析失败: %v, 返回401触发自动刷新", err)
			response.Fail(c, http.StatusUnauthorized, "Token已过期")
			c.Abort()
			return
		}

		// Token有效，将用户信息存入context
		c.Set(auth.ClaimsKey, claims)
		c.Next()
	}
}

// AdminAuth 是一个管理员权限验证中间件
func (m *Middleware) AdminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		claimsValue, exists := c.Get(auth.ClaimsKey)
		if !exists {
			response.Fail(c, http.StatusForbidden, "权限信息获取失败")
			c.Abort()
			return
		}

		claims, ok := claimsValue.(*auth.CustomClaims)
		if !ok {
			response.Fail(c, http.StatusForbidden, "权限信息格式不正确")
			c.Abort()
			return
		}

		userGroupID, entityType, err := idgen.DecodePublicID(claims.UserGroupID)
		if err != nil || entityType != idgen.EntityTypeUserGroup {
			response.Fail(c, http.StatusForbidden, "权限信息无效：用户组ID无法解析")
			c.Abort()
			return
		}

		if userGroupID != 1 {
			response.Fail(c, http.StatusForbidden, "权限不足：此操作需要管理员权限")
			c.Abort()
			return
		}

		c.Next()
	}
}
