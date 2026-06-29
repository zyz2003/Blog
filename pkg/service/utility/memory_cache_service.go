/*
 * @Description: 内存缓存服务实现（用于 Redis 不可用时的降级方案）
 * @Author: 安知鱼
 * @Date: 2025-10-05 00:00:00
 * @LastEditTime: 2025-10-05 20:45:43
 * @LastEditors: 安知鱼
 */
package utility

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

// cacheItem 缓存项结构
type cacheItem struct {
	value      string
	expiration time.Time
	hasExpiry  bool
}

// isExpired 检查是否过期
func (item *cacheItem) isExpired() bool {
	if !item.hasExpiry {
		return false
	}
	return time.Now().After(item.expiration)
}

// memoryCacheService 是基于内存的缓存服务实现
type memoryCacheService struct {
	data   sync.Map
	ticker *time.Ticker
	done   chan bool
}

// NewMemoryCacheService 创建内存缓存服务实例
func NewMemoryCacheService() CacheService {
	svc := &memoryCacheService{
		ticker: time.NewTicker(1 * time.Minute), // 每分钟清理一次过期数据
		done:   make(chan bool),
	}

	// 启动后台清理任务
	go svc.cleanupExpired()

	return svc
}

// cleanupExpired 定期清理过期的缓存项
func (s *memoryCacheService) cleanupExpired() {
	for {
		select {
		case <-s.ticker.C:
			s.data.Range(func(key, value interface{}) bool {
				if item, ok := value.(*cacheItem); ok {
					if item.isExpired() {
						s.data.Delete(key)
					}
				}
				return true
			})
		case <-s.done:
			return
		}
	}
}

// Stop 停止清理任务
func (s *memoryCacheService) Stop() {
	s.ticker.Stop()
	s.done <- true
}

// Set 设置缓存
func (s *memoryCacheService) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	item := &cacheItem{
		value:     fmt.Sprintf("%v", value),
		hasExpiry: expiration > 0,
	}

	if expiration > 0 {
		item.expiration = time.Now().Add(expiration)
	}

	s.data.Store(key, item)
	return nil
}

// Get 获取缓存
func (s *memoryCacheService) Get(ctx context.Context, key string) (string, error) {
	value, ok := s.data.Load(key)
	if !ok {
		return "", nil // Key 不存在，返回空字符串
	}

	item, ok := value.(*cacheItem)
	if !ok {
		return "", nil
	}

	// 检查是否过期
	if item.isExpired() {
		s.data.Delete(key)
		return "", nil
	}

	return item.value, nil
}

// Delete 删除缓存
func (s *memoryCacheService) Delete(ctx context.Context, keys ...string) error {
	for _, key := range keys {
		s.data.Delete(key)
	}
	return nil
}

// Del 删除缓存（别名，保持兼容性）
func (s *memoryCacheService) Del(ctx context.Context, keys ...string) error {
	return s.Delete(ctx, keys...)
}

// Increment 原子地增加一个键的值
func (s *memoryCacheService) Increment(ctx context.Context, key string) (int64, error) {
	// 使用 LoadOrStore 来实现原子操作
	for {
		value, loaded := s.data.LoadOrStore(key, &cacheItem{
			value:     "1",
			hasExpiry: false,
		})

		item := value.(*cacheItem)

		if !loaded {
			// 新创建的键，值为 1
			return 1, nil
		}

		// 检查是否过期
		if item.isExpired() {
			s.data.Store(key, &cacheItem{
				value:     "1",
				hasExpiry: false,
			})
			return 1, nil
		}

		// 解析当前值
		var currentVal int64
		fmt.Sscanf(item.value, "%d", &currentVal)
		newVal := currentVal + 1

		// 尝试更新
		newItem := &cacheItem{
			value:      fmt.Sprintf("%d", newVal),
			expiration: item.expiration,
			hasExpiry:  item.hasExpiry,
		}

		if s.data.CompareAndSwap(key, value, newItem) {
			return newVal, nil
		}
		// CAS 失败，重试
	}
}

// Expire 设置键的过期时间
func (s *memoryCacheService) Expire(ctx context.Context, key string, expiration time.Duration) error {
	value, ok := s.data.Load(key)
	if !ok {
		return fmt.Errorf("key not found")
	}

	item, ok := value.(*cacheItem)
	if !ok {
		return fmt.Errorf("invalid cache item")
	}

	newItem := &cacheItem{
		value:      item.value,
		expiration: time.Now().Add(expiration),
		hasExpiry:  true,
	}

	s.data.Store(key, newItem)
	return nil
}

// Scan 查找匹配的键（简单实现，支持 * 通配符）
func (s *memoryCacheService) Scan(ctx context.Context, pattern string) ([]string, error) {
	var keys []string

	// 将 Redis 风格的通配符转换为 Go 的字符串匹配
	// 简化实现：只支持 * 通配符
	s.data.Range(func(key, value interface{}) bool {
		keyStr := key.(string)
		if matchPattern(keyStr, pattern) {
			if item, ok := value.(*cacheItem); ok {
				if !item.isExpired() {
					keys = append(keys, keyStr)
				}
			}
		}
		return true
	})

	return keys, nil
}

// matchPattern 简单的模式匹配（支持 * 通配符）
func matchPattern(s, pattern string) bool {
	// 如果没有通配符，直接比较
	if !strings.Contains(pattern, "*") {
		return s == pattern
	}

	// 将模式分割成多个部分
	parts := strings.Split(pattern, "*")

	// 检查开头
	if len(parts[0]) > 0 && !strings.HasPrefix(s, parts[0]) {
		return false
	}

	// 检查结尾
	if len(parts[len(parts)-1]) > 0 && !strings.HasSuffix(s, parts[len(parts)-1]) {
		return false
	}

	// 检查中间部分
	idx := 0
	for i, part := range parts {
		if part == "" {
			continue
		}

		pos := strings.Index(s[idx:], part)
		if pos == -1 {
			return false
		}

		if i == 0 && pos != 0 {
			return false
		}

		idx += pos + len(part)
	}

	return true
}

// GetAndDeleteMany 获取多个键的值并删除它们
func (s *memoryCacheService) GetAndDeleteMany(ctx context.Context, keys []string) (map[string]int, error) {
	results := make(map[string]int)

	for _, key := range keys {
		value, ok := s.data.LoadAndDelete(key)
		if !ok {
			continue
		}

		item, ok := value.(*cacheItem)
		if !ok {
			continue
		}

		// 检查是否过期
		if item.isExpired() {
			continue
		}

		// 解析值
		var intVal int
		if _, err := fmt.Sscanf(item.value, "%d", &intVal); err == nil {
			results[key] = intVal
		}
	}

	return results, nil
}

// RPush 向列表右侧添加元素（简化实现，使用逗号分隔的字符串）
func (s *memoryCacheService) RPush(ctx context.Context, key string, values ...interface{}) error {
	var strValues []string
	for _, v := range values {
		strValues = append(strValues, fmt.Sprintf("%v", v))
	}

	value, ok := s.data.Load(key)
	if !ok {
		// 新建列表
		item := &cacheItem{
			value:     strings.Join(strValues, "\n"),
			hasExpiry: false,
		}
		s.data.Store(key, item)
		return nil
	}

	item := value.(*cacheItem)
	if item.isExpired() {
		// 过期了，重新创建
		item = &cacheItem{
			value:     strings.Join(strValues, "\n"),
			hasExpiry: false,
		}
		s.data.Store(key, item)
		return nil
	}

	// 追加到现有列表
	var existingValues []string
	if item.value != "" {
		existingValues = strings.Split(item.value, "\n")
	}
	existingValues = append(existingValues, strValues...)

	newItem := &cacheItem{
		value:      strings.Join(existingValues, "\n"),
		expiration: item.expiration,
		hasExpiry:  item.hasExpiry,
	}
	s.data.Store(key, newItem)

	return nil
}

// LLen 获取列表长度
func (s *memoryCacheService) LLen(ctx context.Context, key string) (int64, error) {
	value, ok := s.data.Load(key)
	if !ok {
		return 0, nil
	}

	item := value.(*cacheItem)
	if item.isExpired() {
		s.data.Delete(key)
		return 0, nil
	}

	if item.value == "" {
		return 0, nil
	}

	return int64(len(strings.Split(item.value, "\n"))), nil
}

// LIndex 获取列表指定位置元素
func (s *memoryCacheService) LIndex(ctx context.Context, key string, index int64) (string, error) {
	value, ok := s.data.Load(key)
	if !ok {
		return "", nil
	}

	item := value.(*cacheItem)
	if item.isExpired() {
		s.data.Delete(key)
		return "", nil
	}

	if item.value == "" {
		return "", nil
	}

	values := strings.Split(item.value, "\n")
	if index < 0 || index >= int64(len(values)) {
		return "", nil
	}

	return values[index], nil
}

// LRange 获取列表指定范围元素
func (s *memoryCacheService) LRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	value, ok := s.data.Load(key)
	if !ok {
		return []string{}, nil
	}

	item := value.(*cacheItem)
	if item.isExpired() {
		s.data.Delete(key)
		return []string{}, nil
	}

	if item.value == "" {
		return []string{}, nil
	}

	values := strings.Split(item.value, "\n")
	length := int64(len(values))

	// 处理负数索引
	if start < 0 {
		start = length + start
	}
	if stop < 0 {
		stop = length + stop
	}

	// 边界检查
	if start < 0 {
		start = 0
	}
	if stop >= length {
		stop = length - 1
	}
	if start > stop || start >= length {
		return []string{}, nil
	}

	return values[start : stop+1], nil
}

// SAdd 向 Set 集合中添加成员（内存缓存实现）
// 返回成功添加的新成员数量（已存在的成员不会被重复添加，返回0）
func (s *memoryCacheService) SAdd(ctx context.Context, key string, members ...interface{}) (int64, error) {
	// 将成员转换为字符串
	var memberStrs []string
	for _, m := range members {
		memberStrs = append(memberStrs, fmt.Sprintf("%v", m))
	}

	value, ok := s.data.Load(key)
	if !ok {
		// 新建集合
		item := &cacheItem{
			value:     strings.Join(memberStrs, "\n"),
			hasExpiry: false,
		}
		s.data.Store(key, item)
		return int64(len(memberStrs)), nil
	}

	item := value.(*cacheItem)
	if item.isExpired() {
		// 过期了，重新创建
		item = &cacheItem{
			value:     strings.Join(memberStrs, "\n"),
			hasExpiry: false,
		}
		s.data.Store(key, item)
		return int64(len(memberStrs)), nil
	}

	// 获取现有成员集合
	existingMembers := make(map[string]bool)
	if item.value != "" {
		for _, member := range strings.Split(item.value, "\n") {
			existingMembers[member] = true
		}
	}

	// 统计新增的成员数
	newCount := int64(0)
	for _, member := range memberStrs {
		if !existingMembers[member] {
			existingMembers[member] = true
			newCount++
		}
	}

	// 如果没有新成员，直接返回
	if newCount == 0 {
		return 0, nil
	}

	// 更新集合
	var allMembers []string
	for member := range existingMembers {
		allMembers = append(allMembers, member)
	}

	newItem := &cacheItem{
		value:      strings.Join(allMembers, "\n"),
		expiration: item.expiration,
		hasExpiry:  item.hasExpiry,
	}
	s.data.Store(key, newItem)

	return newCount, nil
}
