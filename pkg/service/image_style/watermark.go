/*
 * @Description: 水印抽象与纯 Go 实现
 * @Author: 安知鱼
 *
 * Phase 1 只有 NoopWatermarker 占位；Phase 3 Task 3.4 在此补齐：
 *   - NativeWatermarker 基于 golang.org/x/image/font/opentype + image/draw，
 *     支持文本水印与图片水印。
 *   - 外部图片水印有进程内 LRU 缓存（默认 10 分钟 TTL / 64 条上限）。
 *   - 站内图片通过可选注入的 ImageFetcher 提取；未注入时退化为 http.Get。
 *
 * 设计约束：
 *   - Watermarker.Apply 接收已解码的 image.Image 与水印配置，返回叠加水印后的新图。
 *   - WatermarkConfig == nil 时 Service 必须不调用 Apply，以避免无谓分配。
 *   - 所有实现需并发安全（引擎可能同时处理多个请求）。
 */
package image_style

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/image/font"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"

	// 注册解码器，覆盖外部图片水印可能的格式。
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	_ "golang.org/x/image/webp"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/image_style/assets"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/image_style/engine"
)

// Watermarker 复用 engine 包的接口，避免重复定义造成类型分裂。
// 所有实现了 Apply(image.Image, *model.WatermarkConfig) (image.Image, error) 方法的类型
// 都同时满足 engine.Watermarker，可以被引擎与 Service 共用。
type Watermarker = engine.Watermarker

// NoopWatermarker 是占位实现；原样返回图片。
type NoopWatermarker struct{}

// Apply 实现 Watermarker 接口；无副作用。
func (NoopWatermarker) Apply(img image.Image, _ *model.WatermarkConfig) (image.Image, error) {
	return img, nil
}

// NewNoopWatermarker 构造一个占位水印实现。
func NewNoopWatermarker() Watermarker {
	return NoopWatermarker{}
}

// ImageFetcher 抽象水印图片获取能力，便于 pro 侧注入站内直链反查逻辑。
// 默认实现 defaultHTTPFetcher 仅支持 http/https。
type ImageFetcher interface {
	FetchImage(ctx context.Context, imageURL string) (image.Image, error)
}

// defaultHTTPFetcher 默认用 http.Client 拉取任意可解析 URL。
type defaultHTTPFetcher struct {
	client *http.Client
}

// FetchImage 通过 HTTP GET 下载图像字节并解码。
// 为了防止管理员配置被篡改后形成 SSRF，本实现做下列限制：
//  1. 仅允许 http/https 协议；
//  2. 解析 host 后禁止指向私网、环回、链路本地、广播/多播、以及
//     云厂商元数据地址（169.254.169.254 / fd00:ec2::254 等）；
//  3. 仅信任 DNS 解析后的第一条 IP 的校验结果，避免 "DNS rebind 到公网" 绕过；
//     传入的 host 若直接是 IP 字面量则直接对该 IP 做校验。
//  4. 请求体限制 10MB、响应状态需为 200。
func (f *defaultHTTPFetcher) FetchImage(ctx context.Context, imageURL string) (image.Image, error) {
	raw := strings.TrimSpace(imageURL)
	if raw == "" {
		return nil, fmt.Errorf("水印图片 URL 为空")
	}

	parsed, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("水印图片 URL 解析失败: %w", err)
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return nil, fmt.Errorf("水印图片仅支持 http/https: %s", raw)
	}
	host := parsed.Hostname()
	if host == "" {
		return nil, fmt.Errorf("水印图片 URL 缺少主机名")
	}
	if err := ssrfHostGuard(ctx, host); err != nil {
		return nil, fmt.Errorf("水印图片目标禁止访问: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, raw, nil)
	if err != nil {
		return nil, fmt.Errorf("构造水印图片请求失败: %w", err)
	}
	resp, err := f.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("下载水印图片失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("下载水印图片 HTTP %d", resp.StatusCode)
	}
	// 限制最多读取 10MB，防止恶意占用内存
	const maxBody = 10 << 20
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBody+1))
	if err != nil {
		return nil, fmt.Errorf("读取水印图片失败: %w", err)
	}
	if len(body) > maxBody {
		return nil, fmt.Errorf("水印图片超过 10MB 上限")
	}
	img, _, err := image.Decode(bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("解码水印图片失败: %w", err)
	}
	return img, nil
}

// ssrfDNSResolver 抽离 DNS 解析，便于测试注入。默认使用 net.DefaultResolver。
var ssrfDNSResolver = net.DefaultResolver

// ssrfHostGuard 是水印图片下载前的 host 校验钩子，默认走 ensureHostSafeForSSRF。
// 测试可以通过 DisableSSRFGuardForTest 临时替换为 noop，避免 httptest 的 127.0.0.1 被拒。
var ssrfHostGuard = ensureHostSafeForSSRF

// DisableSSRFGuardForTest 把 ssrf 校验替换为 noop，并返回恢复函数。仅供测试使用。
// 生产代码不应调用此方法；若不慎被调用，会取消所有目标 host 的 SSRF 保护。
func DisableSSRFGuardForTest() func() {
	prev := ssrfHostGuard
	ssrfHostGuard = func(ctx context.Context, host string) error { return nil }
	return func() { ssrfHostGuard = prev }
}

// ensureHostSafeForSSRF 对 host 做 SSRF 黑名单校验。
// 若 host 是 IP 字面量，直接 IP 校验；若是域名，用默认 DNS 解析出的所有地址都校验。
func ensureHostSafeForSSRF(ctx context.Context, host string) error {
	if ip := net.ParseIP(host); ip != nil {
		if err := checkIPAllowed(ip); err != nil {
			return err
		}
		return nil
	}
	addrs, err := ssrfDNSResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return fmt.Errorf("解析主机 %q 失败: %w", host, err)
	}
	if len(addrs) == 0 {
		return fmt.Errorf("主机 %q 无可用 IP", host)
	}
	for _, a := range addrs {
		if err := checkIPAllowed(a.IP); err != nil {
			return err
		}
	}
	return nil
}

// checkIPAllowed 拒绝私网、环回、链路本地、多播、广播、未指定以及常见云厂商元数据地址。
func checkIPAllowed(ip net.IP) error {
	if ip == nil {
		return fmt.Errorf("空 IP")
	}
	if ip.IsLoopback() {
		return fmt.Errorf("目标 %s 为环回地址", ip)
	}
	if ip.IsUnspecified() {
		return fmt.Errorf("目标 %s 为未指定地址", ip)
	}
	if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return fmt.Errorf("目标 %s 为链路本地地址", ip)
	}
	if ip.IsMulticast() {
		return fmt.Errorf("目标 %s 为多播地址", ip)
	}
	if ip.IsPrivate() {
		return fmt.Errorf("目标 %s 为私网地址", ip)
	}
	// 额外显式拦截云厂商元数据服务，防止部分云环境未归入 IsPrivate。
	for _, blocked := range metadataBlockList {
		if ip.Equal(blocked) {
			return fmt.Errorf("目标 %s 属于元数据/保留地址黑名单", ip)
		}
	}
	return nil
}

// metadataBlockList 汇总常见云厂商的实例元数据地址。
// 169.254.169.254 被 IsLinkLocalUnicast 覆盖，这里显式列出以便未来扩充与审计。
var metadataBlockList = []net.IP{
	net.ParseIP("169.254.169.254"),
	net.ParseIP("fd00:ec2::254"),
}

// imageCache 是一个带 TTL 的进程内图像缓存。
// 实现策略：map + 惰性过期 + 容量超限时按过期时间淘汰最近到期的项。
// 对于水印场景，URL 数量通常 < 100，这个朴素实现已足够。
type imageCache struct {
	mu   sync.Mutex
	ttl  time.Duration
	max  int
	data map[string]cacheEntry
}

type cacheEntry struct {
	img image.Image
	exp time.Time
}

func newImageCache(ttl time.Duration, max int) *imageCache {
	if max < 1 {
		max = 64
	}
	// ttl <= 0 视为未指定，使用默认 10 分钟；允许更小 ttl（便于测试与短周期场景）。
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}
	return &imageCache{ttl: ttl, max: max, data: make(map[string]cacheEntry, max)}
}

func (c *imageCache) Get(key string) (image.Image, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.data[key]
	if !ok {
		return nil, false
	}
	if time.Now().After(e.exp) {
		delete(c.data, key)
		return nil, false
	}
	return e.img, true
}

func (c *imageCache) Put(key string, img image.Image) {
	c.mu.Lock()
	defer c.mu.Unlock()
	// 超过容量时清理最早过期的 1 项
	if len(c.data) >= c.max {
		c.evictOldestLocked()
	}
	c.data[key] = cacheEntry{img: img, exp: time.Now().Add(c.ttl)}
}

func (c *imageCache) evictOldestLocked() {
	var oldestKey string
	var oldestExp time.Time
	first := true
	for k, e := range c.data {
		if first || e.exp.Before(oldestExp) {
			oldestKey = k
			oldestExp = e.exp
			first = false
		}
	}
	if oldestKey != "" {
		delete(c.data, oldestKey)
	}
}

// NativeWatermarker 使用纯 Go 库实现文本与图片水印。
// 字体在构造时解析并常驻；并发安全。
type NativeWatermarker struct {
	font    *opentype.Font
	fetcher ImageFetcher
	cache   *imageCache
}

// WatermarkOption 配置 NativeWatermarker 的可选依赖。
type WatermarkOption func(*NativeWatermarker)

// WithImageFetcher 注入自定义图片拉取实现（例如 pro 侧的站内直链反查）。
func WithImageFetcher(f ImageFetcher) WatermarkOption {
	return func(w *NativeWatermarker) {
		if f != nil {
			w.fetcher = f
		}
	}
}

// WithImageCache 注入自定义缓存（主要用于测试时注入可控 TTL）。
func WithImageCache(c *imageCache) WatermarkOption {
	return func(w *NativeWatermarker) {
		if c != nil {
			w.cache = c
		}
	}
}

// NewNativeWatermarker 构造一个使用 GoRegular 内置字体的水印渲染器。
// 若字体解析失败（理论上不会发生，因为字体是 go:embed 编译期嵌入），
// 会退化为 NoopWatermarker 并打印错误日志，保证启动不 panic；运维需关注此日志。
func NewNativeWatermarker(opts ...WatermarkOption) Watermarker {
	fnt, err := opentype.Parse(assets.GoRegular)
	if err != nil {
		log.Printf("[image_style] 加载内置字体 GoRegular 失败，水印功能降级为 Noop: %v", err)
		return NoopWatermarker{}
	}
	w := &NativeWatermarker{
		font:  fnt,
		cache: newImageCache(10*time.Minute, 64),
		fetcher: &defaultHTTPFetcher{
			client: &http.Client{Timeout: 5 * time.Second},
		},
	}
	for _, opt := range opts {
		opt(w)
	}
	return w
}

// Apply 根据 cfg.Type 分派到文本 / 图片水印；未识别或出错时返回原图与错误。
func (w *NativeWatermarker) Apply(img image.Image, cfg *model.WatermarkConfig) (image.Image, error) {
	if cfg == nil {
		return img, nil
	}
	switch strings.ToLower(strings.TrimSpace(cfg.Type)) {
	case "text", "":
		if strings.TrimSpace(cfg.Text) == "" {
			return img, nil
		}
		return w.applyText(img, cfg)
	case "image":
		if strings.TrimSpace(cfg.ImageURL) == "" {
			return img, nil
		}
		return w.applyImage(img, cfg)
	default:
		return nil, fmt.Errorf("未知的水印类型: %s", cfg.Type)
	}
}

// applyText 在源图上叠加文本水印。
func (w *NativeWatermarker) applyText(src image.Image, cfg *model.WatermarkConfig) (image.Image, error) {
	fontSize := cfg.FontSize
	if fontSize <= 0 {
		fontSize = 24 // 默认 24pt
	}

	face, err := opentype.NewFace(w.font, &opentype.FaceOptions{
		Size:    float64(fontSize),
		DPI:     72,
		Hinting: font.HintingFull,
	})
	if err != nil {
		return nil, fmt.Errorf("构建字体 face 失败: %w", err)
	}
	defer face.Close()

	// 计算文本 bounding box（像素）
	bounds, advance := font.BoundString(face, cfg.Text)
	textW := advance.Ceil()
	textH := (bounds.Max.Y - bounds.Min.Y).Ceil()
	if textW <= 0 || textH <= 0 {
		return src, nil
	}
	ascent := (-bounds.Min.Y).Ceil()

	drawColor := parseWatermarkColor(cfg.Color)
	drawColor.A = applyOpacity(drawColor.A, cfg.Opacity)

	// 将源图复制到可写的 RGBA 画布
	dst := imageToRGBA(src)

	// 计算粘贴位置 / tile 平铺
	positions := resolveWatermarkPositions(
		dst.Bounds().Dx(), dst.Bounds().Dy(),
		textW, textH,
		cfg.Position, cfg.OffsetX, cfg.OffsetY,
	)
	for _, p := range positions {
		d := &font.Drawer{
			Dst:  dst,
			Src:  image.NewUniform(drawColor),
			Face: face,
			Dot:  fixed.P(p.X, p.Y+ascent),
		}
		d.DrawString(cfg.Text)
	}
	return dst, nil
}

// applyImage 在源图上叠加图片水印，支持外部 URL（带缓存）与 ImageFetcher 注入。
func (w *NativeWatermarker) applyImage(src image.Image, cfg *model.WatermarkConfig) (image.Image, error) {
	wmImg, err := w.loadWatermarkImage(cfg.ImageURL)
	if err != nil {
		return nil, err
	}

	dst := imageToRGBA(src)
	dstBounds := dst.Bounds()
	wmBounds := wmImg.Bounds()
	positions := resolveWatermarkPositions(
		dstBounds.Dx(), dstBounds.Dy(),
		wmBounds.Dx(), wmBounds.Dy(),
		cfg.Position, cfg.OffsetX, cfg.OffsetY,
	)

	alpha := applyOpacity(255, cfg.Opacity)
	mask := image.NewUniform(color.RGBA{A: alpha})

	for _, p := range positions {
		r := image.Rect(p.X, p.Y, p.X+wmBounds.Dx(), p.Y+wmBounds.Dy())
		draw.DrawMask(dst, r, wmImg, wmBounds.Min, mask, image.Point{}, draw.Over)
	}
	return dst, nil
}

// loadWatermarkImage 命中缓存时直接返回；否则通过 fetcher 拉取并写缓存。
func (w *NativeWatermarker) loadWatermarkImage(url string) (image.Image, error) {
	key := strings.TrimSpace(url)
	if key == "" {
		return nil, fmt.Errorf("水印图片 URL 为空")
	}
	if img, ok := w.cache.Get(key); ok {
		return img, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	img, err := w.fetcher.FetchImage(ctx, key)
	if err != nil {
		return nil, err
	}
	w.cache.Put(key, img)
	return img, nil
}

// imageToRGBA 返回一个与 src 等大的新 *image.RGBA 副本。
// 始终创建新副本，避免直接修改调用方持有的图像引用（满足 Watermarker 不修改入参的约定）。
func imageToRGBA(src image.Image) *image.RGBA {
	b := src.Bounds()
	// 对齐到 (0,0) 起点，简化后续位置计算
	dst := image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(dst, dst.Bounds(), src, b.Min, draw.Src)
	return dst
}

// parseWatermarkColor 解析 #rgb / #rrggbb / #rrggbbaa；无效时返回不透明白。
func parseWatermarkColor(hex string) color.RGBA {
	s := strings.TrimPrefix(strings.TrimSpace(hex), "#")
	if s == "" {
		return color.RGBA{R: 255, G: 255, B: 255, A: 255}
	}
	switch len(s) {
	case 3:
		r := parseHexByte(string(s[0]) + string(s[0]))
		g := parseHexByte(string(s[1]) + string(s[1]))
		b := parseHexByte(string(s[2]) + string(s[2]))
		return color.RGBA{R: r, G: g, B: b, A: 255}
	case 6:
		r := parseHexByte(s[0:2])
		g := parseHexByte(s[2:4])
		b := parseHexByte(s[4:6])
		return color.RGBA{R: r, G: g, B: b, A: 255}
	case 8:
		r := parseHexByte(s[0:2])
		g := parseHexByte(s[2:4])
		b := parseHexByte(s[4:6])
		a := parseHexByte(s[6:8])
		return color.RGBA{R: r, G: g, B: b, A: a}
	}
	return color.RGBA{R: 255, G: 255, B: 255, A: 255}
}

func parseHexByte(s string) uint8 {
	v, err := strconv.ParseUint(s, 16, 8)
	if err != nil {
		return 0
	}
	return uint8(v)
}

// applyOpacity 把 0.0-1.0 的 opacity 折算到已有 alpha 通道上；
// opacity <= 0 时视作未指定，保持原 alpha（即完全不透明）。
func applyOpacity(base uint8, opacity float64) uint8 {
	if opacity <= 0 {
		return base
	}
	if opacity >= 1.0 {
		return base
	}
	combined := float64(base) * opacity
	if combined < 0 {
		combined = 0
	}
	if combined > 255 {
		combined = 255
	}
	return uint8(combined)
}

// resolveWatermarkPositions 计算水印贴图的左上角坐标列表。
// 对于 tile 模式返回多个点（按水印尺寸 + offset 做间隔平铺）；
// 其他模式返回单个点。
func resolveWatermarkPositions(dstW, dstH, wmW, wmH int, position string, ox, oy int) []image.Point {
	position = strings.ToLower(strings.TrimSpace(position))
	if position == "" {
		position = "bottom-right"
	}

	switch position {
	case "top-left":
		return []image.Point{{X: ox, Y: oy}}
	case "top-right":
		return []image.Point{{X: dstW - wmW - ox, Y: oy}}
	case "bottom-left":
		return []image.Point{{X: ox, Y: dstH - wmH - oy}}
	case "bottom-right":
		return []image.Point{{X: dstW - wmW - ox, Y: dstH - wmH - oy}}
	case "center":
		return []image.Point{{X: (dstW-wmW)/2 + ox, Y: (dstH-wmH)/2 + oy}}
	case "tile":
		stepX := wmW + ox
		stepY := wmH + oy
		if stepX < wmW {
			stepX = wmW
		}
		if stepY < wmH {
			stepY = wmH
		}
		// 防御性：step 为 0 或负会导致 for 循环死循环，强制最小步长 1。
		if stepX <= 0 {
			stepX = 1
		}
		if stepY <= 0 {
			stepY = 1
		}
		var pts []image.Point
		for y := 0; y < dstH; y += stepY {
			for x := 0; x < dstW; x += stepX {
				pts = append(pts, image.Point{X: x, Y: y})
			}
		}
		return pts
	default:
		return []image.Point{{X: dstW - wmW - ox, Y: dstH - wmH - oy}}
	}
}
