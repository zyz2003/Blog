// pkg/service/parser/cache.go
package parser

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"
)

// cacheEntry 缓存条目
type cacheEntry struct {
	value     string
	createdAt time.Time
}

// LRUCache 一个线程安全的 LRU 缓存实现
type LRUCache struct {
	mu       sync.RWMutex
	capacity int
	ttl      time.Duration
	cache    map[string]*cacheEntry
	order    []string // 简单的访问顺序记录
}

// NewLRUCache 创建新的 LRU 缓存
func NewLRUCache(capacity int, ttl time.Duration) *LRUCache {
	return &LRUCache{
		capacity: capacity,
		ttl:      ttl,
		cache:    make(map[string]*cacheEntry),
		order:    make([]string, 0, capacity),
	}
}

// computeCacheKey 使用 SHA256 计算缓存键
// SHA256 碰撞概率极低，适用于缓存场景
func computeCacheKey(content string) string {
	hash := sha256.Sum256([]byte(content))
	return hex.EncodeToString(hash[:])
}

// Get 从缓存获取值，如果存在且未过期则返回
func (c *LRUCache) Get(key string) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, exists := c.cache[key]
	if !exists {
		return "", false
	}

	// 检查是否过期
	if c.ttl > 0 && time.Since(entry.createdAt) > c.ttl {
		// 过期了，删除并返回不存在
		delete(c.cache, key)
		c.removeFromOrder(key)
		return "", false
	}

	// 更新访问顺序（移到末尾）- 真正的 LRU 行为
	c.moveToEnd(key)

	return entry.value, true
}

// Set 设置缓存值
func (c *LRUCache) Set(key, value string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 如果已存在，更新值和时间
	if _, exists := c.cache[key]; exists {
		c.cache[key] = &cacheEntry{
			value:     value,
			createdAt: time.Now(),
		}
		c.moveToEnd(key)
		return
	}

	// 如果达到容量上限，淘汰最旧的
	if len(c.cache) >= c.capacity && len(c.order) > 0 {
		oldest := c.order[0]
		c.order = c.order[1:]
		delete(c.cache, oldest)
	}

	// 添加新条目
	c.cache[key] = &cacheEntry{
		value:     value,
		createdAt: time.Now(),
	}
	c.order = append(c.order, key)
}

// Clear 清空缓存
func (c *LRUCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = make(map[string]*cacheEntry)
	c.order = make([]string, 0, c.capacity)
}

// Size 返回当前缓存大小
func (c *LRUCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.cache)
}

// moveToEnd 将 key 移动到 order 末尾（需要在持有锁的情况下调用）
func (c *LRUCache) moveToEnd(key string) {
	// 查找并删除
	for i, k := range c.order {
		if k == key {
			c.order = append(c.order[:i], c.order[i+1:]...)
			break
		}
	}
	// 添加到末尾
	c.order = append(c.order, key)
}

// removeFromOrder 从 order 中删除 key（需要在持有锁的情况下调用）
func (c *LRUCache) removeFromOrder(key string) {
	for i, k := range c.order {
		if k == key {
			c.order = append(c.order[:i], c.order[i+1:]...)
			return
		}
	}
}
