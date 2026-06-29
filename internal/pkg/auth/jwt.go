/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-28 00:21:55
 * @LastEditTime: 2025-08-11 18:39:11
 * @LastEditors: 安知鱼
 */
package auth

import (
	"fmt"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"

	"github.com/golang-jwt/jwt/v5"
)

// ClaimsKey 和 CustomClaims 已移至 types.go

// GenerateToken 生成一个新的 JWT Access Token
func GenerateToken(userID uint, permissions []byte, userGroupID uint, secretKey []byte) (string, error) {
	if len(secretKey) == 0 {
		return "", fmt.Errorf("JWT Secret 不能为空")
	}

	accessTokenExpires := time.Now().Add(time.Minute * 15)

	publicUserID, err := idgen.GeneratePublicID(userID, idgen.EntityTypeUser)
	if err != nil {
		return "", fmt.Errorf("生成用户公共ID失败: %w", err)
	}

	publicUserGroupID, err := idgen.GeneratePublicID(userGroupID, idgen.EntityTypeUserGroup)
	if err != nil {
		return "", fmt.Errorf("生成用户组公共ID失败: %w", err)
	}

	claims := CustomClaims{ // 此处 CustomClaims 来自同包下的 types.go
		UserID:      publicUserID,
		UserGroupID: publicUserGroupID,
		Permissions: permissions,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessTokenExpires),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "anheyu-app",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secretKey)
}

// GenerateRefreshToken 生成一个新的 JWT Refresh Token
func GenerateRefreshToken(userID uint, secretKey []byte) (string, error) {
	if len(secretKey) == 0 {
		return "", fmt.Errorf("JWT Secret 不能为空")
	}

	refreshTokenExpires := time.Now().Add(time.Hour * 24 * 30)

	publicUserID, err := idgen.GeneratePublicID(userID, idgen.EntityTypeUser)
	if err != nil {
		return "", fmt.Errorf("生成用户公共ID失败: %w", err)
	}

	claims := CustomClaims{ // 此处 CustomClaims 来自同包下的 types.go
		UserID: publicUserID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshTokenExpires),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "anheyu-app",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secretKey)
}

// ParseToken 解析 JWT Token
func ParseToken(tokenStr string, secretKey []byte) (*CustomClaims, error) {
	if len(secretKey) == 0 {
		return nil, fmt.Errorf("JWT Secret 不能为空")
	}

	claims := &CustomClaims{} // 此处 CustomClaims 来自同包下的 types.go
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return secretKey, nil
	})

	if err != nil {
		return nil, fmt.Errorf("解析token失败: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("无效或过期Token")
	}

	return claims, nil
}
