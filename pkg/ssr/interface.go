/*
 * SSR 主题管理器接口定义
 * 供 ThemeService 调用，实现主题状态的统一管理
 */
package ssr

// ManagerInterface SSR 主题管理器接口
// 定义 SSR 主题的核心操作，供其他服务调用
type ManagerInterface interface {
	// Start 启动 SSR 主题
	// themeName: 主题名称
	// port: 运行端口
	Start(themeName string, port int) error

	// Stop 停止 SSR 主题
	// themeName: 主题名称
	Stop(themeName string) error

	// GetStatus 获取主题状态
	// themeName: 主题名称
	// 返回主题的详细状态信息
	GetStatus(themeName string) ThemeInfo

	// IsRunning 检查主题是否正在运行
	// themeName: 主题名称
	IsRunning(themeName string) bool

	// ListRunning 列出所有正在运行的主题
	// 返回主题名称列表
	ListRunning() []string

	// StopAll 停止所有运行中的主题
	StopAll() error
}

// 确保 Manager 实现了 ManagerInterface 接口
var _ ManagerInterface = (*Manager)(nil)
