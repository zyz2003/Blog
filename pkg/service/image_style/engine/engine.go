/*
 * @Description: 图片样式处理引擎统一接口
 * @Author: 安知鱼
 *
 * 对应规范 §6.3。
 * 引擎层分为两种实现：
 *   - nativego.go：纯 Go 实现，支持 JPEG/PNG（Phase 1 默认）
 *   - vips.go：vips CLI 实现，支持全格式（Phase 2 接入）
 * AutoEngine 在启动时通过 probe.go 自动选择合适的引擎，失败时降级。
 */
package engine

import (
	"context"
	"errors"
	"io"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// ErrFormatUnsupported 表示引擎不支持请求的输出格式。
// 该错误仅用于引擎内部与 AutoEngine 之间的协商，不会直接暴露给 HTTP 响应。
// Service 层捕获后会按 Spec §6.3.3 降级表重试。
var ErrFormatUnsupported = errors.New("output format not supported by current engine")

// Engine 抽象了图片样式处理能力。
// 实现必须是并发安全的（可能被多个 goroutine 同时调用 Process）。
type Engine interface {
	// Name 返回引擎的人类可读标识，用于日志与启动诊断。
	Name() string

	// Process 执行样式处理：从 src 读取原图，按 style 配置处理后写入 dst。
	// 返回输出的 MIME 类型（如 "image/webp"）。若格式不受支持，返回 ErrFormatUnsupported。
	// 注意：src 应可重复读取（典型地，Service 层会传 *bytes.Reader），以便读 EXIF 与解码。
	Process(ctx context.Context, src io.Reader, style model.ImageStyleConfig, dst io.Writer) (mime string, err error)

	// SupportedInputFormats 返回引擎能解码的文件扩展名列表（小写，不含点）。
	SupportedInputFormats() []string

	// SupportedOutputFormats 返回引擎能编码的格式列表（小写，不含点）。
	SupportedOutputFormats() []string
}

// VipsCapability 描述启动时对 vips CLI 的探测结果。
// Phase 1 仅返回 Available: false；Phase 2 Task 2.1 再真实探测。
type VipsCapability struct {
	Available      bool
	BinaryPath     string
	Version        string
	InputFormats   []string
	OutputFormats  []string
}
