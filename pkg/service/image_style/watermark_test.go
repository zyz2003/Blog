/*
 * @Description: Watermark 接口与纯 Go 实现测试
 * @Author: 安知鱼
 */
package image_style

import (
	"context"
	"errors"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

func TestNoopWatermarker_ReturnsSameImage(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 4, 4))
	src.Set(1, 1, color.RGBA{100, 150, 200, 255})

	w := NewNoopWatermarker()

	// cfg != nil 也应原样返回
	got, err := w.Apply(src, &model.WatermarkConfig{Type: "text", Text: "x"})
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if got == nil {
		t.Fatalf("Noop 不应返回 nil")
	}
	if got.Bounds() != src.Bounds() {
		t.Errorf("尺寸应保持一致，实际 %v", got.Bounds())
	}

	// cfg == nil 也应安全
	got, err = w.Apply(src, nil)
	if err != nil || got == nil {
		t.Errorf("nil cfg 不应报错；err=%v got=%v", err, got)
	}
}

// TestWatermarker_InterfaceCompliance 用编译时静态断言确保 NoopWatermarker 满足 Watermarker。
func TestWatermarker_InterfaceCompliance(t *testing.T) {
	var _ Watermarker = NoopWatermarker{}
	var _ Watermarker = NewNoopWatermarker()
}

// makeWhiteRGBA 构造一张纯白 RGBA，用于水印颜色变化断言。
func makeWhiteRGBA(w, h int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{255, 255, 255, 255})
		}
	}
	return img
}

// TestNativeWatermarker_Text_ChangesPixels 对 800x600 的纯白 RGBA 加文本水印，
// 断言右下角大致区域出现非白色像素（即文字绘制成功）。
func TestNativeWatermarker_Text_ChangesPixels(t *testing.T) {
	wm := NewNativeWatermarker()
	src := makeWhiteRGBA(800, 600)

	cfg := &model.WatermarkConfig{
		Type:     "text",
		Text:     "TEST",
		Position: "bottom-right",
		OffsetX:  10,
		OffsetY:  10,
		FontSize: 48,
		Color:    "#000000",
		Opacity:  1.0,
	}
	got, err := wm.Apply(src, cfg)
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if got.Bounds() != src.Bounds() {
		t.Errorf("输出尺寸应等于原图 %v，实际 %v", src.Bounds(), got.Bounds())
	}

	// 右下角 200x100 区域内应至少存在一个非白像素（即文字像素）
	region := image.Rect(600, 500, 800, 600)
	foundNonWhite := false
	for y := region.Min.Y; y < region.Max.Y; y++ {
		for x := region.Min.X; x < region.Max.X; x++ {
			r, g, b, _ := got.At(x, y).RGBA()
			if r != 65535 || g != 65535 || b != 65535 {
				foundNonWhite = true
				break
			}
		}
		if foundNonWhite {
			break
		}
	}
	if !foundNonWhite {
		t.Error("右下角区域应出现非白像素（文字），实际全白")
	}
}

// TestNativeWatermarker_Text_EmptyText 空文本直接返回原图，不报错。
func TestNativeWatermarker_Text_EmptyText(t *testing.T) {
	wm := NewNativeWatermarker()
	src := makeWhiteRGBA(100, 100)
	got, err := wm.Apply(src, &model.WatermarkConfig{Type: "text", Text: ""})
	if err != nil {
		t.Fatalf("空文本不应报错：%v", err)
	}
	if got == nil {
		t.Fatal("返回 nil")
	}
}

// TestNativeWatermarker_NilCfg 应返回原图与 nil 错误。
func TestNativeWatermarker_NilCfg(t *testing.T) {
	wm := NewNativeWatermarker()
	src := makeWhiteRGBA(100, 100)
	got, err := wm.Apply(src, nil)
	if err != nil || got == nil {
		t.Errorf("nil cfg 不应报错；err=%v got=%v", err, got)
	}
}

// TestNativeWatermarker_UnknownType 未知类型应返回错误。
func TestNativeWatermarker_UnknownType(t *testing.T) {
	wm := NewNativeWatermarker()
	src := makeWhiteRGBA(100, 100)
	_, err := wm.Apply(src, &model.WatermarkConfig{Type: "svg"})
	if err == nil {
		t.Fatal("未知 type 应返回错误")
	}
}

// TestNativeWatermarker_Image_FromHTTP 通过 httptest server 提供水印图片，
// 验证：1) 图片水印正确叠加；2) 二次调用命中缓存不再请求。
func TestNativeWatermarker_Image_FromHTTP(t *testing.T) {
	// httptest 使用 127.0.0.1，默认的 SSRF 保护会拒绝 loopback；
	// 此测试关注的是"水印像素 + 缓存"而非网络边界，因此临时关闭 SSRF 钩子。
	restore := DisableSSRFGuardForTest()
	defer restore()

	// 生成一张 20x20 蓝色 PNG 作为水印源
	wmPNG := image.NewRGBA(image.Rect(0, 0, 20, 20))
	for y := 0; y < 20; y++ {
		for x := 0; x < 20; x++ {
			wmPNG.Set(x, y, color.RGBA{0, 0, 255, 255})
		}
	}
	var pngBuf []byte
	{
		buf := new(writeBuf)
		if err := png.Encode(buf, wmPNG); err != nil {
			t.Fatalf("encode png: %v", err)
		}
		pngBuf = buf.Bytes()
	}

	hits := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		w.Header().Set("Content-Type", "image/png")
		w.Write(pngBuf)
	}))
	defer srv.Close()

	wm := NewNativeWatermarker()
	src := makeWhiteRGBA(200, 200)
	cfg := &model.WatermarkConfig{
		Type:     "image",
		ImageURL: srv.URL + "/logo.png",
		Position: "bottom-right",
		OffsetX:  5,
		OffsetY:  5,
		Opacity:  1.0,
	}
	got, err := wm.Apply(src, cfg)
	if err != nil {
		t.Fatalf("首次 Apply 失败: %v", err)
	}

	// bottom-right 区域内应出现蓝色像素
	px := got.At(200-5-10, 200-5-10) // 水印中心附近
	r, g, b, _ := px.RGBA()
	if !(b > 20000 && r < 10000 && g < 10000) {
		t.Errorf("水印区域应出现蓝色，实际 RGB=(%d,%d,%d)", r>>8, g>>8, b>>8)
	}

	// 第二次调用应命中缓存，hits 保持 1
	if _, err := wm.Apply(src, cfg); err != nil {
		t.Fatalf("二次 Apply 失败: %v", err)
	}
	if hits != 1 {
		t.Errorf("二次调用应命中缓存，HTTP 请求次数应为 1，实际 %d", hits)
	}
}

// TestNativeWatermarker_Image_InvalidURL 非 http/https 协议应返回错误。
func TestNativeWatermarker_Image_InvalidURL(t *testing.T) {
	wm := NewNativeWatermarker()
	src := makeWhiteRGBA(100, 100)
	_, err := wm.Apply(src, &model.WatermarkConfig{
		Type:     "image",
		ImageURL: "file:///etc/passwd",
	})
	if err == nil {
		t.Fatal("file:// URL 应被拒绝")
	}
}

// TestNativeWatermarker_CustomFetcher 注入自定义 Fetcher 替代 HTTP 实现。
func TestNativeWatermarker_CustomFetcher(t *testing.T) {
	// 自定义 fetcher 返回一张 30x30 红色图
	red := image.NewRGBA(image.Rect(0, 0, 30, 30))
	for y := 0; y < 30; y++ {
		for x := 0; x < 30; x++ {
			red.Set(x, y, color.RGBA{255, 0, 0, 255})
		}
	}
	fetcher := stubFetcher{img: red}

	wm := NewNativeWatermarker(WithImageFetcher(fetcher))
	src := makeWhiteRGBA(100, 100)
	cfg := &model.WatermarkConfig{
		Type:     "image",
		ImageURL: "internal://policy/1/file/123",
		Position: "center",
		Opacity:  1.0,
	}
	got, err := wm.Apply(src, cfg)
	if err != nil {
		t.Fatalf("自定义 fetcher 失败: %v", err)
	}
	// center 位置：(100-30)/2=35 开始
	pxR, pxG, pxB, _ := got.At(50, 50).RGBA()
	if !(pxR > 20000 && pxG < 10000 && pxB < 10000) {
		t.Errorf("中心应为红色，实际 RGB=(%d,%d,%d)", pxR>>8, pxG>>8, pxB>>8)
	}
}

// TestParseWatermarkColor 覆盖 #rgb / #rrggbb / #rrggbbaa / 非法值。
func TestParseWatermarkColor(t *testing.T) {
	cases := []struct {
		in    string
		wantR uint8
		wantG uint8
		wantB uint8
		wantA uint8
	}{
		{"#000", 0, 0, 0, 255},
		{"#fff", 255, 255, 255, 255},
		{"#ff0000", 255, 0, 0, 255},
		{"#00ff00", 0, 255, 0, 255},
		{"#0000ff", 0, 0, 255, 255},
		{"#ff000080", 255, 0, 0, 128},
		{"", 255, 255, 255, 255},
		// 非法长度（如 2 字符）退化为默认白
		{"ab", 255, 255, 255, 255},
		// #bad 是合法的 3 字符 hex，解析为 #bbaadd
		{"#bad", 0xbb, 0xaa, 0xdd, 255},
	}
	for _, c := range cases {
		got := parseWatermarkColor(c.in)
		if got.R != c.wantR || got.G != c.wantG || got.B != c.wantB || got.A != c.wantA {
			t.Errorf("parseWatermarkColor(%q) = %+v, want R=%d G=%d B=%d A=%d",
				c.in, got, c.wantR, c.wantG, c.wantB, c.wantA)
		}
	}
}

// TestApplyOpacity 覆盖边界行为。
func TestApplyOpacity(t *testing.T) {
	if got := applyOpacity(255, 0); got != 255 {
		t.Errorf("opacity=0 应保持原 alpha，实际 %d", got)
	}
	if got := applyOpacity(255, 1.0); got != 255 {
		t.Errorf("opacity=1 应保持原 alpha，实际 %d", got)
	}
	if got := applyOpacity(255, 0.5); got != 127 {
		t.Errorf("opacity=0.5 应得 ~127，实际 %d", got)
	}
}

// TestResolveWatermarkPositions 表驱动覆盖 6 种位置模式。
func TestResolveWatermarkPositions(t *testing.T) {
	cases := []struct {
		name     string
		position string
		ox, oy   int
		wantLen  int
		wantFirst image.Point
	}{
		{"top-left", "top-left", 5, 5, 1, image.Point{5, 5}},
		{"top-right", "top-right", 5, 5, 1, image.Point{1000 - 100 - 5, 5}},
		{"bottom-left", "bottom-left", 5, 5, 1, image.Point{5, 1000 - 50 - 5}},
		{"bottom-right", "bottom-right", 5, 5, 1, image.Point{1000 - 100 - 5, 1000 - 50 - 5}},
		{"center", "center", 0, 0, 1, image.Point{(1000 - 100) / 2, (1000 - 50) / 2}},
		{"default-empty", "", 5, 5, 1, image.Point{1000 - 100 - 5, 1000 - 50 - 5}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			pts := resolveWatermarkPositions(1000, 1000, 100, 50, c.position, c.ox, c.oy)
			if len(pts) != c.wantLen {
				t.Fatalf("pts len=%d, want %d", len(pts), c.wantLen)
			}
			if pts[0] != c.wantFirst {
				t.Errorf("first point = %v, want %v", pts[0], c.wantFirst)
			}
		})
	}
	// tile 模式应返回多个点
	tilePts := resolveWatermarkPositions(400, 400, 100, 50, "tile", 0, 0)
	if len(tilePts) < 8 {
		t.Errorf("tile 应至少 8 个点，实际 %d", len(tilePts))
	}
}

// TestImageCache_TTL 验证缓存 TTL 过期后重新取回。
func TestImageCache_TTL(t *testing.T) {
	c := newImageCache(50*time.Millisecond, 4)
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	c.Put("a", img)
	if g, ok := c.Get("a"); !ok || g == nil {
		t.Fatal("立即读取应命中")
	}
	time.Sleep(80 * time.Millisecond)
	if _, ok := c.Get("a"); ok {
		t.Fatal("TTL 过期后应 miss")
	}
}

// TestImageToRGBA_DoesNotMutateSource 验证即便 src 已经是 *image.RGBA，
// imageToRGBA 也会返回独立副本，Apply 的任何绘制不会污染调用方输入。
// 这是 Phase 3 Code Review 中 H1 的回归保护。
func TestImageToRGBA_DoesNotMutateSource(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 10, 10))
	for y := 0; y < 10; y++ {
		for x := 0; x < 10; x++ {
			src.Set(x, y, color.RGBA{123, 45, 67, 255})
		}
	}
	// 保留原像素快照
	want := make([]uint8, len(src.Pix))
	copy(want, src.Pix)

	dst := imageToRGBA(src)
	// 必须是新对象
	if &dst.Pix[0] == &src.Pix[0] {
		t.Fatal("imageToRGBA 不应返回同一 Pix 切片的引用")
	}
	// 在 dst 上写一个显眼颜色，确认不影响 src
	dst.Set(5, 5, color.RGBA{0, 0, 0, 255})
	for i := range src.Pix {
		if src.Pix[i] != want[i] {
			t.Fatalf("src 被污染，偏移 %d 变化：%d → %d", i, want[i], src.Pix[i])
		}
	}
}

// TestImageCache_Eviction 超过容量应淘汰。
func TestImageCache_Eviction(t *testing.T) {
	c := newImageCache(10*time.Minute, 2)
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	c.Put("a", img)
	c.Put("b", img)
	c.Put("c", img)
	total := 0
	for _, k := range []string{"a", "b", "c"} {
		if _, ok := c.Get(k); ok {
			total++
		}
	}
	if total > 2 {
		t.Errorf("容量 2 时最多保留 2 项，实际 %d", total)
	}
}

// stubFetcher 用于测试注入自定义 Fetcher。
type stubFetcher struct{ img image.Image }

func (s stubFetcher) FetchImage(_ context.Context, _ string) (image.Image, error) {
	if s.img == nil {
		return nil, errors.New("no image")
	}
	return s.img, nil
}

// writeBuf 是一个极简的 bytes.Buffer 替代，避免在测试中反复 import bytes。
type writeBuf struct{ data []byte }

func (w *writeBuf) Write(p []byte) (int, error) {
	w.data = append(w.data, p...)
	return len(p), nil
}
func (w *writeBuf) Bytes() []byte { return w.data }
