package thumbnail

import (
	"context"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// Result 是生成器成功处理后返回的结果。
type Result struct {
	// GeneratorName 是生成器的名称 (例如 "builtin", "ffmpeg", "svg")。
	GeneratorName string
	// IsDirectServe 标志着原始文件应该被直接用作缩略图（例如SVG文件），
	// 而不是去查找一个生成的缓存文件。
	IsDirectServe bool
	Format        string
}

// Generator 定义了所有预览/缩略图生成器的通用接口。
type Generator interface {
	// CanHandle 判断此生成器是否能处理给定的文件。
	CanHandle(ctx context.Context, file *model.File) bool

	// Generate 执行生成操作，并返回结果。
	// 对于非直接服务的生成器，此方法必须将生成的缩略图保存到由 publicID 推断出的可预测缓存路径。
	Generate(
		ctx context.Context,
		file *model.File,
		sourcePath string,
		ownerPublicID string,
		filePublicID string,
		virtualParentPath string,
	) (*Result, error)
}
