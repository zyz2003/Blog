/*
 * @Description: image_style 领域模型 JSON 行为测试
 * @Author: 安知鱼
 */
package model

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"
)

// TestImageStyleConfig_WatermarkNil_NoNullField 验证
// 当 Watermark == nil 时，序列化结果中不应出现 "watermark": null 字段。
// 这是 Spec §5.1 的硬性要求：前端和数据库中避免存储 null 水印。
func TestImageStyleConfig_WatermarkNil_NoNullField(t *testing.T) {
	style := ImageStyleConfig{
		Name:       "thumbnail",
		Format:     "webp",
		Quality:    80,
		AutoRotate: true,
		Resize: ImageResizeConfig{
			Mode:    "cover",
			Width:   400,
			Height:  300,
			Enlarge: false,
		},
		Watermark: nil,
	}

	data, err := json.Marshal(style)
	if err != nil {
		t.Fatalf("marshal 失败: %v", err)
	}

	s := string(data)
	if strings.Contains(s, `"watermark"`) {
		t.Errorf("Watermark=nil 时不应出现 watermark 字段，实际 JSON=%s", s)
	}
}

// TestImageStyleConfig_RoundTrip 验证 JSON 反序列化后再序列化
// 结果在字段结构上保持稳定（对于带有 watermark 的样式）。
func TestImageStyleConfig_RoundTrip(t *testing.T) {
	input := `{
  "name": "thumbnail",
  "format": "webp",
  "quality": 80,
  "auto_rotate": true,
  "resize": {"mode":"cover","width":400,"height":300,"enlarge":false},
  "watermark": {"type":"text","text":"© anheyu.com","position":"bottom-right","opacity":0.3,"font_size":14,"color":"#ffffff"}
}`

	var style ImageStyleConfig
	if err := json.Unmarshal([]byte(input), &style); err != nil {
		t.Fatalf("unmarshal 失败: %v", err)
	}

	if style.Name != "thumbnail" {
		t.Errorf("Name 期望 thumbnail，实际 %s", style.Name)
	}
	if style.Format != "webp" {
		t.Errorf("Format 期望 webp，实际 %s", style.Format)
	}
	if style.Quality != 80 {
		t.Errorf("Quality 期望 80，实际 %d", style.Quality)
	}
	if !style.AutoRotate {
		t.Errorf("AutoRotate 期望 true")
	}
	if style.Resize.Mode != "cover" {
		t.Errorf("Resize.Mode 期望 cover，实际 %s", style.Resize.Mode)
	}
	if style.Resize.Width != 400 || style.Resize.Height != 300 {
		t.Errorf("Resize 尺寸错误，实际 %dx%d", style.Resize.Width, style.Resize.Height)
	}
	if style.Watermark == nil {
		t.Fatalf("Watermark 不应为 nil")
	}
	if style.Watermark.Type != "text" || style.Watermark.Text != "© anheyu.com" {
		t.Errorf("Watermark 字段错误: %+v", style.Watermark)
	}
	if style.Watermark.Opacity != 0.3 {
		t.Errorf("Watermark.Opacity 期望 0.3，实际 %v", style.Watermark.Opacity)
	}

	// 再序列化一次，确保没有丢字段（如 auto_rotate: false 与 nil 场景区分）
	data, err := json.Marshal(&style)
	if err != nil {
		t.Fatalf("remarshal 失败: %v", err)
	}
	s := string(data)
	for _, must := range []string{`"name":"thumbnail"`, `"format":"webp"`, `"auto_rotate":true`, `"resize"`, `"watermark"`} {
		if !strings.Contains(s, must) {
			t.Errorf("重新序列化后缺少字段 %s，实际 JSON=%s", must, s)
		}
	}
}

func TestImageProcessConfig_NormalizeApplyExtensionsWhenEnabled(t *testing.T) {
	t.Run("关闭时不填充", func(t *testing.T) {
		c := ImageProcessConfig{Enabled: false, ApplyToExtensions: nil}
		c.NormalizeApplyExtensionsWhenEnabled()
		if len(c.ApplyToExtensions) != 0 {
			t.Errorf("期望仍为空，实际 %v", c.ApplyToExtensions)
		}
	})
	t.Run("启用且为空时写入默认列表", func(t *testing.T) {
		c := ImageProcessConfig{Enabled: true, ApplyToExtensions: nil}
		c.NormalizeApplyExtensionsWhenEnabled()
		if !slices.Equal(c.ApplyToExtensions, DefaultImageProcessApplyExtensions) {
			t.Errorf("期望默认列表，实际 %v", c.ApplyToExtensions)
		}
	})
	t.Run("启用且已有扩展名时不覆盖", func(t *testing.T) {
		c := ImageProcessConfig{Enabled: true, ApplyToExtensions: []string{"gif"}}
		c.NormalizeApplyExtensionsWhenEnabled()
		if len(c.ApplyToExtensions) != 1 || c.ApplyToExtensions[0] != "gif" {
			t.Errorf("期望保留 gif，实际 %v", c.ApplyToExtensions)
		}
	})
}

// TestImageProcessConfig_ZeroValue_SerializedCleanly 验证
// 默认零值的 ImageProcessConfig 能够被序列化为合法 JSON 且字段命名规范。
func TestImageProcessConfig_ZeroValue_SerializedCleanly(t *testing.T) {
	cfg := ImageProcessConfig{}
	data, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("marshal 失败: %v", err)
	}
	s := string(data)
	for _, must := range []string{`"enabled":false`, `"default_style":""`} {
		if !strings.Contains(s, must) {
			t.Errorf("期望包含 %s，实际 JSON=%s", must, s)
		}
	}
}

// TestImageResizeConfig_ScaleOmitEmpty 验证
// mode=scale 时 width/height 可以省略，mode=cover 时 scale 可以省略。
func TestImageResizeConfig_ScaleOmitEmpty(t *testing.T) {
	coverCfg := ImageResizeConfig{Mode: "cover", Width: 400, Height: 300}
	data, err := json.Marshal(coverCfg)
	if err != nil {
		t.Fatalf("marshal 失败: %v", err)
	}
	s := string(data)
	if strings.Contains(s, `"scale"`) {
		t.Errorf("cover 模式下不应出现 scale 字段，实际 JSON=%s", s)
	}

	scaleCfg := ImageResizeConfig{Mode: "scale", Scale: 0.5}
	data, err = json.Marshal(scaleCfg)
	if err != nil {
		t.Fatalf("marshal 失败: %v", err)
	}
	s = string(data)
	if strings.Contains(s, `"width"`) || strings.Contains(s, `"height"`) {
		t.Errorf("scale 模式下不应出现 width/height 字段，实际 JSON=%s", s)
	}
	if !strings.Contains(s, `"scale":0.5`) {
		t.Errorf("scale 模式下应包含 scale=0.5，实际 JSON=%s", s)
	}
}

// TestWatermarkConfig_ImageURL_Empty_Omit 验证
// WatermarkConfig 中 ImageURL 为空时省略字段（text 水印场景）。
func TestWatermarkConfig_ImageURL_Empty_Omit(t *testing.T) {
	wm := WatermarkConfig{Type: "text", Text: "© anheyu.com", Position: "bottom-right"}
	data, err := json.Marshal(wm)
	if err != nil {
		t.Fatalf("marshal 失败: %v", err)
	}
	s := string(data)
	if strings.Contains(s, `"image_url"`) {
		t.Errorf("ImageURL 为空时不应出现该字段，实际 JSON=%s", s)
	}
}
