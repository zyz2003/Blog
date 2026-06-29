/*
 * @Description: Redis 缓存服务
 * @Author: 安知鱼
 * @Date: 2025-06-20 15:17:47
 * @LastEditTime: 2025-10-26 20:57:56
 * @LastEditors: 安知鱼
 */
package utility

import (
	"context"
	"log"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// CacheService 定义了缓存服务的接口，提供了基础的 Get/Set/Delete 操作
type CacheService interface {
	Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error
	Get(ctx context.Context, key string) (string, error)
	Delete(ctx context.Context, key ...string) error
	// Increment 原子地增加一个键的值
	Increment(ctx context.Context, key string) (int64, error)
	// Expire 设置键的过期时间
	Expire(ctx context.Context, key string, expiration time.Duration) error
	// Scan 使用 SCAN 命令安全地查找匹配的键
	Scan(ctx context.Context, pattern string) ([]string, error)
	// GetAndDeleteMany 使用 Pipeline 高效地获取多个键的值并删除它们
	GetAndDeleteMany(ctx context.Context, keys []string) (map[string]int, error)

	// Redis List 操作（用于高并发批量处理）
	RPush(ctx context.Context, key string, values ...interface{}) error
	LLen(ctx context.Context, key string) (int64, error)
	LIndex(ctx context.Context, key string, index int64) (string, error)
	LRange(ctx context.Context, key string, start, stop int64) ([]string, error)
	Del(ctx context.Context, keys ...string) error

	// Redis Set 操作（用于去重统计）
	SAdd(ctx context.Context, key string, members ...interface{}) (int64, error)
}

// redisCacheService 是 CacheService 的 Redis 实现
type redisCacheService struct {
	client *redis.Client
}

// NewCacheService 是 redisCacheService 的构造函数，通过依赖注入接收 Redis 客户端
func NewCacheService(client *redis.Client) CacheService {
	return &redisCacheService{
		client: client,
	}
}

// Expire 实现了设置键的过期时间
func (s *redisCacheService) Expire(ctx context.Context, key string, expiration time.Duration) error {
	return s.client.Expire(ctx, key, expiration).Err()
}

// Set 实现了设置缓存的方法
func (s *redisCacheService) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return s.client.Set(ctx, key, value, expiration).Err()
}

// Get 实现了获取缓存的方法
func (s *redisCacheService) Get(ctx context.Context, key string) (string, error) {
	val, err := s.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", nil // Key 不存在，返回空字符串和 nil 错误，这是 Redis 的惯例
	}
	return val, err
}

// Delete 实现了删除缓存的方法
func (s *redisCacheService) Delete(ctx context.Context, key ...string) error {
	return s.client.Del(ctx, key...).Err()
}

// Del 实现了删除缓存的方法（别名，保持兼容性）
func (s *redisCacheService) Del(ctx context.Context, keys ...string) error {
	return s.client.Del(ctx, keys...).Err()
}

// RPush 实现了向列表右侧添加元素的方法
func (s *redisCacheService) RPush(ctx context.Context, key string, values ...interface{}) error {
	return s.client.RPush(ctx, key, values...).Err()
}

// LLen 实现了获取列表长度的方法
func (s *redisCacheService) LLen(ctx context.Context, key string) (int64, error) {
	return s.client.LLen(ctx, key).Result()
}

// LIndex 实现了获取列表指定位置元素的方法
func (s *redisCacheService) LIndex(ctx context.Context, key string, index int64) (string, error) {
	return s.client.LIndex(ctx, key, index).Result()
}

// LRange 实现了获取列表指定范围元素的方法
func (s *redisCacheService) LRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	return s.client.LRange(ctx, key, start, stop).Result()
}

// Increment 实现了原子递增
func (s *redisCacheService) Increment(ctx context.Context, key string) (int64, error) {
	return s.client.Incr(ctx, key).Result()
}

// Scan 使用 SCAN 命令安全地遍历所有匹配的键，避免了在生产环境中使用 KEYS 命令。
func (s *redisCacheService) Scan(ctx context.Context, pattern string) ([]string, error) {
	var allKeys []string
	var cursor uint64
	for {
		keys, nextCursor, err := s.client.Scan(ctx, cursor, pattern, 100).Result() // 每次扫描100个
		if err != nil {
			return nil, err
		}
		allKeys = append(allKeys, keys...)
		if nextCursor == 0 { // 遍历完成
			break
		}
		cursor = nextCursor
	}
	return allKeys, nil
}

// GetAndDeleteMany 使用 pipeline 来原子性地获取并删除多个键。
// 返回一个 map，键是原始 key，值是获取到的计数值。
func (s *redisCacheService) GetAndDeleteMany(ctx context.Context, keys []string) (map[string]int, error) {
	if len(keys) == 0 {
		return nil, nil
	}

	pipe := s.client.Pipeline()
	cmds := make(map[string]*redis.StringCmd)

	// 1. 在 pipeline 中为每个 key 添加一个 GET 命令
	for _, key := range keys {
		cmds[key] = pipe.Get(ctx, key)
	}
	// 2. 在 pipeline 中添加一个 DEL 命令来删除所有这些 key
	pipe.Del(ctx, keys...)

	// 3. 执行 pipeline
	_, err := pipe.Exec(ctx)
	if err != nil && err != redis.Nil {
		return nil, err
	}

	// 4. 从命令结果中解析计数值
	results := make(map[string]int)
	for key, cmd := range cmds {
		valStr, err := cmd.Result()
		if err == nil {
			valInt, convErr := strconv.Atoi(valStr)
			if convErr == nil {
				results[key] = valInt
			} else {
				log.Printf("警告: 无法将 Redis 值 '%s' (key: %s) 转换为整数: %v", valStr, key, convErr)
			}
		}
	}
	return results, nil
}

// SAdd 实现了向 Set 集合中添加成员的方法
// 返回成功添加的新成员数量（已存在的成员不会被重复添加，返回0）
func (s *redisCacheService) SAdd(ctx context.Context, key string, members ...interface{}) (int64, error) {
	return s.client.SAdd(ctx, key, members...).Result()
}
