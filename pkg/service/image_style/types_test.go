/*
 * @Description: image_style 内部类型测试
 * @Author: 安知鱼
 */
package image_style

import (
	"net/url"
	"strings"
	"testing"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// TestResolvedStyle_Hash_Deterministic 验证同一 ResolvedStyle 的 hash 在多次调用
// 以及字段顺序重排时都相同。这是缓存命中的基础前提。
func TestResolvedStyle_Hash_Deterministic(t *testing.T) {
	a := ResolvedStyle{
		Format:     "webp",
		Quality:    80,
		AutoRotate: true,
		Resize: model.ImageResizeConfig{
			Mode:    "cover",
			Width:   400,
			Height:  300,
			Enlarge: false,
		},
	}
	b := ResolvedStyle{
		Resize: model.ImageResizeConfig{
			Height:  300,
			Width:   400,
			Enlarge: false,
			Mode:    "cover",
		},
		AutoRotate: true,
		Quality:    80,
		Format:     "webp",
	}

	h1 := a.Hash()
	h2 := b.Hash()
	h3 := a.Hash()

	if h1 != h2 {
		t.Errorf("字段顺序不同但语义相同的 ResolvedStyle 应产生相同 hash；a=%s b=%s", h1, h2)
	}
	if h1 != h3 {
		t.Errorf("同一 ResolvedStyle 多次调用 hash 应相同；first=%s second=%s", h1, h3)
	}

	// hash 的长度约定是 sha256 前 16 位 hex（64 bit）
	if len(h1) != 16 {
		t.Errorf("hash 长度期望 16 hex 字符，实际 %d：%s", len(h1), h1)
	}
	// 必须是合法 hex
	for _, r := range h1 {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f')) {
			t.Errorf("hash 包含非 hex 字符：%s", h1)
			break
		}
	}
}

// TestResolvedStyle_Hash_DifferentContent 验证任一字段改变都会带来不同 hash。
func TestResolvedStyle_Hash_DifferentContent(t *testing.T) {
	base := ResolvedStyle{
		Format:     "webp",
		Quality:    80,
		AutoRotate: true,
		Resize: model.ImageResizeConfig{
			Mode:   "cover",
			Width:  400,
			Height: 300,
		},
	}
	baseHash := base.Hash()

	cases := []struct {
		name    string
		mutator func(r *ResolvedStyle)
	}{
		{"format 变化", func(r *ResolvedStyle) { r.Format = "jpg" }},
		{"quality 变化", func(r *ResolvedStyle) { r.Quality = 90 }},
		{"auto_rotate 变化", func(r *ResolvedStyle) { r.AutoRotate = false }},
		{"resize.mode 变化", func(r *ResolvedStyle) { r.Resize.Mode = "contain" }},
		{"resize.width 变化", func(r *ResolvedStyle) { r.Resize.Width = 800 }},
		{"resize.height 变化", func(r *ResolvedStyle) { r.Resize.Height = 600 }},
		{"新增 watermark", func(r *ResolvedStyle) {
			r.Watermark = &model.WatermarkConfig{Type: "text", Text: "x"}
		}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			mutated := base
			// 深拷贝 Resize（值类型拷贝即可）
			mutated.Resize = base.Resize
			c.mutator(&mutated)

			got := mutated.Hash()
			if got == baseHash {
				t.Errorf("%s 后 hash 不应与原 hash 相同；base=%s got=%s", c.name, baseHash, got)
			}
		})
	}
}

// TestResolvedStyle_Hash_WatermarkNilVsEmpty 验证 Watermark 为 nil 与
// 指向空 WatermarkConfig 的 hash 应不同，保证"配置里确实有空水印"与"没水印"语义可区分。
func TestResolvedStyle_Hash_WatermarkNilVsEmpty(t *testing.T) {
	a := ResolvedStyle{Format: "jpg", Quality: 80, Watermark: nil}
	b := ResolvedStyle{Format: "jpg", Quality: 80, Watermark: &model.WatermarkConfig{}}

	if a.Hash() == b.Hash() {
		t.Errorf("Watermark=nil 与 Watermark=&{} 的 hash 不应相同")
	}
}

// TestCacheStats_ZeroValue 验证 CacheStats 的零值能够正常构造（不 panic）。
func TestCacheStats_ZeroValue(t *testing.T) {
	stats := CacheStats{}
	if stats.PolicyID != 0 || stats.TotalSize != 0 || stats.Count != 0 {
		t.Errorf("CacheStats 零值应为空白状态，实际 %+v", stats)
	}
}

// TestStyleRequest_Construction 仅验证结构体可构造，并且字段类型符合预期，
// 防止后续重构意外改动字段名。DynamicOpts 使用 url.Values 便于 Matcher 处理多值 query。
func TestStyleRequest_Construction(t *testing.T) {
	req := &StyleRequest{
		Policy:      nil,
		File:        nil,
		Filename:    "a.jpg",
		StyleName:   "thumbnail",
		DynamicOpts: url.Values{"w": []string{"400"}},
	}
	if req.StyleName != "thumbnail" {
		t.Errorf("StyleName 字段绑定错误")
	}
	if !strings.HasSuffix(req.Filename, ".jpg") {
		t.Errorf("Filename 字段绑定错误：%s", req.Filename)
	}
	if req.DynamicOpts.Get("w") != "400" {
		t.Errorf("DynamicOpts 应为 url.Values 兼容类型")
	}
}
