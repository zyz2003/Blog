/*
 * @Description: libvips CLI 引擎实现
 * @Author: 安知鱼
 *
 * Phase 2 Task 2.2：通过管道驱动 `vips thumbnail_source` 完成格式转换 + 缩放。
 * Phase 3 Task 3.5：水印场景采用"vips 生成 PNG → Go 加水印 → vips 转目标格式"的三阶段
 *   pipeline，让 vips 继续负责 HEIC/AVIF/WebP 等格式的编解码，水印由纯 Go 叠加；
 *   以 PNG 作为中间载体保证无损传输。
 *
 * 设计要点：
 *   1. 无水印路径命令形式：
 *        vips --vips-concurrency=2 thumbnail_source '[descriptor=0]' '.{fmt}[Q=q]' W [--height H] [--size down] [--crop centre] [--no-rotate]
 *      stdin 作为 source，stdout 直接拿到目标格式。避免落盘。
 *   2. 有水印路径：
 *        阶段 1：vips thumbnail_source → PNG (resize + 可选 EXIF 旋转)
 *        阶段 2：Go decode → watermarker.Apply → Go encode PNG
 *        阶段 3：vips copy 把 PNG 转为目标格式（仅当 outFormat != png 时需要）
 *   3. 尺寸处理：
 *        - cover   → thumbnail + --crop centre
 *        - contain/fit-inside → thumbnail（不加 crop）
 *        - scale   → 先用 image.DecodeConfig 读源图尺寸（JPEG/PNG/GIF/WebP 支持），再算 W/H
 *        - 其他 mode 或三者都 ≤ 0 → width 填超大常量 + --size down 保持原尺寸
 *   4. 超时：默认 30s；若 ctx 已带 deadline 则遵循 ctx 的 deadline。
 *   5. 并发：--vips-concurrency=2 抑制内部线程风暴，配合 Service 层 singleflight 足够。
 *   6. EXIF 自动旋转：thumbnail_source 默认会按 EXIF 旋转；AutoRotate=false 时加 --no-rotate。
 *   7. 错误识别：命令退出非 0 + stderr 命中"no known saver/no loader"等关键字 →
 *      返回 ErrFormatUnsupported，由 AutoEngine 走格式降级。
 *
 * 已知约束：
 *   - scale 模式 + HEIC/AVIF（Go 标准库读不到尺寸，退化为不缩放仅做格式转换）
 */
package engine

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/png"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

const (
	// vipsDefaultTimeout 为未在 ctx 指定 deadline 时的兜底超时。
	vipsDefaultTimeout = 30 * time.Second
	// vipsDefaultConcurrency 限制单次命令使用的线程数，避免多请求时线程爆炸。
	vipsDefaultConcurrency = 2
	// vipsNoResizeWidth 是"不需要 resize"的占位 width，
	// 配合 --size down 可在不放大原图的前提下保持原尺寸输出。
	vipsNoResizeWidth = 1000000
)

// VipsEngine 是基于外部 `vips` CLI 的图像处理引擎。
// 构造前建议调用 Probe() 获取 Capability，以便决定是否启用本引擎。
type VipsEngine struct {
	binaryPath  string
	capability  VipsCapability
	watermarker Watermarker
}

// VipsOption 配置 VipsEngine 的可选依赖。
type VipsOption func(*VipsEngine)

// WithVipsWatermarker 注入水印实现；为空时使用 NoopWatermarker。
// Phase 3.4 仅保存依赖，Phase 3.5 的 vips composite 路径会真正使用。
func WithVipsWatermarker(wm Watermarker) VipsOption {
	return func(v *VipsEngine) {
		if wm != nil {
			v.watermarker = wm
		}
	}
}

// NewVipsEngine 按探测结果构造 VipsEngine。
// 调用方需要保证 cap.Available 为 true 且 BinaryPath 非空；
// 否则构造出来的引擎会在 Process 时报错。
func NewVipsEngine(cap VipsCapability, opts ...VipsOption) *VipsEngine {
	v := &VipsEngine{
		binaryPath:  cap.BinaryPath,
		capability:  cap,
		watermarker: NoopWatermarker(),
	}
	for _, opt := range opts {
		opt(v)
	}
	return v
}

// Name 返回引擎标识。
func (v *VipsEngine) Name() string { return "vips" }

// SupportedInputFormats 从 capability 映射；返回副本避免外部篡改。
func (v *VipsEngine) SupportedInputFormats() []string {
	return append([]string(nil), v.capability.InputFormats...)
}

// SupportedOutputFormats 从 capability 映射；返回副本避免外部篡改。
func (v *VipsEngine) SupportedOutputFormats() []string {
	return append([]string(nil), v.capability.OutputFormats...)
}

// Process 将 src 按 style 处理并写入 dst，返回输出 MIME。
// 若目标格式不受 vips 支持（capability 预检或 stderr 命中关键字），返回 ErrFormatUnsupported。
// 当 style.Watermark != nil 时走 processWithWatermark 的三阶段 pipeline。
func (v *VipsEngine) Process(ctx context.Context, src io.Reader, style model.ImageStyleConfig, dst io.Writer) (string, error) {
	if v.binaryPath == "" {
		return "", errors.New("vips engine: 未配置 vips 可执行路径")
	}

	// 读入内存：一来 scale 模式需要先读 header；二来 stderr 若报格式错误，我们还需要带上源字节数做诊断（最小化）。
	buf, err := io.ReadAll(src)
	if err != nil {
		return "", fmt.Errorf("读取源图失败: %w", err)
	}
	if len(buf) == 0 {
		return "", errors.New("源图为空")
	}

	inputFormat := detectFormatFromMagic(buf)
	outFormat := resolveOutputFormat(style.Format, inputFormat)
	if !v.isOutputFormatSupported(outFormat) {
		return "", ErrFormatUnsupported
	}

	if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, vipsDefaultTimeout)
		defer cancel()
	}

	if style.Watermark != nil {
		return v.processWithWatermark(ctx, buf, style, outFormat, dst)
	}

	args := v.buildArgs(outFormat, style, buf)
	if err := v.runVips(ctx, args, buf, dst); err != nil {
		return "", err
	}
	return mimeForFormat(outFormat), nil
}

// runVips 统一执行 vips 子进程的逻辑：stdin → 进程 → stdout。
// 识别格式不支持关键字并返回 ErrFormatUnsupported 供上层降级；其他错误带上 stderr 摘要。
func (v *VipsEngine) runVips(ctx context.Context, args []string, stdin []byte, stdout io.Writer) error {
	cmd := exec.CommandContext(ctx, v.binaryPath, args...)
	cmd.Stdin = bytes.NewReader(stdin)
	cmd.Stdout = stdout
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if isVipsFormatUnsupportedErr(stderr.String()) {
			return ErrFormatUnsupported
		}
		return fmt.Errorf("vips 执行失败: %w; stderr: %s", err, strings.TrimSpace(stderr.String()))
	}
	return nil
}

// processWithWatermark 实现"vips→PNG / Go watermark / vips→目标格式"的三阶段 pipeline。
//
// 阶段 1：vips thumbnail_source 输出 PNG（完成 resize 与 EXIF 旋转）。
// 阶段 2：Go 端解码 PNG → watermarker.Apply → 重新编码 PNG（无损中间态）。
// 阶段 3：若目标格式不是 PNG，再用 vips copy 把中间 PNG 转为目标格式（webp/avif/heic/jpg）。
//
// 该路径显然比无水印路径慢（多一次 vips 子进程），Phase 3 以功能正确性优先；
// 后续如有性能诉求可考虑真正的 vips composite 原生指令。
func (v *VipsEngine) processWithWatermark(
	ctx context.Context,
	raw []byte,
	style model.ImageStyleConfig,
	outFormat string,
	dst io.Writer,
) (string, error) {
	// 阶段 1：vips → PNG。清掉 Watermark 避免递归，并把 format 固定为 png。
	intermediateStyle := style
	intermediateStyle.Format = "png"
	intermediateStyle.Quality = 0
	intermediateStyle.Watermark = nil

	args1 := v.buildArgs("png", intermediateStyle, raw)
	var pngBuf bytes.Buffer
	if err := v.runVips(ctx, args1, raw, &pngBuf); err != nil {
		return "", err
	}

	// 阶段 2：Go 解码 → watermark → 重新编码 PNG
	img, err := png.Decode(bytes.NewReader(pngBuf.Bytes()))
	if err != nil {
		return "", fmt.Errorf("vips 中间 PNG 解码失败: %w", err)
	}
	wmImg, err := v.watermarker.Apply(img, style.Watermark)
	if err != nil {
		return "", fmt.Errorf("水印叠加失败: %w", err)
	}
	var wmPNG bytes.Buffer
	if err := png.Encode(&wmPNG, wmImg); err != nil {
		return "", fmt.Errorf("水印后 PNG 编码失败: %w", err)
	}

	// 阶段 3：若目标是 PNG，直接透传；否则让 vips 做最终格式转换。
	if outFormat == "png" {
		if _, err := io.Copy(dst, &wmPNG); err != nil {
			return "", fmt.Errorf("写出 PNG 失败: %w", err)
		}
		return mimeForFormat("png"), nil
	}

	// vips CLI 的 copy 子命令不接受 `[descriptor=0]` 形式的 stdin，
	// 这里把中间 PNG 写入临时文件再交给 vips 做格式转换。
	tmpIn, err := os.CreateTemp("", "anheyu-vips-wm-*.png")
	if err != nil {
		return "", fmt.Errorf("创建水印临时文件失败: %w", err)
	}
	defer os.Remove(tmpIn.Name())
	if _, err := tmpIn.Write(wmPNG.Bytes()); err != nil {
		_ = tmpIn.Close()
		return "", fmt.Errorf("写入水印临时文件失败: %w", err)
	}
	if err := tmpIn.Close(); err != nil {
		return "", fmt.Errorf("关闭水印临时文件失败: %w", err)
	}

	args3 := []string{
		fmt.Sprintf("--vips-concurrency=%d", vipsDefaultConcurrency),
		"copy",
		tmpIn.Name(),
		buildVipsOutputSpec(outFormat, style.Quality),
	}
	if err := v.runVips(ctx, args3, nil, dst); err != nil {
		return "", err
	}
	return mimeForFormat(outFormat), nil
}

// buildArgs 组装 vips 命令行参数（不含可执行路径本身）。
func (v *VipsEngine) buildArgs(outFormat string, style model.ImageStyleConfig, raw []byte) []string {
	args := []string{
		fmt.Sprintf("--vips-concurrency=%d", vipsDefaultConcurrency),
		"thumbnail_source",
		"[descriptor=0]",
		buildVipsOutputSpec(outFormat, style.Quality),
	}

	width, height, crop := resolveVipsResizeArgs(style.Resize, raw)
	args = append(args, strconv.Itoa(width))
	if height > 0 {
		args = append(args, "--height", strconv.Itoa(height))
	}
	// 默认禁止放大；style.Resize.Enlarge=true 时允许放大。
	if !style.Resize.Enlarge {
		args = append(args, "--size", "down")
	}
	if crop != "" {
		args = append(args, "--crop", crop)
	}
	if !style.AutoRotate {
		args = append(args, "--no-rotate")
	}
	return args
}

// buildVipsOutputSpec 构造 vips 输出后缀串，形如 `.webp[Q=80]` / `.png` 等。
// 对没有 quality 概念的 PNG/GIF 省略方括号。
func buildVipsOutputSpec(format string, quality int) string {
	q := clampQuality(quality)
	switch format {
	case "jpg", "jpeg":
		return fmt.Sprintf(".jpg[Q=%d]", defaultQualityIfZero(q, 75))
	case "webp":
		return fmt.Sprintf(".webp[Q=%d]", defaultQualityIfZero(q, 80))
	case "avif":
		return fmt.Sprintf(".avif[Q=%d]", defaultQualityIfZero(q, 50))
	case "heic", "heif":
		return fmt.Sprintf(".heic[Q=%d]", defaultQualityIfZero(q, 80))
	case "png":
		return ".png"
	case "gif":
		return ".gif"
	case "tiff":
		return ".tiff"
	default:
		return "." + format
	}
}

func clampQuality(q int) int {
	if q < 0 {
		return 0
	}
	if q > 100 {
		return 100
	}
	return q
}

func defaultQualityIfZero(q, def int) int {
	if q == 0 {
		return def
	}
	return q
}

// resolveVipsResizeArgs 把 Resize 配置翻译成 thumbnail_source 参数。
func resolveVipsResizeArgs(rc model.ImageResizeConfig, raw []byte) (width, height int, crop string) {
	switch rc.Mode {
	case "cover":
		w, h := rc.Width, rc.Height
		if w <= 0 && h <= 0 {
			return vipsNoResizeWidth, 0, ""
		}
		if w <= 0 {
			w = vipsNoResizeWidth
		}
		if h < 0 {
			h = 0
		}
		return w, h, "centre"

	case "contain", "fit-inside":
		w, h := rc.Width, rc.Height
		if w <= 0 && h <= 0 {
			return vipsNoResizeWidth, 0, ""
		}
		if w <= 0 {
			w = vipsNoResizeWidth
		}
		if h < 0 {
			h = 0
		}
		return w, h, ""

	case "scale":
		if rc.Scale <= 0 {
			return vipsNoResizeWidth, 0, ""
		}
		srcW, srcH, ok := decodeDimensions(raw)
		if !ok {
			// 无法读到尺寸（如 HEIC/AVIF）→ 退化为不 resize。
			return vipsNoResizeWidth, 0, ""
		}
		w := int(float64(srcW) * rc.Scale)
		h := int(float64(srcH) * rc.Scale)
		if w <= 0 || h <= 0 {
			return vipsNoResizeWidth, 0, ""
		}
		return w, h, ""

	default:
		return vipsNoResizeWidth, 0, ""
	}
}

// decodeDimensions 使用 image.DecodeConfig 读 JPEG/PNG/GIF/WebP 的尺寸。
// HEIC/AVIF 未注册在标准库里，会返回 false；由上层决定如何降级。
func decodeDimensions(data []byte) (w, h int, ok bool) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return 0, 0, false
	}
	return cfg.Width, cfg.Height, true
}

// detectFormatFromMagic 通过魔数识别输入格式。
// 只覆盖 image/image_style 目前声明的几类；识别失败返回 ""。
func detectFormatFromMagic(buf []byte) string {
	if len(buf) < 12 {
		return ""
	}
	switch {
	case buf[0] == 0xFF && buf[1] == 0xD8 && buf[2] == 0xFF:
		return "jpeg"
	case bytes.HasPrefix(buf, []byte("\x89PNG\r\n\x1a\n")):
		return "png"
	case bytes.HasPrefix(buf, []byte("GIF87a")) || bytes.HasPrefix(buf, []byte("GIF89a")):
		return "gif"
	case bytes.HasPrefix(buf, []byte("RIFF")) && bytes.Equal(buf[8:12], []byte("WEBP")):
		return "webp"
	case bytes.Equal(buf[4:8], []byte("ftyp")):
		// HEIF family，通过 ftyp brand 区分。
		brand := string(buf[8:12])
		switch brand {
		case "avif", "avis":
			return "avif"
		case "heic", "heix", "mif1", "msf1", "heis":
			return "heic"
		}
		return "heic"
	}
	return ""
}

// isOutputFormatSupported 通过 capability 预检输出格式。
func (v *VipsEngine) isOutputFormatSupported(format string) bool {
	norm := normalizeImageFormat(format)
	for _, f := range v.capability.OutputFormats {
		if normalizeImageFormat(f) == norm {
			return true
		}
	}
	return false
}

// mimeForFormat 把内部格式标识映射为 HTTP MIME 字符串。
func mimeForFormat(f string) string {
	switch f {
	case "jpg", "jpeg":
		return "image/jpeg"
	case "png":
		return "image/png"
	case "webp":
		return "image/webp"
	case "gif":
		return "image/gif"
	case "avif":
		return "image/avif"
	case "heic", "heif":
		return "image/heic"
	case "tiff":
		return "image/tiff"
	default:
		return "application/octet-stream"
	}
}

// isVipsFormatUnsupportedErr 判断 stderr 是否表达"不支持该格式"。
// vips 在不同版本可能输出不同文案；这里取常见关键字。
func isVipsFormatUnsupportedErr(stderr string) bool {
	s := strings.ToLower(stderr)
	for _, kw := range []string{
		"no known saver",
		"no known target",
		"no loader",
		"unknown suffix",
		"no such operation",
		"not supported",
	} {
		if strings.Contains(s, kw) {
			return true
		}
	}
	return false
}

// 静态断言 VipsEngine 实现 Engine 接口。
var _ Engine = (*VipsEngine)(nil)
