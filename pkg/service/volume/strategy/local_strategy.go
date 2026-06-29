/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-15 14:34:12
 * @LastEditTime: 2025-07-15 19:04:48
 * @LastEditors: 安知鱼
 */
package strategy

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

type localStrategy struct{}

func NewLocalStrategy() IPolicyTypeStrategy {
	return &localStrategy{}
}

func (s *localStrategy) ValidateSettings(settings map[string]interface{}) error {
	return nil
}

// GetAuthHandler 本地策略没有授权流程，返回 nil
func (s *localStrategy) GetAuthHandler() IPolicyAuthHandler {
	return nil
}

func (s *localStrategy) BeforeDelete(ctx context.Context, policy *model.StoragePolicy) error {
	// 本地策略删除前无需特殊操作
	return nil
}
