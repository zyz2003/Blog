/*
 * @Description: vips 引擎单元与端到端测试
 * @Author: 安知鱼
 *
 * 测试组织：
 *   - 纯函数（buildVipsOutputSpec / resolveVipsResizeArgs / detectFormatFromMagic /
 *     isVipsFormatUnsupportedErr）：表驱动单测，不依赖 vips 可执行。
 *   - Process 端到端：若本机 Probe() 检测不到 vips，整个子测试 t.Skip。
 *     覆盖快乐路径（格式转换 + 多种 resize mode + auto-rotate 开关）以及 cap 预检失败路径。
 */
package engine

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os/exec"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"

	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	_ "golang.org/x/image/webp"
)

// realVipsCapability 只在本机确有 vips 时返回真实能力快照。
// 通过 exec.LookPath 二次确认，避免 Probe() 被桩过期影响。
func realVipsCapability(t *testing.T) (VipsCapability, bool) {
	t.Helper()
	if _, err := exec.LookPath("vips"); err != nil {
		return VipsCapability{}, false
	}
	ResetProbeForTest()
	cap := Probe()
	if !cap.Available {
		return VipsCapability{}, false
	}
	return cap, true
}

// buildTestJPEG 生成一张 srcW×srcH 的纯色 JPEG，便于端到端测试。
func buildTestJPEG(t *testing.T, srcW, srcH int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, srcW, srcH))
	for y := 0; y < srcH; y++ {
		for x := 0; x < srcW; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatalf("构造测试 JPEG 失败: %v", err)
	}
	return buf.Bytes()
}

func buildTestPNG(t *testing.T, srcW, srcH int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, srcW, srcH))
	for y := 0; y < srcH; y++ {
		for x := 0; x < srcW; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("构造测试 PNG 失败: %v", err)
	}
	return buf.Bytes()
}

func decodeImageConfig(t *testing.T, data []byte) (image.Config, string) {
	t.Helper()
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("DecodeConfig 失败: %v; data len=%d, head=%x", err, len(data), data[:min(len(data), 16)])
	}
	return cfg, format
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ---------- 端到端 ----------

func TestVipsEngine_Process_JPEGToWebP_Cover(t *testing.T) {
	cap, ok := realVipsCapability(t)
	if !ok {
		t.Skip("vips not available in test env")
	}

	engine := NewVipsEngine(cap)
	src := buildTestJPEG(t, 1200, 900)

	var out bytes.Buffer
	style := model.ImageStyleConfig{
		Format:     "webp",
		Quality:    70,
		AutoRotate: true,
		Resize: model.ImageResizeConfig{
			Mode:   "cover",
			Width:  400,
			Height: 300,
		},
	}
	mime, err := engine.Process(context.Background(), bytes.NewReader(src), style, &out)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if mime != "image/webp" {
		t.Errorf("mime 应为 image/webp，实际 %s", mime)
	}
	cfg, format := decodeImageConfig(t, out.Bytes())
	if format != "webp" {
		t.Errorf("decoded format 应为 webp，实际 %s", format)
	}
	if cfg.Width != 400 || cfg.Height != 300 {
		t.Errorf("cover 应精确到 400x300，实际 %dx%d", cfg.Width, cfg.Height)
	}
}

func TestVipsEngine_Process_PNGToJPEG_Contain(t *testing.T) {
	cap, ok := realVipsCapability(t)
	if !ok {
		t.Skip("vips not available in test env")
	}

	engine := NewVipsEngine(cap)
	src := buildTestPNG(t, 800, 400)

	var out bytes.Buffer
	style := model.ImageStyleConfig{
		Format:  "jpg",
		Quality: 80,
		Resize: model.ImageResizeConfig{
			Mode:   "contain",
			Width:  200,
			Height: 200,
		},
	}
	mime, err := engine.Process(context.Background(), bytes.NewReader(src), style, &out)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if mime != "image/jpeg" {
		t.Errorf("mime 应为 image/jpeg，实际 %s", mime)
	}
	cfg, format := decodeImageConfig(t, out.Bytes())
	if format != "jpeg" {
		t.Errorf("format 应为 jpeg，实际 %s", format)
	}
	// 源图 800x400 → contain 200x200 → 应保留 2:1 → 输出 200x100
	if cfg.Width != 200 || cfg.Height != 100 {
		t.Errorf("contain 应保留比例，期望 200x100，实际 %dx%d", cfg.Width, cfg.Height)
	}
}

func TestVipsEngine_Process_FormatOnly_NoResize(t *testing.T) {
	cap, ok := realVipsCapability(t)
	if !ok {
		t.Skip("vips not available in test env")
	}

	engine := NewVipsEngine(cap)
	src := buildTestJPEG(t, 320, 240)

	var out bytes.Buffer
	style := model.ImageStyleConfig{
		Format:  "webp",
		Quality: 75,
	}
	mime, err := engine.Process(context.Background(), bytes.NewReader(src), style, &out)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if mime != "image/webp" {
		t.Errorf("mime 应为 image/webp，实际 %s", mime)
	}
	cfg, format := decodeImageConfig(t, out.Bytes())
	if format != "webp" {
		t.Errorf("format 应为 webp，实际 %s", format)
	}
	if cfg.Width != 320 || cfg.Height != 240 {
		t.Errorf("未 resize 时应保持原尺寸 320x240，实际 %dx%d", cfg.Width, cfg.Height)
	}
}

func TestVipsEngine_Process_UnsupportedOutput_ReturnsErrFormatUnsupported(t *testing.T) {
	cap, ok := realVipsCapability(t)
	if !ok {
		t.Skip("vips not available in test env")
	}

	// 构造一个 capability：清掉 OutputFormats，让预检判定"不支持"。
	dead := VipsCapability{
		Available:     true,
		BinaryPath:    cap.BinaryPath,
		Version:       cap.Version,
		InputFormats:  cap.InputFormats,
		OutputFormats: nil,
	}
	engine := NewVipsEngine(dead)
	src := buildTestJPEG(t, 100, 100)

	var out bytes.Buffer
	style := model.ImageStyleConfig{Format: "webp"}
	_, err := engine.Process(context.Background(), bytes.NewReader(src), style, &out)
	if err == nil {
		t.Fatalf("capability 不含 webp 时应返回 ErrFormatUnsupported，实际 err=nil")
	}
	if err != ErrFormatUnsupported {
		t.Errorf("应返回 ErrFormatUnsupported，实际 %v", err)
	}
}

// TestVipsEngine_Process_Watermark_InvokesSpy 验证 Phase 3 Task 3.5 的水印路径：
// 当 style.Watermark != nil 时，必定调用注入的 watermarker；
// 端到端要求本机有 vips（否则 skip）。
func TestVipsEngine_Process_Watermark_InvokesSpy(t *testing.T) {
	cap, ok := realVipsCapability(t)
	if !ok {
		t.Skip("vips not available in test env")
	}

	spy := &vipsSpyWatermarker{}
	engine := NewVipsEngine(cap, WithVipsWatermarker(spy))
	src := buildTestJPEG(t, 800, 600)

	var out bytes.Buffer
	style := model.ImageStyleConfig{
		Format:  "jpg",
		Quality: 80,
		Resize:  model.ImageResizeConfig{Mode: "cover", Width: 200, Height: 200},
		Watermark: &model.WatermarkConfig{
			Type: "text", Text: "hello", Position: "bottom-right",
		},
	}
	mime, err := engine.Process(context.Background(), bytes.NewReader(src), style, &out)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if mime != "image/jpeg" {
		t.Errorf("mime = %s, want image/jpeg", mime)
	}
	if spy.called != 1 {
		t.Errorf("watermarker 应被调用 1 次，实际 %d", spy.called)
	}
	if spy.lastWidth != 200 || spy.lastHeight != 200 {
		t.Errorf("watermarker 应收到 resize 后的 200x200 图像，实际 %dx%d",
			spy.lastWidth, spy.lastHeight)
	}
	// 输出应能解码
	cfg, format := decodeImageConfig(t, out.Bytes())
	if format != "jpeg" {
		t.Errorf("output format = %s, want jpeg", format)
	}
	if cfg.Width != 200 || cfg.Height != 200 {
		t.Errorf("output size = %dx%d, want 200x200", cfg.Width, cfg.Height)
	}
}

// TestVipsEngine_Process_Watermark_PNGOutput 水印 + PNG 输出路径（跳过阶段 3 的 copy）。
func TestVipsEngine_Process_Watermark_PNGOutput(t *testing.T) {
	cap, ok := realVipsCapability(t)
	if !ok {
		t.Skip("vips not available in test env")
	}
	spy := &vipsSpyWatermarker{}
	engine := NewVipsEngine(cap, WithVipsWatermarker(spy))
	src := buildTestPNG(t, 400, 400)

	var out bytes.Buffer
	style := model.ImageStyleConfig{
		Format: "png",
		Resize: model.ImageResizeConfig{Mode: "contain", Width: 100, Height: 100},
		Watermark: &model.WatermarkConfig{
			Type: "text", Text: "©", Position: "center",
		},
	}
	mime, err := engine.Process(context.Background(), bytes.NewReader(src), style, &out)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if mime != "image/png" {
		t.Errorf("mime = %s, want image/png", mime)
	}
	if spy.called != 1 {
		t.Errorf("watermarker 应被调用 1 次，实际 %d", spy.called)
	}
	cfg, format := decodeImageConfig(t, out.Bytes())
	if format != "png" {
		t.Errorf("format = %s, want png", format)
	}
	if cfg.Width != 100 || cfg.Height != 100 {
		t.Errorf("size = %dx%d, want 100x100", cfg.Width, cfg.Height)
	}
}

// TestVipsEngine_Process_Watermark_WebPOutput 覆盖 "vips→PNG→Go水印→vips→WebP" 的三阶段路径。
func TestVipsEngine_Process_Watermark_WebPOutput(t *testing.T) {
	cap, ok := realVipsCapability(t)
	if !ok {
		t.Skip("vips not available in test env")
	}
	// capability 需支持 webp 输出
	hasWebP := false
	for _, f := range cap.OutputFormats {
		if normalizeImageFormat(f) == "webp" {
			hasWebP = true
		}
	}
	if !hasWebP {
		t.Skip("vips build does not support webp encoding")
	}

	spy := &vipsSpyWatermarker{}
	engine := NewVipsEngine(cap, WithVipsWatermarker(spy))
	src := buildTestJPEG(t, 600, 600)

	var out bytes.Buffer
	style := model.ImageStyleConfig{
		Format:  "webp",
		Quality: 70,
		Resize:  model.ImageResizeConfig{Mode: "cover", Width: 150, Height: 150},
		Watermark: &model.WatermarkConfig{
			Type: "text", Text: "WM", Position: "top-left",
		},
	}
	mime, err := engine.Process(context.Background(), bytes.NewReader(src), style, &out)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if mime != "image/webp" {
		t.Errorf("mime = %s, want image/webp", mime)
	}
	if spy.called != 1 {
		t.Errorf("watermarker 应被调用 1 次，实际 %d", spy.called)
	}
	cfg, format := decodeImageConfig(t, out.Bytes())
	if format != "webp" {
		t.Errorf("format = %s, want webp", format)
	}
	if cfg.Width != 150 || cfg.Height != 150 {
		t.Errorf("size = %dx%d, want 150x150", cfg.Width, cfg.Height)
	}
}

// vipsSpyWatermarker 记录调用次数与输入尺寸，用于 vips 水印路径断言。
type vipsSpyWatermarker struct {
	called     int
	lastWidth  int
	lastHeight int
}

func (s *vipsSpyWatermarker) Apply(img image.Image, _ *model.WatermarkConfig) (image.Image, error) {
	s.called++
	b := img.Bounds()
	s.lastWidth = b.Dx()
	s.lastHeight = b.Dy()
	return img, nil
}

func TestVipsEngine_Process_ContextTimeout_ReturnsError(t *testing.T) {
	cap, ok := realVipsCapability(t)
	if !ok {
		t.Skip("vips not available in test env")
	}
	engine := NewVipsEngine(cap)
	src := buildTestJPEG(t, 4000, 3000)

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Nanosecond)
	defer cancel()

	var out bytes.Buffer
	style := model.ImageStyleConfig{Format: "jpg", Quality: 80,
		Resize: model.ImageResizeConfig{Mode: "cover", Width: 1000, Height: 750}}
	_, err := engine.Process(ctx, bytes.NewReader(src), style, &out)
	if err == nil {
		t.Fatalf("1ns 超时应必定失败，实际成功输出 %d 字节", out.Len())
	}
	// 只要返回非 nil 错误即可（可能是 ctx 超时或 vips 进程被 kill）。
}

// ---------- 参数构造 ----------

func TestBuildArgs_CoverFormatRotateConcurrency(t *testing.T) {
	v := &VipsEngine{binaryPath: "/bin/vips", capability: VipsCapability{
		Available: true, BinaryPath: "/bin/vips",
		OutputFormats: []string{"jpeg", "jpg", "webp", "png"},
	}}
	style := model.ImageStyleConfig{
		Format:     "webp",
		Quality:    82,
		AutoRotate: true,
		Resize: model.ImageResizeConfig{
			Mode: "cover", Width: 400, Height: 300,
		},
	}
	args := v.buildArgs("webp", style, []byte{0xFF, 0xD8, 0xFF})

	wantContains := []string{
		"--vips-concurrency=2",
		"thumbnail_source",
		"[descriptor=0]",
		".webp[Q=82]",
		"400",
		"--height",
		"300",
		"--size",
		"down",
		"--crop",
		"centre",
	}
	joined := strings.Join(args, " ")
	for _, kw := range wantContains {
		if !strings.Contains(joined, kw) {
			t.Errorf("args 缺少 %q：%v", kw, args)
		}
	}
	if strings.Contains(joined, "--no-rotate") {
		t.Errorf("AutoRotate=true 时不应有 --no-rotate：%v", args)
	}
}

func TestBuildArgs_AutoRotateFalse_AddsNoRotateFlag(t *testing.T) {
	v := &VipsEngine{binaryPath: "/bin/vips", capability: VipsCapability{
		Available: true, BinaryPath: "/bin/vips",
		OutputFormats: []string{"jpeg"},
	}}
	style := model.ImageStyleConfig{
		Format:     "jpg",
		Quality:    75,
		AutoRotate: false,
		Resize: model.ImageResizeConfig{Mode: "contain", Width: 300, Height: 200},
	}
	args := v.buildArgs("jpg", style, []byte{0xFF, 0xD8, 0xFF})
	joined := strings.Join(args, " ")
	if !strings.Contains(joined, "--no-rotate") {
		t.Errorf("AutoRotate=false 应加 --no-rotate：%v", args)
	}
	if strings.Contains(joined, "--crop") {
		t.Errorf("contain 模式不应加 --crop：%v", args)
	}
}

func TestBuildArgs_EnlargeTrue_OmitsSizeDown(t *testing.T) {
	v := &VipsEngine{binaryPath: "/bin/vips", capability: VipsCapability{
		Available: true, BinaryPath: "/bin/vips",
		OutputFormats: []string{"jpeg"},
	}}
	style := model.ImageStyleConfig{
		Format: "jpg",
		Resize: model.ImageResizeConfig{Mode: "cover", Width: 2000, Height: 1500, Enlarge: true},
	}
	args := v.buildArgs("jpg", style, nil)
	joined := strings.Join(args, " ")
	if strings.Contains(joined, "--size down") {
		t.Errorf("Enlarge=true 时不应 --size down：%v", args)
	}
}

// ---------- 纯函数：buildVipsOutputSpec ----------

func TestBuildVipsOutputSpec(t *testing.T) {
	cases := []struct {
		format string
		q      int
		want   string
	}{
		{"jpg", 80, ".jpg[Q=80]"},
		{"jpeg", 0, ".jpg[Q=75]"}, // 0 → 默认 75
		{"webp", 0, ".webp[Q=80]"},
		{"webp", 90, ".webp[Q=90]"},
		{"avif", 0, ".avif[Q=50]"},
		{"heic", 60, ".heic[Q=60]"},
		{"heif", 0, ".heic[Q=80]"}, // heif 走 heic 分支
		{"png", 80, ".png"},
		{"gif", 50, ".gif"},
		{"tiff", 0, ".tiff"},
		{"unknown", 10, ".unknown"},
	}
	for _, c := range cases {
		t.Run(c.format, func(t *testing.T) {
			got := buildVipsOutputSpec(c.format, c.q)
			if got != c.want {
				t.Errorf("buildVipsOutputSpec(%q, %d) = %q, want %q", c.format, c.q, got, c.want)
			}
		})
	}
}

func TestBuildVipsOutputSpec_QualityClamped(t *testing.T) {
	// quality 超过 100 → clamp 到 100
	if got := buildVipsOutputSpec("webp", 200); got != ".webp[Q=100]" {
		t.Errorf("quality clamp 失败：%s", got)
	}
}

// ---------- 纯函数：resolveVipsResizeArgs ----------

func TestResolveVipsResizeArgs(t *testing.T) {
	jpeg := buildHeaderJPEG(t, 800, 600)

	cases := []struct {
		name       string
		cfg        model.ImageResizeConfig
		data       []byte
		wantW      int
		wantH      int
		wantCrop   string
		note       string
		allowDelta int
	}{
		{"cover-both", model.ImageResizeConfig{Mode: "cover", Width: 400, Height: 300}, nil, 400, 300, "centre", "", 0},
		{"cover-width-only", model.ImageResizeConfig{Mode: "cover", Width: 400}, nil, 400, 0, "centre", "", 0},
		{"cover-height-only", model.ImageResizeConfig{Mode: "cover", Height: 300}, nil, vipsNoResizeWidth, 300, "centre", "", 0},
		{"cover-empty", model.ImageResizeConfig{Mode: "cover"}, nil, vipsNoResizeWidth, 0, "", "空 cover → 不 resize", 0},
		{"contain-both", model.ImageResizeConfig{Mode: "contain", Width: 400, Height: 300}, nil, 400, 300, "", "", 0},
		{"fit-inside-both", model.ImageResizeConfig{Mode: "fit-inside", Width: 400, Height: 300}, nil, 400, 300, "", "", 0},
		{"scale-valid", model.ImageResizeConfig{Mode: "scale", Scale: 0.5}, jpeg, 400, 300, "", "0.5 → 400x300", 2},
		{"scale-no-header", model.ImageResizeConfig{Mode: "scale", Scale: 0.5}, nil, vipsNoResizeWidth, 0, "", "无 header → 退化", 0},
		{"scale-zero", model.ImageResizeConfig{Mode: "scale", Scale: 0}, jpeg, vipsNoResizeWidth, 0, "", "scale=0 退化", 0},
		{"empty-mode", model.ImageResizeConfig{}, nil, vipsNoResizeWidth, 0, "", "无 mode", 0},
		{"unknown-mode", model.ImageResizeConfig{Mode: "weird"}, nil, vipsNoResizeWidth, 0, "", "未知 mode", 0},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w, h, crop := resolveVipsResizeArgs(c.cfg, c.data)
			if crop != c.wantCrop {
				t.Errorf("crop = %q, want %q", crop, c.wantCrop)
			}
			if c.allowDelta == 0 {
				if w != c.wantW || h != c.wantH {
					t.Errorf("(w,h) = (%d,%d), want (%d,%d)", w, h, c.wantW, c.wantH)
				}
			} else {
				if absInt(w-c.wantW) > c.allowDelta || absInt(h-c.wantH) > c.allowDelta {
					t.Errorf("(w,h) = (%d,%d), want ≈(%d,%d)±%d", w, h, c.wantW, c.wantH, c.allowDelta)
				}
			}
		})
	}
}

func absInt(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

// buildHeaderJPEG 生成一张带指定尺寸的 JPEG，用于 resolveVipsResizeArgs 的 scale 测试。
// 与 buildTestJPEG 共用实现；单独命名更表意。
func buildHeaderJPEG(t *testing.T, w, h int) []byte {
	return buildTestJPEG(t, w, h)
}

// ---------- 纯函数：detectFormatFromMagic ----------

func TestDetectFormatFromMagic(t *testing.T) {
	cases := []struct {
		name string
		data []byte
		want string
	}{
		{"jpeg", []byte{0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0}, "jpeg"},
		{"png", []byte("\x89PNG\r\n\x1a\nrest of header"), "png"},
		{"gif87a", []byte("GIF87a" + strings.Repeat("x", 10)), "gif"},
		{"gif89a", []byte("GIF89a" + strings.Repeat("x", 10)), "gif"},
		{"webp", []byte("RIFF\x00\x00\x00\x00WEBPVP8 "), "webp"},
		{"avif", append([]byte{0, 0, 0, 0x20}, []byte("ftypavif")...), "avif"},
		{"heic", append([]byte{0, 0, 0, 0x20}, []byte("ftypheic")...), "heic"},
		{"too-short", []byte{0xFF}, ""},
		{"unknown", bytes.Repeat([]byte{0x20}, 32), ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := detectFormatFromMagic(c.data)
			if got != c.want {
				t.Errorf("got %q, want %q", got, c.want)
			}
		})
	}
}

// ---------- 纯函数：isVipsFormatUnsupportedErr ----------

func TestIsVipsFormatUnsupportedErr(t *testing.T) {
	cases := []struct {
		name string
		msg  string
		want bool
	}{
		{"no-known-saver", "vips2png: error: no known saver for .xyz suffix", true},
		{"no-loader", "No loader recognized image", true},
		{"unknown-suffix", "VipsForeignSave: unknown suffix \".abc\"", true},
		{"not-supported", "thumbnail_source: not supported", true},
		{"empty", "", false},
		{"decode-error", "cannot decode image", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := isVipsFormatUnsupportedErr(c.msg)
			if got != c.want {
				t.Errorf("got %v, want %v", got, c.want)
			}
		})
	}
}

// ---------- 杂项 ----------

func TestMimeForFormat(t *testing.T) {
	cases := map[string]string{
		"jpg":     "image/jpeg",
		"jpeg":    "image/jpeg",
		"png":     "image/png",
		"webp":    "image/webp",
		"gif":     "image/gif",
		"avif":    "image/avif",
		"heic":    "image/heic",
		"heif":    "image/heic",
		"tiff":    "image/tiff",
		"unknown": "application/octet-stream",
	}
	for in, want := range cases {
		if got := mimeForFormat(in); got != want {
			t.Errorf("mimeForFormat(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNewVipsEngine_SupportedFormats(t *testing.T) {
	cap := VipsCapability{
		Available:     true,
		BinaryPath:    "/bin/vips",
		Version:       "8.18.2",
		InputFormats:  []string{"png", "jpeg"},
		OutputFormats: []string{"webp", "jpeg"},
	}
	v := NewVipsEngine(cap)
	if got := v.SupportedInputFormats(); !reflect.DeepEqual(got, cap.InputFormats) {
		t.Errorf("SupportedInputFormats = %v, want %v", got, cap.InputFormats)
	}
	if got := v.SupportedOutputFormats(); !reflect.DeepEqual(got, cap.OutputFormats) {
		t.Errorf("SupportedOutputFormats = %v, want %v", got, cap.OutputFormats)
	}
	if v.Name() != "vips" {
		t.Errorf("Name() = %s, want vips", v.Name())
	}
}
