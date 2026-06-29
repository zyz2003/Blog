/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-14 01:41:43
 * @LastEditTime: 2025-08-06 10:13:11
 * @LastEditors: 安知鱼
 */
package utility

import "sync"

// PathLocker 提供了一个基于字符串键（例如，文件路径）的锁机制。
// 它能确保对同一个路径的耗时操作（如目录同步）不会被并发执行。
type PathLocker struct {
	mu    sync.Mutex
	locks map[string]*sync.Mutex
}

// NewPathLocker 创建一个新的 PathLocker 实例。
func NewPathLocker() *PathLocker {
	return &PathLocker{
		locks: make(map[string]*sync.Mutex),
	}
}

// Lock 为给定的路径获取一个锁。
// 如果另一个goroutine已经持有了该路径的锁，当前goroutine将会阻塞等待，直到锁被释放。
func (l *PathLocker) Lock(path string) {
	l.mu.Lock()
	// 检查此路径是否已经有关联的锁
	lock, ok := l.locks[path]
	if !ok {
		// 如果没有，则创建一个新的互斥锁并存入map
		lock = &sync.Mutex{}
		l.locks[path] = lock
	}
	l.mu.Unlock()

	// 获取此路径专用的锁
	lock.Lock()
}

// Unlock 释放给定路径的锁。
func (l *PathLocker) Unlock(path string) {
	l.mu.Lock()
	if lock, ok := l.locks[path]; ok {
		lock.Unlock()
	}
	// 为避免map无限增长，在实际生产系统中可能需要一个清理策略，
	// 但对于当前场景，保持mutex实例以避免重复分配是可接受的。
	l.mu.Unlock()
}
