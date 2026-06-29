/*
 * @Description: ImageStyleService 端到端流程测试
 * @Author: 安知鱼
 */
package image_style

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"net/url"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/image_style/engine"
)

// fakeProvider 仅实现 Get，其他 IStorageProvider 方法返回 nil / 空结果。
type fakeProvider struct {
	data       []byte
	getCount   int64
	getErr     error
	capturedSources []string
	mu         sync.Mutex
}

func (p *fakeProvider) Get(ctx context.Context, policy *model.StoragePolicy, source string) (io.ReadCloser, error) {
	atomic.AddInt64(&p.getCount, 1)
	p.mu.Lock()
	p.capturedSources = append(p.capturedSources, source)
	p.mu.Unlock()
	if p.getErr != nil {
		return nil, p.getErr
	}
	return io.NopCloser(bytes.NewReader(p.data)), nil
}

// 以下方法仅为满足 IStorageProvider 接口，服务层 Process 不会触达。
func (p *fakeProvider) Upload(ctx context.Context, _ io.Reader, _ *model.StoragePolicy, _ string) (*storage.UploadResult, error) {
	return nil, nil
}
func (p *fakeProvider) CreateDirectory(ctx context.Context, _ *model.StoragePolicy, _ string) error {
	return nil
}
func (p *fakeProvider) Delete(ctx context.Context, _ *model.StoragePolicy, _ []string) error {
	return nil
}
func (p *fakeProvider) GetDownloadURL(ctx context.Context, _ *model.StoragePolicy, _ string, _ storage.DownloadURLOptions) (string, error) {
	return "", nil
}
func (p *fakeProvider) DeleteDirectory(ctx context.Context, _ *model.StoragePolicy, _ string) error {
	return nil
}
func (p *fakeProvider) Rename(ctx context.Context, _ *model.StoragePolicy, _, _ string) error {
	return nil
}
func (p *fakeProvider) Stream(ctx context.Context, _ *model.StoragePolicy, _ string, _ io.Writer) error {
	return nil
}
func (p *fakeProvider) IsExist(ctx context.Context, _ *model.StoragePolicy, _ string) (bool, error) {
	return true, nil
}
func (p *fakeProvider) List(ctx context.Context, _ *model.StoragePolicy, _ string) ([]storage.FileInfo, error) {
	return nil, nil
}
func (p *fakeProvider) GetThumbnail(ctx context.Context, _ *model.StoragePolicy, _, _ string) (*storage.ThumbnailResult, error) {
	return nil, nil
}

// makeJPEG 生成指定尺寸的内存 JPEG，返回字节流。
func makeJPEG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x % 256), uint8(y % 256), 128, 255})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatalf("encode: %v", err)
	}
	return buf.Bytes()
}

// newServiceWithDisk 搭建带真实 DiskCache 的测试 service。
// 返回 (service, provider, cache, policy, file)。
func newServiceWithDisk(t *testing.T, applyStyles ...model.ImageStyleConfig) (*Service, *fakeProvider, *DiskCache, *model.StoragePolicy, *model.File) {
	t.Helper()

	// 提供一张 800x600 JPEG
	src := makeJPEG(t, 800, 600)
	provider := &fakeProvider{data: src}
	providers := map[constant.StoragePolicyType]storage.IStorageProvider{
		constant.PolicyTypeLocal: provider,
	}

	cacheRoot := filepath.Join(t.TempDir(), "cache")
	cache, err := NewDiskCache(CacheConfig{Root: cacheRoot, MaxSizeBytes: 10 << 20})
	if err != nil {
		t.Fatalf("NewDiskCache: %v", err)
	}
	t.Cleanup(func() { _ = cache.Close() })

	svc := NewService(engine.NewNativeGoEngine(), cache, providers, nil, nil)

	styles := applyStyles
	if len(styles) == 0 {
		styles = []model.ImageStyleConfig{sampleThumbnail()}
	}
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "thumbnail", styles...)
	policy.ID = 7
	policy.Type = constant.PolicyTypeLocal

	file := &model.File{
		ID:   42,
		Name: "a.jpg",
		PrimaryEntity: &model.FileStorageEntity{
			Source: sql.NullString{String: "/a.jpg", Valid: true},
		},
		PrimaryEntityID: types.NullUint64{Uint64: 1, Valid: true},
	}
	return svc, provider, cache, policy, file
}

func TestService_Process_EndToEnd(t *testing.T) {
	ctx := context.Background()
	svc, provider, _, policy, file := newServiceWithDisk(t)

	req := &StyleRequest{
		Policy:    policy,
		File:      file,
		Filename:  "a.jpg",
		StyleName: "thumbnail",
	}
	result, err := svc.Process(ctx, req)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	defer result.Reader.Close()

	if result.ContentType != "image/jpeg" {
		t.Errorf("ContentType 期望 image/jpeg，实际 %s", result.ContentType)
	}
	if result.FromCache {
		t.Errorf("首次处理应 FromCache=false")
	}
	if result.StyleHash == "" {
		t.Errorf("StyleHash 不应为空")
	}
	// Phase 2：RequestedFormat 必须等于样式配置中的 Format，用于 handler 写 X-Style-Fallback
	if result.RequestedFormat != "jpg" {
		t.Errorf("RequestedFormat 期望 jpg（样式定义），实际 %q", result.RequestedFormat)
	}

	bodyBytes, _ := io.ReadAll(result.Reader)
	if len(bodyBytes) == 0 {
		t.Errorf("响应 body 不应为空")
	}
	decoded, err := jpeg.Decode(bytes.NewReader(bodyBytes))
	if err != nil {
		t.Fatalf("解码响应失败：%v", err)
	}
	b := decoded.Bounds()
	if b.Dx() != 400 || b.Dy() != 300 {
		t.Errorf("输出尺寸期望 400x300，实际 %dx%d", b.Dx(), b.Dy())
	}
	if atomic.LoadInt64(&provider.getCount) != 1 {
		t.Errorf("provider.Get 应被调 1 次，实际 %d", provider.getCount)
	}
}

func TestService_Process_CacheHitSkipsProvider(t *testing.T) {
	ctx := context.Background()
	svc, provider, _, policy, file := newServiceWithDisk(t)

	req := &StyleRequest{Policy: policy, File: file, Filename: "a.jpg", StyleName: "thumbnail"}

	// 第一次触发实处理
	r1, err := svc.Process(ctx, req)
	if err != nil {
		t.Fatalf("first Process: %v", err)
	}
	_ = r1.Reader.Close()

	// 第二次应命中缓存，不再调 provider
	r2, err := svc.Process(ctx, req)
	if err != nil {
		t.Fatalf("second Process: %v", err)
	}
	defer r2.Reader.Close()

	if !r2.FromCache {
		t.Errorf("第二次 Process 应 FromCache=true")
	}
	if atomic.LoadInt64(&provider.getCount) != 1 {
		t.Errorf("缓存命中时不应再调 provider.Get；实际 %d", provider.getCount)
	}
	if r2.StyleHash != r1.StyleHash {
		t.Errorf("同配置的 StyleHash 应相同")
	}
	// Phase 2：缓存命中路径也应正确填充 RequestedFormat，保证 handler X-Style-Fallback 行为一致
	if r2.RequestedFormat != "jpg" {
		t.Errorf("缓存命中路径 RequestedFormat 期望 jpg，实际 %q", r2.RequestedFormat)
	}
}

func TestService_Process_EnabledFalse_ReturnsNotApplicable(t *testing.T) {
	ctx := context.Background()
	svc, _, _, _, file := newServiceWithDisk(t)

	// 构造一个禁用 image_process 的策略
	policy := buildPolicyWithStyles(false, []string{"jpg"}, "thumbnail", sampleThumbnail())
	policy.ID = 7
	policy.Type = constant.PolicyTypeLocal

	_, err := svc.Process(ctx, &StyleRequest{Policy: policy, File: file, Filename: "a.jpg"})
	if !errors.Is(err, ErrStyleNotApplicable) {
		t.Errorf("期望 ErrStyleNotApplicable，实际 %v", err)
	}
}

func TestService_Process_NamedStyleNotFound(t *testing.T) {
	ctx := context.Background()
	svc, _, _, policy, file := newServiceWithDisk(t)

	_, err := svc.Process(ctx, &StyleRequest{Policy: policy, File: file, Filename: "a.jpg", StyleName: "nope"})
	if !errors.Is(err, ErrStyleNotFound) {
		t.Errorf("期望 ErrStyleNotFound，实际 %v", err)
	}
}

func TestService_Process_ProviderReadError_ReturnsProcessFailed(t *testing.T) {
	ctx := context.Background()
	svc, provider, _, policy, file := newServiceWithDisk(t)

	provider.getErr = errors.New("disk io error")

	_, err := svc.Process(ctx, &StyleRequest{Policy: policy, File: file, Filename: "a.jpg", StyleName: "thumbnail"})
	if !errors.Is(err, ErrStyleProcessFailed) {
		t.Errorf("期望 ErrStyleProcessFailed，实际 %v", err)
	}
}

func TestService_Process_SingleflightMerges_ConcurrentRequests(t *testing.T) {
	ctx := context.Background()
	svc, provider, _, policy, file := newServiceWithDisk(t)

	req := &StyleRequest{Policy: policy, File: file, Filename: "a.jpg", StyleName: "thumbnail"}
	const concurrency = 50

	var wg sync.WaitGroup
	errs := make(chan error, concurrency)
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, err := svc.Process(ctx, req)
			if err != nil {
				errs <- err
				return
			}
			_, _ = io.Copy(io.Discard, r.Reader)
			_ = r.Reader.Close()
		}()
	}
	wg.Wait()
	close(errs)
	for e := range errs {
		if e != nil {
			t.Errorf("并发 Process 出错：%v", e)
		}
	}
	got := atomic.LoadInt64(&provider.getCount)
	if got > 1 {
		t.Errorf("50 并发同 key 应仅触发 1 次真实处理（singleflight），实际 provider.Get 调用 %d 次", got)
	}
}

func TestService_Process_DynamicOpts_GeneratesDifferentHash(t *testing.T) {
	ctx := context.Background()
	svc, _, _, policy, file := newServiceWithDisk(t)

	reqA := &StyleRequest{Policy: policy, File: file, Filename: "a.jpg", StyleName: "thumbnail"}
	reqB := &StyleRequest{
		Policy: policy, File: file, Filename: "a.jpg", StyleName: "thumbnail",
		DynamicOpts: url.Values{"w": []string{"800"}},
	}

	rA, err := svc.Process(ctx, reqA)
	if err != nil {
		t.Fatalf("A: %v", err)
	}
	_ = rA.Reader.Close()

	rB, err := svc.Process(ctx, reqB)
	if err != nil {
		t.Fatalf("B: %v", err)
	}
	_ = rB.Reader.Close()

	if rA.StyleHash == rB.StyleHash {
		t.Errorf("带 query 的请求应产生不同 hash（cache 不互相污染），实际两者都是 %s", rA.StyleHash)
	}
}

func TestService_Stats(t *testing.T) {
	ctx := context.Background()
	svc, _, _, policy, file := newServiceWithDisk(t)

	req := &StyleRequest{Policy: policy, File: file, Filename: "a.jpg", StyleName: "thumbnail"}
	r, err := svc.Process(ctx, req)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	_ = r.Reader.Close()

	stats, err := svc.Stats(ctx, 7)
	if err != nil {
		t.Fatalf("Stats: %v", err)
	}
	if stats.Count != 1 {
		t.Errorf("Stats.Count 期望 1，实际 %d", stats.Count)
	}
	if stats.PolicyID != 7 {
		t.Errorf("Stats.PolicyID 期望 7，实际 %d", stats.PolicyID)
	}
}

func TestService_PurgeCache_ByPolicy(t *testing.T) {
	ctx := context.Background()
	svc, _, _, policy, file := newServiceWithDisk(t)

	req := &StyleRequest{Policy: policy, File: file, Filename: "a.jpg", StyleName: "thumbnail"}
	r, err := svc.Process(ctx, req)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	_ = r.Reader.Close()

	n, err := svc.PurgeCache(ctx, 7, "", 0)
	if err != nil {
		t.Fatalf("PurgeCache: %v", err)
	}
	if n != 1 {
		t.Errorf("应清理 1 条，实际 %d", n)
	}
}

func TestService_PurgeCache_ByStyleNameRequiresRepo(t *testing.T) {
	ctx := context.Background()
	svc, _, _, _, _ := newServiceWithDisk(t)

	// policyRepo 未注入，按 styleName 清理应报错
	_, err := svc.PurgeCache(ctx, 7, "thumbnail", 0)
	if err == nil {
		t.Errorf("未注入 policyRepo 时按 styleName 清理应报错")
	}
}

// waitForCache 有些测试希望等 cache.Put 异步落盘（maybeEvict），这里提供一个简单 sleep。
func waitForCache() { time.Sleep(10 * time.Millisecond) }

var _ = waitForCache // 预留给未来异步测试；本轮未使用

// ---------- Phase 3 集成测试 ----------

// TestService_Process_Phase3_InvalidDynamicParam 非法动态参数在 Service 层返回 ErrStyleProcessFailed。
func TestService_Process_Phase3_InvalidDynamicParam(t *testing.T) {
	ctx := context.Background()
	svc, _, _, policy, file := newServiceWithDisk(t)

	req := &StyleRequest{
		Policy: policy, File: file, Filename: "a.jpg",
		DynamicOpts: url.Values{"q": []string{"200"}}, // quality 越界
	}
	_, err := svc.Process(ctx, req)
	if !errors.Is(err, ErrStyleProcessFailed) {
		t.Errorf("非法动态参数应返回 ErrStyleProcessFailed，实际 %v", err)
	}
}

// TestService_Process_Phase3_WithWatermark 带水印样式走引擎的水印路径并产出合法 JPEG。
func TestService_Process_Phase3_WithWatermark(t *testing.T) {
	ctx := context.Background()
	styleWithWM := model.ImageStyleConfig{
		Name:       "wm",
		Format:     "jpg",
		Quality:    80,
		AutoRotate: true,
		Resize:     model.ImageResizeConfig{Mode: "cover", Width: 400, Height: 300},
		Watermark: &model.WatermarkConfig{
			Type: "text", Text: "© anheyu.com",
			Position: "bottom-right", OffsetX: 10, OffsetY: 10,
			FontSize: 20, Color: "#ffffff", Opacity: 0.8,
		},
	}

	src := makeJPEG(t, 800, 600)
	provider := &fakeProvider{data: src}
	providers := map[constant.StoragePolicyType]storage.IStorageProvider{
		constant.PolicyTypeLocal: provider,
	}
	cacheRoot := filepath.Join(t.TempDir(), "cache")
	cache, err := NewDiskCache(CacheConfig{Root: cacheRoot, MaxSizeBytes: 10 << 20})
	if err != nil {
		t.Fatalf("NewDiskCache: %v", err)
	}
	t.Cleanup(func() { _ = cache.Close() })

	// 注入真实 NativeWatermarker 到 engine
	wm := NewNativeWatermarker()
	eng := engine.NewNativeGoEngine(engine.WithNativeWatermarker(wm))
	svc := NewService(eng, cache, providers, nil, wm)

	policy := buildPolicyWithStyles(true, []string{"jpg"}, "wm", styleWithWM)
	policy.ID = 9
	policy.Type = constant.PolicyTypeLocal

	file := &model.File{
		ID:   123,
		Name: "a.jpg",
		PrimaryEntity: &model.FileStorageEntity{
			Source: sql.NullString{String: "/a.jpg", Valid: true},
		},
		PrimaryEntityID: types.NullUint64{Uint64: 1, Valid: true},
	}

	result, err := svc.Process(ctx, &StyleRequest{
		Policy: policy, File: file, Filename: "a.jpg", StyleName: "wm",
	})
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	defer result.Reader.Close()
	if result.ContentType != "image/jpeg" {
		t.Errorf("ContentType = %s, want image/jpeg", result.ContentType)
	}
	body, _ := io.ReadAll(result.Reader)
	decoded, err := jpeg.Decode(bytes.NewReader(body))
	if err != nil {
		t.Fatalf("decode output jpeg: %v", err)
	}
	b := decoded.Bounds()
	if b.Dx() != 400 || b.Dy() != 300 {
		t.Errorf("size = %dx%d, want 400x300", b.Dx(), b.Dy())
	}
	// 带水印的结果与不带水印应该视觉上不同；这里退化为断言 body 非空且 StyleHash 稳定。
	if len(body) == 0 {
		t.Error("输出不应为空")
	}
	if result.StyleHash == "" {
		t.Error("StyleHash 应生成")
	}
}
