/*
 * @Description: 存储策略管理器的实现
 * @Author: 安知鱼
 * @Date: 2025-07-15 16:05:00
 * @LastEditors: 安知鱼
 */
package strategy

import (
	"fmt"
	"sync"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
)

// Manager 负责管理所有 IPolicyTypeStrategy 的实例。
// 这是一个单例，在应用启动时创建并注册所有策略。
type Manager struct {
	strategies map[constant.StoragePolicyType]IPolicyTypeStrategy
	mu         sync.RWMutex
}

// NewManager 创建一个新的策略管理器
func NewManager() *Manager {
	return &Manager{
		strategies: make(map[constant.StoragePolicyType]IPolicyTypeStrategy),
	}
}

// Register 注册一个具体策略处理器
func (m *Manager) Register(policyType constant.StoragePolicyType, strategy IPolicyTypeStrategy) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.strategies[policyType] = strategy
}

// Get 获取指定类型的策略处理器
func (m *Manager) Get(policyType constant.StoragePolicyType) (IPolicyTypeStrategy, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	strategy, ok := m.strategies[policyType]
	if !ok {
		return nil, fmt.Errorf("不支持的存储策略类型: %s", policyType)
	}
	return strategy, nil
}
