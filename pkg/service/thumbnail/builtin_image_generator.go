// internal/app/service/thumbnail/builtin_image_generator.go

/*
 * @Description: 使用 Go 原生库处理标准图片的缩略图生成器。
 *               现在它既能为传统图片生成缩略图，也能为现代图片（如AVIF）提供“直接服务”的降级方案。
 * @Author: 安知鱼
 * @Date: 2025-07-12 16:09:46
 * @LastEditTime: 2025-07-31 09:51:42
 * @LastEditors: 安知鱼
 */
package thumbnail

import (
	"context"
	"fmt"
	"log"
	"path/filepath"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"

	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"github.com/disintegration/imaging"

	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/webp"
)

// BuiltinImageGenerator 使用纯Go库处理图片，作为备用生成器。
type BuiltinImageGenerator struct {
	cachePath       string
	maxSize         int64
	directServeExts map[string]bool // 用于快速查找需要直出的扩展名
	processableExts map[string]bool // 用于快速查找可以解码和处理的扩展名
}

// NewBuiltinImageGenerator 是 BuiltinImageGenerator 的构造函数。
// directServeExts 参数定义了哪些文件类型应被直接提供，而不是尝试解码。
func NewBuiltinImageGenerator(cachePath string, maxSize int64, directServeExts []string) Generator {
	serveExtsMap := make(map[string]bool)
	for _, ext := range directServeExts {
		if !strings.HasPrefix(ext, ".") {
			ext = "." + ext
		}
		serveExtsMap[strings.ToLower(ext)] = true
	}

	return &BuiltinImageGenerator{
		cachePath:       cachePath,
		maxSize:         maxSize,
		directServeExts: serveExtsMap,
		// 定义此生成器实际可以解码和处理的扩展名
		processableExts: map[string]bool{
			".jpg":  true,
			".jpeg": true,
			".png":  true,
			".gif":  true,
			".webp": true, // imaging 库支持 webp 解码
			".bmp":  true,
		},
	}
}

// CanHandle 检查文件是否为支持的格式（无论是转换还是直出）。
func (g *BuiltinImageGenerator) CanHandle(ctx context.Context, file *model.File) bool {
	if g.maxSize > 0 && file.Size > g.maxSize {
		return false
	}

	ext := strings.ToLower(filepath.Ext(file.Name))

	// 检查是否为直出格式或可处理格式
	if g.directServeExts[ext] || g.processableExts[ext] {
		return true
	}

	return false
}

// Generate 执行缩略图生成或决定直接服务。
func (g *BuiltinImageGenerator) Generate(
	ctx context.Context,
	file *model.File,
	sourcePath string,
	ownerPublicID string,
	filePublicID string,
	virtualParentPath string,
) (*Result, error) {
	ext := strings.ToLower(filepath.Ext(file.Name))

	if g.directServeExts[ext] {
		log.Printf("[BuiltinGenerator] 文件 %s (ID: %d) 类型 %s 支持直出，将直接使用原图。", file.Name, file.ID, ext)
		return &Result{
			GeneratorName: "builtin-direct-serve",
			IsDirectServe: true,
			Format:        strings.TrimPrefix(ext, "."),
		}, nil
	}

	log.Printf("[BuiltinGenerator] 文件 %s (ID: %d) 将通过imaging库生成缩略图...", file.Name, file.ID)

	// 打开并解码源图片，自动处理方向（例如手机拍摄的照片）
	srcImage, err := imaging.Open(sourcePath, imaging.AutoOrientation(true))
	if err != nil {
		// imaging 不支持 avif, 所以如果配置错误，这里会失败。这是预期的行为。
		return nil, fmt.Errorf("使用imaging库打开或解码图片 '%s' 失败: %w", file.Name, err)
	}

	// 将图片缩放至统一宽度为400，高度按比例自适应
	thumbnail := imaging.Resize(srcImage, 400, 0, imaging.Lanczos)

	// 统一将缩略图输出为 JPEG 格式
	const outputFormat = "jpeg"
	cacheFileName := GenerateCacheName(ownerPublicID, filePublicID, outputFormat)
	cacheFullPath, err := GetCachePath(g.cachePath, virtualParentPath, cacheFileName)
	if err != nil {
		return nil, fmt.Errorf("为内置生成器构建缓存路径失败: %w", err)
	}

	// 将生成的缩略图保存到磁盘
	err = imaging.Save(thumbnail, cacheFullPath, imaging.JPEGQuality(80))
	if err != nil {
		return nil, fmt.Errorf("使用imaging库保存JPEG缩略图失败: %w", err)
	}

	// 成功后，返回结果
	return &Result{
		GeneratorName: "builtin-resized",
		IsDirectServe: false,
		Format:        outputFormat,
	}, nil
}
