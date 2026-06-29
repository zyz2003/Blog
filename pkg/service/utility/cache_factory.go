/*
 * @Description: 智能缓存工厂，自动选择 Redis 或内存缓存
 * @Author: 安知鱼
 * @Date: 2025-10-05 00:00:00
 * @LastEditTime: 2025-10-05 00:00:00
 * @LastEditors: 安知鱼
 */
package utility

import (
	"context"
	"log"

	"github.com/redis/go-redis/v9"
)

// NewCacheServiceWithFallback 创建带有自动降级功能的缓存服务
// 如果 redisClient 为 nil，自动降级到内存缓存
func NewCacheServiceWithFallback(redisClient *redis.Client) CacheService {
	if redisClient == nil {
		log.Println("🔄 使用内存缓存服务（Memory Cache）")
		return NewMemoryCacheService()
	}

	// 尝试 ping Redis 确保可用
	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("⚠️  Redis 不可用: %v，降级到内存缓存", err)
		return NewMemoryCacheService()
	}

	log.Println("✅ 使用 Redis 缓存服务")
	return NewCacheService(redisClient)
}

// CacheServiceType 缓存服务类型
type CacheServiceType string

const (
	CacheTypeRedis  CacheServiceType = "redis"
	CacheTypeMemory CacheServiceType = "memory"
)

// GetCacheServiceType 获取当前使用的缓存类型
func GetCacheServiceType(svc CacheService) CacheServiceType {
	switch svc.(type) {
	case *redisCacheService:
		return CacheTypeRedis
	case *memoryCacheService:
		return CacheTypeMemory
	default:
		return CacheTypeMemory
	}
}
