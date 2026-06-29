/*
 * @Description: 定义了存储策略模式的核心接口
 * @Author: 安知鱼
 * @Date: 2025-07-15 16:00:00
 * @LastEditors: 安知鱼
 */
package strategy

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// IPolicyAuthHandler 定义了需要 OAuth2.0 授权流程的策略所独有的行为。
// 对于不需要授权的策略（如 Local, S3），可以不实现此接口。
type IPolicyAuthHandler interface {
	// GenerateAuthURL 根据策略配置生成第三方授权URL。
	GenerateAuthURL(ctx context.Context, policy *model.StoragePolicy, siteURL string) (string, error)

	// FinalizeAuth 使用授权服务回调的 code 完成最终的 token 交换。
	// 这个方法会直接修改传入的 policy 对象的 settings 和 status，
	// 由上层服务负责最后的持久化。
	FinalizeAuth(ctx context.Context, policy *model.StoragePolicy, code string, siteURL string) error
}

// IPolicyTypeStrategy 定义了每种存储策略类型必须实现的核心策略接口。
type IPolicyTypeStrategy interface {
	// ValidateSettings 在创建或更新策略时，验证其 `settings` 字段是否合法。
	ValidateSettings(settings map[string]interface{}) error

	// GetAuthHandler 返回该策略的授权处理器。如果该策略不需要授权流程，则返回 nil。
	GetAuthHandler() IPolicyAuthHandler

	// BeforeDelete 是一个钩子，在删除策略前执行任何必要的清理工作（例如撤销云端授权）。
	BeforeDelete(ctx context.Context, policy *model.StoragePolicy) error
}
