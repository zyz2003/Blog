// pkg/service/subscriber/service.go
package subscriber

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/subscriber"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"
	"github.com/redis/go-redis/v9"
)

// Service 订阅服务
type Service struct {
	db       *ent.Client
	rdb      *redis.Client
	emailSvc utility.EmailService
}

// NewService 创建订阅服务实例
func NewService(db *ent.Client, rdb *redis.Client, emailSvc utility.EmailService) *Service {
	return &Service{
		db:       db,
		rdb:      rdb,
		emailSvc: emailSvc,
	}
}

// generateToken 生成随机令牌
func generateToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// Subscribe 订阅博客
func (s *Service) Subscribe(ctx context.Context, email, code string) error {
	// 验证验证码
	if s.rdb != nil {
		key := fmt.Sprintf("subscribe:code:%s", email)
		savedCode, err := s.rdb.Get(ctx, key).Result()
		if err != nil {
			if err == redis.Nil {
				return errors.New("验证码已过期或无效")
			}
			log.Printf("[Subscriber.Subscribe] 获取验证码失败: %v", err)
			return errors.New("系统错误，请稍后重试")
		}
		if savedCode != code {
			return errors.New("验证码错误")
		}
		// 验证通过后删除验证码
		s.rdb.Del(ctx, key)
	}

	// 直接尝试查询该邮箱的订阅记录
	sub, err := s.db.Subscriber.Query().
		Where(subscriber.EmailEQ(email)).
		Only(ctx)

	if err != nil {
		if !ent.IsNotFound(err) {
			// 非"未找到"错误
			log.Printf("[Subscriber.Subscribe] 查询订阅者失败: %v", err)
			return errors.New("订阅失败，请稍后重试")
		}

		// 订阅记录不存在，创建新订阅
		token, err := generateToken()
		if err != nil {
			log.Printf("[Subscriber.Subscribe] 生成令牌失败: %v", err)
			return errors.New("订阅失败，请稍后重试")
		}

		_, err = s.db.Subscriber.Create().
			SetEmail(email).
			SetIsActive(true).
			SetToken(token).
			Save(ctx)
		if err != nil {
			log.Printf("[Subscriber.Subscribe] 创建订阅失败: %v", err)
			return errors.New("订阅失败，请稍后重试")
		}

		log.Printf("[Subscriber.Subscribe] 新订阅成功: %s", email)
		return nil
	}

	// 订阅记录已存在
	if sub.IsActive {
		return errors.New("该邮箱已订阅")
	}

	// 重新激活已退订的用户
	_, err = s.db.Subscriber.UpdateOne(sub).
		SetIsActive(true).
		Save(ctx)
	if err != nil {
		log.Printf("[Subscriber.Subscribe] 重新激活订阅失败: %v", err)
		return errors.New("订阅失败，请稍后重试")
	}

	log.Printf("[Subscriber.Subscribe] 重新激活订阅成功: %s", email)
	return nil
}

// Unsubscribe 取消订阅
func (s *Service) Unsubscribe(ctx context.Context, email string) error {
	sub, err := s.db.Subscriber.Query().
		Where(subscriber.EmailEQ(email)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return errors.New("订阅不存在")
		}
		log.Printf("[Subscriber.Unsubscribe] 查询订阅者失败: %v", err)
		return errors.New("退订失败，请稍后重试")
	}

	_, err = s.db.Subscriber.UpdateOne(sub).
		SetIsActive(false).
		Save(ctx)
	if err != nil {
		log.Printf("[Subscriber.Unsubscribe] 更新订阅状态失败: %v", err)
		return errors.New("退订失败，请稍后重试")
	}

	log.Printf("[Subscriber.Unsubscribe] 退订成功: %s", email)
	return nil
}

// UnsubscribeByToken 通过令牌取消订阅
func (s *Service) UnsubscribeByToken(ctx context.Context, token string) error {
	sub, err := s.db.Subscriber.Query().
		Where(subscriber.TokenEQ(token)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return errors.New("订阅不存在或令牌无效")
		}
		log.Printf("[Subscriber.UnsubscribeByToken] 查询订阅者失败: %v", err)
		return errors.New("退订失败，请稍后重试")
	}

	_, err = s.db.Subscriber.UpdateOne(sub).
		SetIsActive(false).
		Save(ctx)
	if err != nil {
		log.Printf("[Subscriber.UnsubscribeByToken] 更新订阅状态失败: %v", err)
		return errors.New("退订失败，请稍后重试")
	}

	log.Printf("[Subscriber.UnsubscribeByToken] 退订成功: %s", sub.Email)
	return nil
}

// GetActiveSubscribers 获取所有活跃订阅者
func (s *Service) GetActiveSubscribers(ctx context.Context) ([]*ent.Subscriber, error) {
	return s.db.Subscriber.Query().
		Where(subscriber.IsActiveEQ(true)).
		All(ctx)
}

// SendVerificationCode 发送验证码
func (s *Service) SendVerificationCode(ctx context.Context, email string) error {
	if s.rdb == nil {
		return errors.New("Redis未配置，无法使用验证码功能")
	}

	var buf [4]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return errors.New("生成验证码失败")
	}
	code := fmt.Sprintf("%06d", binary.BigEndian.Uint32(buf[:])%1000000)

	// 存入 Redis，有效期 5 分钟
	key := fmt.Sprintf("subscribe:code:%s", email)
	err := s.rdb.Set(ctx, key, code, 5*time.Minute).Err()
	if err != nil {
		log.Printf("[Subscriber.SendVerificationCode] 存储验证码失败: %v", err)
		return errors.New("发送验证码失败，请稍后重试")
	}

	// 发送邮件
	return s.emailSvc.SendVerificationEmail(ctx, email, code)
}

// NotifyArticlePublished 通知订阅者有新文章发布
func (s *Service) NotifyArticlePublished(ctx context.Context, article *model.Article) error {
	// 获取所有活跃订阅者
	subscribers, err := s.GetActiveSubscribers(ctx)
	if err != nil {
		log.Printf("[Subscriber.NotifyArticlePublished] 获取活跃订阅者失败: %v", err)
		return err
	}

	if len(subscribers) == 0 {
		log.Printf("[Subscriber.NotifyArticlePublished] 没有活跃订阅者，跳过通知")
		return nil
	}

	log.Printf("[Subscriber.NotifyArticlePublished] 准备向 %d 位订阅者发送文章推送: %s", len(subscribers), article.Title)

	// 异步逐个发送邮件
	go func() {
		bgCtx := context.Background()
		for _, sub := range subscribers {
			// 如果没有 token，生成一个临时的（这里假设数据库已有 token，或者是空）
			// 实际上应该在 Subscribe 时就生成 Token
			// 如果 Token 为空，可以跳过或者生成一个
			token := sub.Token
			if token == "" {
				// 简单的 fallback，实际生产环境应该确保 Token 存在
				token = "invalid-token"
			}

			if err := s.emailSvc.SendArticlePushEmail(bgCtx, sub.Email, token, article); err != nil {
				log.Printf("[Subscriber.NotifyArticlePublished] 发送邮件给 %s 失败: %v", sub.Email, err)
			}
			// 稍微延时，避免瞬间并发过高触发 SMTP 限制
			time.Sleep(100 * time.Millisecond)
		}
	}()

	return nil
}
