/*
 * @Description: 引擎层水印接口
 * @Author: 安知鱼
 *
 * 定义在 engine 包是为了让两个引擎（纯 Go / vips）都能以统一签名接入水印能力，
 * 同时避免循环依赖 image_style。具体实现由上层（image_style 包或 DI 层）注入。
 */
package engine

import (
	"image"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// Watermarker 对给定图像施加水印；cfg == nil 时约定直接返回原图。
// 实现必须并发安全（引擎可能同时处理多个请求）。
type Watermarker interface {
	Apply(img image.Image, cfg *model.WatermarkConfig) (image.Image, error)
}

// NoopWatermarker 返回一个什么都不做的 Watermarker，用于测试与默认装配。
func NoopWatermarker() Watermarker { return noopWatermarker{} }

type noopWatermarker struct{}

// Apply 原样返回输入图像。
func (noopWatermarker) Apply(img image.Image, _ *model.WatermarkConfig) (image.Image, error) {
	return img, nil
}
