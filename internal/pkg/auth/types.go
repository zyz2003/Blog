/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-11 18:38:27
 * @LastEditTime: 2025-08-11 18:38:34
 * @LastEditors: 安知鱼
 */
package auth

import "github.com/golang-jwt/jwt/v5"

// ClaimsKey 是用于在 gin.Context 中存储和检索整个用户信息结构体的键。
const ClaimsKey = "user_claims"

// CustomClaims 定义了 JWT 的自定义 Claims 结构体
// UserID 和 UserGroupID 现在存储的是其公共 ID 字符串表示。
type CustomClaims struct {
	UserID      string `json:"user_id"`       // 用户公共ID
	UserGroupID string `json:"user_group_id"` // 用户组公共ID
	Permissions []byte `json:"permissions"`   // 用户的权限信息
	jwt.RegisteredClaims
}
