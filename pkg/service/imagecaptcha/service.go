// pkg/service/imagecaptcha/service.go
/*
 * @Description: 系统内置图形验证码服务
 * @Author: 安知鱼
 * @Date: 2026-01-20
 */
package imagecaptcha

import (
	"context"
	"errors"
	"image/color"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
	"github.com/google/uuid"
	"github.com/mojocn/base64Captcha"
)

// ImageCaptchaService 定义了图形验证码服务的接口
type ImageCaptchaService interface {
	// Generate 生成验证码，返回验证码ID和Base64图片
	Generate(ctx context.Context) (captchaId string, imageBase64 string, err error)
	// Verify 验证验证码，验证后自动删除
	Verify(ctx context.Context, captchaId, answer string) error
}

// imageCaptchaService 是 ImageCaptchaService 的实现
type imageCaptchaService struct {
	settingSvc setting.SettingService
	cacheSvc   utility.CacheService
}

// NewImageCaptchaService 创建一个新的 ImageCaptchaService 实例
func NewImageCaptchaService(settingSvc setting.SettingService, cacheSvc utility.CacheService) ImageCaptchaService {
	return &imageCaptchaService{
		settingSvc: settingSvc,
		cacheSvc:   cacheSvc,
	}
}

const (
	// 验证码缓存键前缀
	captchaCachePrefix = "captcha:image:"
)

// Generate 生成验证码
func (s *imageCaptchaService) Generate(ctx context.Context) (captchaId string, imageBase64 string, err error) {
	// 获取配置
	length := s.getLength()
	expire := s.getExpire()

	// 创建验证码驱动 - 透明背景 + 深色文字，前端通过 CSS 适配暗色主题
	driver := base64Captcha.NewDriverString(
		80,     // height
		240,    // width
		2,      // noiseCount
		2,      // showLineOptions
		length, // length
		"23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ",
		&color.RGBA{R: 245, G: 245, B: 245, A: 255}, // bgColor - 浅灰背景，前端暗色模式通过 CSS invert 适配
		nil,
		[]string{"wqy-microhei.ttc"},
	)

	// 生成验证码
	captcha := base64Captcha.NewCaptcha(driver, base64Captcha.DefaultMemStore)
	id, b64s, answer, err := captcha.Generate()
	if err != nil {
		return "", "", errors.New("生成验证码失败")
	}

	// 清除内存存储中的答案，仅使用 Redis 作为唯一验证源
	base64Captcha.DefaultMemStore.Verify(id, answer, true)

	captchaId = uuid.New().String()

	cacheKey := captchaCachePrefix + captchaId
	if err := s.cacheSvc.Set(ctx, cacheKey, strings.ToLower(answer), time.Duration(expire)*time.Second); err != nil {
		return "", "", errors.New("验证码服务暂时不可用，请稍后重试")
	}

	return captchaId, b64s, nil
}

// Verify 验证验证码
func (s *imageCaptchaService) Verify(ctx context.Context, captchaId, answer string) error {
	if captchaId == "" {
		return errors.New("验证码ID不能为空")
	}
	if answer == "" {
		return errors.New("请输入验证码")
	}

	cacheKey := captchaCachePrefix + captchaId
	storedAnswer, err := s.cacheSvc.Get(ctx, cacheKey)
	if err != nil {
		return errors.New("验证码验证失败，请重试")
	}

	if storedAnswer == "" {
		return errors.New("验证码已过期，请刷新重试")
	}

	if strings.ToLower(answer) != storedAnswer {
		_ = s.cacheSvc.Delete(ctx, cacheKey)
		return errors.New("验证码错误")
	}

	_ = s.cacheSvc.Delete(ctx, cacheKey)
	return nil
}

// getLength 获取验证码长度配置
func (s *imageCaptchaService) getLength() int {
	lengthStr := s.settingSvc.Get(constant.KeyImageCaptchaLength.String())
	length, err := strconv.Atoi(lengthStr)
	if err != nil || length < 1 || length > 10 {
		return 4 // 默认4位
	}
	return length
}

// getExpire 获取验证码过期时间配置（秒）
func (s *imageCaptchaService) getExpire() int {
	expireStr := s.settingSvc.Get(constant.KeyImageCaptchaExpire.String())
	expire, err := strconv.Atoi(expireStr)
	if err != nil || expire < 60 || expire > 3600 {
		return 300 // 默认300秒（5分钟）
	}
	return expire
}
