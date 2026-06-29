/*
 * @Description: 配置导入导出扩展接口（供 Pro 等实现支付配置等扩展数据的导出/导入）
 * @Author: 安知鱼
 */
package config

import "context"

// PaymentConfigExportItem 支付配置导出项（与具体实现解耦，仅用于序列化）
type PaymentConfigExportItem struct {
	Provider   string `json:"provider"`
	IsEnabled  bool   `json:"is_enabled"`
	ConfigData string `json:"config_data"`
	AppID      string `json:"app_id,omitempty"`
	Description string `json:"description,omitempty"`
}

// ConfigExportImportExtension 配置导出/导入扩展接口
// 由 Pro 版实现，用于在系统设置导出/导入时一并处理支付配置（payment_config 表）
type ConfigExportImportExtension interface {
	// ExportPayment 导出支付配置列表（如无则为 nil）
	ExportPayment(ctx context.Context) ([]PaymentConfigExportItem, error)
	// ImportPayment 导入支付配置列表
	ImportPayment(ctx context.Context, items []PaymentConfigExportItem) error
}
