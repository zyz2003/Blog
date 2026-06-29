/*
 * @Description: 直接服务SVG文件的“生成器”，它不实际生成文件，只进行标识。
 * @Author: 安知鱼
 * @Date: 2025-07-10 15:04:17
 * @LastEditTime: 2025-07-18 18:27:30
 * @LastEditors: 安知鱼
 */
package thumbnail

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// SVGGenerator 是一个特殊的生成器，它不创建缩略图。
// 它的作用是识别SVG文件，并将其标记为应直接提供服务。
type SVGGenerator struct{}

// NewSVGGenerator 创建一个新的 SVGGenerator 实例。
func NewSVGGenerator() Generator {
	return &SVGGenerator{}
}

// CanHandle 判断文件是否为 SVG 文件。
func (g *SVGGenerator) CanHandle(ctx context.Context, file *model.File) bool {
	ext := strings.ToLower(filepath.Ext(file.Name))
	return ext == ".svg"
}

// Generate 对于SVG文件，不执行任何文件操作。
// 它返回一个特殊的结果，其中 IsDirectServe 为 true，
// 以通知上层服务（ThumbnailService）应该将缩略图状态设置为 ReadyDirect。
// 所有ID和路径参数在此处都未使用，但为了遵循 Generator 接口而保留。
func (g *SVGGenerator) Generate(
	ctx context.Context,
	file *model.File,
	sourcePath string,
	ownerPublicID string,
	filePublicID string,
	virtualParentPath string,
) (*Result, error) {
	// 双重检查，确保不会被错误调用
	if strings.ToLower(filepath.Ext(file.Name)) != ".svg" {
		return nil, fmt.Errorf("SVGGenerator was incorrectly called for a non-SVG file: %s", file.Name)
	}

	// 返回结果，清晰地表明这是一个“直接服务”的案例
	return &Result{
		GeneratorName: "svg",
		IsDirectServe: true,
		Format:        ".svg",
	}, nil
}
