package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/pkg/auth"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/idgen"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
)

type TokenService interface {
	GenerateSessionTokens(ctx context.Context, user *model.User) (accessToken, refreshToken string, expiresAt int64, err error)
	RefreshAccessToken(ctx context.Context, refreshToken string) (accessToken string, expiresAt int64, err error)
	GenerateSignedToken(identifier string, duration time.Duration) (string, error)
	VerifySignedToken(identifier, sign string) error
	ParseAccessToken(ctx context.Context, accessToken string) (*auth.CustomClaims, error)
}

// tokenService 结构体增加了 cacheSvc 依赖
type tokenService struct {
	userRepo   repository.UserRepository
	settingSvc setting.SettingService
	cacheSvc   utility.CacheService
}

// NewTokenService 构造函数
func NewTokenService(
	userRepo repository.UserRepository,
	settingSvc setting.SettingService,
	cacheSvc utility.CacheService,
) TokenService {
	return &tokenService{
		userRepo:   userRepo,
		settingSvc: settingSvc,
		cacheSvc:   cacheSvc,
	}
}

// --- JWT 会话令牌实现 ---

func (s *tokenService) GenerateSessionTokens(ctx context.Context, user *model.User) (string, string, int64, error) {
	// 动态地从 SettingService 获取密钥
	jwtSecret := s.settingSvc.Get(constant.KeyJWTSecret.String())
	if jwtSecret == "" {
		return "", "", 0, fmt.Errorf("JWT_SECRET 未从数据库加载, 无法生成令牌")
	}

	// auth.GenerateToken 和 auth.GenerateRefreshToken 现在接收内部 uint ID，并在内部生成公共 ID
	accessToken, err := auth.GenerateToken(user.ID, []byte(user.UserGroup.Permissions), user.UserGroup.ID, []byte(jwtSecret))
	if err != nil {
		return "", "", 0, err
	}
	refreshToken, err := auth.GenerateRefreshToken(user.ID, []byte(jwtSecret))
	if err != nil {
		return "", "", 0, err
	}

	claims, err := auth.ParseToken(accessToken, []byte(jwtSecret))
	if err != nil {
		return "", "", 0, err
	}
	expiresAt := claims.ExpiresAt.Time.UnixMilli()

	return accessToken, refreshToken, expiresAt, nil
}

func (s *tokenService) RefreshAccessToken(ctx context.Context, refreshToken string) (string, int64, error) {
	jwtSecret := s.settingSvc.Get(constant.KeyJWTSecret.String())
	if jwtSecret == "" {
		return "", 0, fmt.Errorf("JWT_SECRET 未从数据库加载, 无法刷新令牌")
	}

	claims, err := auth.ParseToken(refreshToken, []byte(jwtSecret))
	if err != nil {
		return "", 0, fmt.Errorf("无效或过期的刷新令牌: %w", err)
	}

	// 1. claims.UserID 包含公共用户 ID，需要将其解码为内部数据库 ID，并验证类型
	internalUserID, entityType, err := idgen.DecodePublicID(claims.UserID) // 统一使用 DecodePublicID
	if err != nil {
		return "", 0, fmt.Errorf("解码公共用户ID失败: %w", err)
	}
	if entityType != idgen.EntityTypeUser {
		return "", 0, fmt.Errorf("令牌中的用户ID类型不匹配")
	}

	// 2. 使用内部数据库 ID 查询用户
	user, err := s.userRepo.FindByID(ctx, internalUserID)
	if err != nil || user == nil || user.Status != model.UserStatusActive {
		return "", 0, fmt.Errorf("用户不存在或状态异常")
	}

	// 3. 重新生成 Access Token，auth.GenerateToken 现在接收内部 uint ID
	accessToken, err := auth.GenerateToken(user.ID, []byte(user.UserGroup.Permissions), user.UserGroup.ID, []byte(jwtSecret))
	if err != nil {
		return "", 0, err
	}

	newClaims, _ := auth.ParseToken(accessToken, []byte(jwtSecret))
	expiresAt := newClaims.ExpiresAt.Time.UnixMilli()
	return accessToken, expiresAt, nil
}

// GenerateSignedToken 生成一个新的签名令牌。identifier 预期是公共 ID。
func (s *tokenService) GenerateSignedToken(identifier string, duration time.Duration) (string, error) {
	jwtSecret := s.settingSvc.Get(constant.KeyJWTSecret.String())
	if jwtSecret == "" {
		return "", fmt.Errorf("JWT_SECRET 未配置，无法生成签名令牌")
	}

	expiry := time.Now().Add(duration).Unix()
	dataToSign := fmt.Sprintf("%s:%d", identifier, expiry) // identifier 预期是公共 ID

	h := hmac.New(sha256.New, []byte(jwtSecret))
	h.Write([]byte(dataToSign))
	signature := h.Sum(nil)

	encodedSignature := base64.URLEncoding.EncodeToString(signature)
	return fmt.Sprintf("%s:%d", encodedSignature, expiry), nil
}

// VerifySignedToken 验证签名令牌。identifier 预期是公共 ID。
func (s *tokenService) VerifySignedToken(identifier, sign string) error {
	jwtSecret := s.settingSvc.Get(constant.KeyJWTSecret.String())
	if jwtSecret == "" {
		return fmt.Errorf("JWT_SECRET 未配置，无法验证签名令牌")
	}

	parts := strings.Split(sign, ":")
	if len(parts) != 2 {
		return fmt.Errorf("令牌格式无效")
	}
	encodedSignatureFromURL := parts[0]
	expiryStr := parts[1]

	expiry, err := strconv.ParseInt(expiryStr, 10, 64)
	if err != nil {
		return fmt.Errorf("令牌过期时间格式无效")
	}
	if time.Now().Unix() > expiry {
		return fmt.Errorf("令牌已过期")
	}

	dataToSign := fmt.Sprintf("%s:%d", identifier, expiry) // identifier 预期是公共 ID
	h := hmac.New(sha256.New, []byte(s.settingSvc.Get(constant.KeyJWTSecret.String())))
	h.Write([]byte(dataToSign))
	expectedSignature := h.Sum(nil)

	signatureFromURL, err := base64.URLEncoding.DecodeString(encodedSignatureFromURL)
	if err != nil {
		return fmt.Errorf("令牌签名解码失败")
	}

	if !hmac.Equal(signatureFromURL, expectedSignature) {
		return fmt.Errorf("签名无效")
	}

	return nil
}

// ParseAccessToken 负责解析和验证 access token
func (s *tokenService) ParseAccessToken(ctx context.Context, accessToken string) (*auth.CustomClaims, error) {
	jwtSecret := s.settingSvc.Get(constant.KeyJWTSecret.String())
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET 未配置，无法解析令牌")
	}

	return auth.ParseToken(accessToken, []byte(jwtSecret))
}
