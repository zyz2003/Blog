/*
 * @Description: Phase 4 Task 4.1 新增的 ListAllStats / Preview / WarmCache 测试
 * @Author: 安知鱼
 */
package image_style

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"image/jpeg"
	"io"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/anzhiyu-c/anheyu-app/internal/infra/storage"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/types"
	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/image_style/engine"
)

// ------------ fakePolicyRepo 仅实现 FindByID；其余方法返回 nil/空。 ------------

type fakePolicyRepo struct {
	repository.StoragePolicyRepository // embed 以满足剩余接口
	byID                               map[uint]*model.StoragePolicy
	findCount                          int64
}

func (r *fakePolicyRepo) FindByID(ctx context.Context, id uint) (*model.StoragePolicy, error) {
	atomic.AddInt64(&r.findCount, 1)
	if p, ok := r.byID[id]; ok {
		return p, nil
	}
	return nil, errors.New("policy not found")
}

// ------------ fakeWarmLister 可控返回 ------------

type fakeWarmLister struct {
	files   []*model.File
	listErr error
	calls   int64
}

func (l *fakeWarmLister) ListFilesByPolicy(ctx context.Context, policyID uint) ([]*model.File, error) {
	atomic.AddInt64(&l.calls, 1)
	if l.listErr != nil {
		return nil, l.listErr
	}
	return l.files, nil
}

// ---------- 测试 ----------

func TestService_ListAllStats_ReturnsPerPolicyGroups(t *testing.T) {
	ctx := context.Background()

	provider := &fakeProvider{data: makeJPEG(t, 400, 400)}
	providers := map[constant.StoragePolicyType]storage.IStorageProvider{
		constant.PolicyTypeLocal: provider,
	}
	cache, err := NewDiskCache(CacheConfig{Root: filepath.Join(t.TempDir(), "c"), MaxSizeBytes: 10 << 20})
	if err != nil {
		t.Fatalf("NewDiskCache: %v", err)
	}
	t.Cleanup(func() { _ = cache.Close() })
	svc := NewService(engine.NewNativeGoEngine(), cache, providers, nil, nil)

	// 手工 Put 两个策略的缓存条目以避免依赖 Process
	_, _ = cache.Put(ctx, 1, 10, "h1", "image/jpeg", "jpg", []byte("aaaaa"))
	_, _ = cache.Put(ctx, 2, 20, "h2", "image/jpeg", "jpg", []byte("bbbb"))
	_, _ = cache.Put(ctx, 2, 21, "h3", "image/jpeg", "jpg", []byte("cccccc"))

	got, err := svc.ListAllStats(ctx)
	if err != nil {
		t.Fatalf("ListAllStats: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("期望 2 个策略分组，实际 %d: %+v", len(got), got)
	}
	if got[0].PolicyID != 1 || got[0].Count != 1 {
		t.Errorf("策略 1 分组不符：%+v", got[0])
	}
	if got[1].PolicyID != 2 || got[1].Count != 2 || got[1].TotalSize != 10 {
		t.Errorf("策略 2 分组不符：%+v", got[1])
	}
}

func TestService_Preview_ReturnsProcessedBytes(t *testing.T) {
	ctx := context.Background()
	svc := NewService(engine.NewNativeGoEngine(), &noopCache{}, nil, nil, nil)

	src := makeJPEG(t, 800, 600)
	style := model.ImageStyleConfig{
		Name:       "preview",
		Format:     "jpg",
		Quality:    70,
		AutoRotate: true,
		Resize:     model.ImageResizeConfig{Mode: "cover", Width: 200, Height: 150},
	}
	res, err := svc.Preview(ctx, style, src)
	if err != nil {
		t.Fatalf("Preview: %v", err)
	}
	if res.ContentType != "image/jpeg" {
		t.Errorf("ContentType = %s, want image/jpeg", res.ContentType)
	}
	decoded, err := jpeg.Decode(bytes.NewReader(res.Data))
	if err != nil {
		t.Fatalf("decode preview: %v", err)
	}
	b := decoded.Bounds()
	if b.Dx() != 200 || b.Dy() != 150 {
		t.Errorf("预览输出尺寸期望 200x150，实际 %dx%d", b.Dx(), b.Dy())
	}
}

func TestService_Preview_EmptySource_Fails(t *testing.T) {
	svc := NewService(engine.NewNativeGoEngine(), &noopCache{}, nil, nil, nil)
	_, err := svc.Preview(context.Background(), model.ImageStyleConfig{
		Name: "p", Format: "jpg", Quality: 80, Resize: model.ImageResizeConfig{Mode: "cover", Width: 1, Height: 1},
	}, nil)
	if !errors.Is(err, ErrStyleProcessFailed) {
		t.Errorf("空输入应返回 ErrStyleProcessFailed，实际 %v", err)
	}
}

func TestService_WarmCache_WithoutLister_ReturnsErrWarmNotAvailable(t *testing.T) {
	ctx := context.Background()
	svc := NewService(engine.NewNativeGoEngine(), &noopCache{}, nil, nil, nil)
	_, _, err := svc.WarmCache(ctx, 1, "thumbnail")
	if !errors.Is(err, ErrWarmNotAvailable) {
		t.Errorf("未注入 lister 时应返回 ErrWarmNotAvailable，实际 %v", err)
	}
}

func TestService_WarmCache_EndToEnd_PopulatesCache(t *testing.T) {
	ctx := context.Background()

	// 用真实 DiskCache 观察预热后条目数
	cacheRoot := filepath.Join(t.TempDir(), "wc")
	cache, err := NewDiskCache(CacheConfig{Root: cacheRoot, MaxSizeBytes: 10 << 20})
	if err != nil {
		t.Fatalf("cache: %v", err)
	}
	t.Cleanup(func() { _ = cache.Close() })

	src := makeJPEG(t, 400, 300)
	provider := &fakeProvider{data: src}
	providers := map[constant.StoragePolicyType]storage.IStorageProvider{
		constant.PolicyTypeLocal: provider,
	}

	policy := buildPolicyWithStyles(true, []string{"jpg"}, "thumbnail", sampleThumbnail())
	policy.ID = 5
	policy.Type = constant.PolicyTypeLocal

	repo := &fakePolicyRepo{byID: map[uint]*model.StoragePolicy{5: policy}}
	lister := &fakeWarmLister{
		files: []*model.File{
			{
				ID: 100, Name: "a.jpg",
				PrimaryEntity:   &model.FileStorageEntity{Source: sql.NullString{String: "/a.jpg", Valid: true}},
				PrimaryEntityID: types.NullUint64{Uint64: 1, Valid: true},
			},
			{
				ID: 101, Name: "b.jpg",
				PrimaryEntity:   &model.FileStorageEntity{Source: sql.NullString{String: "/b.jpg", Valid: true}},
				PrimaryEntityID: types.NullUint64{Uint64: 2, Valid: true},
			},
			{
				// 扩展名不匹配，应被过滤
				ID: 102, Name: "c.webp",
				PrimaryEntity:   &model.FileStorageEntity{Source: sql.NullString{String: "/c.webp", Valid: true}},
				PrimaryEntityID: types.NullUint64{Uint64: 3, Valid: true},
			},
		},
	}

	svc := NewService(engine.NewNativeGoEngine(), cache, providers, repo, nil, WithWarmFileLister(lister))

	taskID, started, err := svc.WarmCache(ctx, 5, "thumbnail")
	if err != nil {
		t.Fatalf("WarmCache: %v", err)
	}
	if !started {
		t.Fatalf("首次预热应 started=true")
	}
	if taskID == "" {
		t.Fatalf("taskID 不应为空")
	}

	// 轮询直到完成或超时
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		p, err := svc.GetWarmProgress(taskID)
		if err != nil {
			t.Fatalf("GetWarmProgress: %v", err)
		}
		if p.Status == "done" {
			if p.Total != 2 {
				t.Errorf("Total 期望 2（jpg 过滤），实际 %d", p.Total)
			}
			if p.Processed != 2 || p.Failed != 0 {
				t.Errorf("进度不符：processed=%d failed=%d", p.Processed, p.Failed)
			}
			// 缓存应有 2 条
			stats, _ := cache.Stats(ctx, 5)
			if stats.Count != 2 {
				t.Errorf("预热后缓存条目数期望 2，实际 %d", stats.Count)
			}
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("预热任务未在 5s 内完成")
}

func TestService_WarmCache_DedupsConcurrentStarts(t *testing.T) {
	ctx := context.Background()
	cache, _ := NewDiskCache(CacheConfig{Root: filepath.Join(t.TempDir(), "d"), MaxSizeBytes: 10 << 20})
	t.Cleanup(func() { _ = cache.Close() })

	policy := buildPolicyWithStyles(true, []string{"jpg"}, "thumbnail", sampleThumbnail())
	policy.ID = 9
	policy.Type = constant.PolicyTypeLocal
	repo := &fakePolicyRepo{byID: map[uint]*model.StoragePolicy{9: policy}}
	// 返回非常多文件以拉长任务时长，确保并发注册期间任务仍在 running
	files := make([]*model.File, 200)
	for i := 0; i < 200; i++ {
		files[i] = &model.File{
			ID: uint(1000 + i), Name: "x.jpg",
			PrimaryEntity:   &model.FileStorageEntity{Source: sql.NullString{String: "/x.jpg", Valid: true}},
			PrimaryEntityID: types.NullUint64{Uint64: uint64(i + 1), Valid: true},
		}
	}
	lister := &fakeWarmLister{files: files}
	provider := &fakeProvider{data: makeJPEG(t, 400, 300)}
	providers := map[constant.StoragePolicyType]storage.IStorageProvider{
		constant.PolicyTypeLocal: provider,
	}

	svc := NewService(engine.NewNativeGoEngine(), cache, providers, repo, nil, WithWarmFileLister(lister))

	var firstID string
	var startedCount int64
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			id, started, err := svc.WarmCache(ctx, 9, "thumbnail")
			if err != nil {
				t.Errorf("并发 WarmCache: %v", err)
				return
			}
			if started {
				atomic.AddInt64(&startedCount, 1)
				firstID = id
			}
		}()
	}
	wg.Wait()

	if atomic.LoadInt64(&startedCount) != 1 {
		t.Errorf("并发启动仅应一次 started=true，实际 %d", startedCount)
	}
	_ = firstID
}

func TestService_WarmCache_UnknownStyle_ReturnsErrStyleNotFound(t *testing.T) {
	ctx := context.Background()
	policy := buildPolicyWithStyles(true, []string{"jpg"}, "thumbnail", sampleThumbnail())
	policy.ID = 11
	policy.Type = constant.PolicyTypeLocal
	repo := &fakePolicyRepo{byID: map[uint]*model.StoragePolicy{11: policy}}
	lister := &fakeWarmLister{}

	svc := NewService(engine.NewNativeGoEngine(), &noopCache{}, nil, repo, nil, WithWarmFileLister(lister))

	_, _, err := svc.WarmCache(ctx, 11, "unknown_style")
	if !errors.Is(err, ErrStyleNotFound) {
		t.Errorf("未知样式应返回 ErrStyleNotFound，实际 %v", err)
	}
}

func TestService_GetWarmProgress_UnknownTask_ReturnsNotFound(t *testing.T) {
	svc := NewService(engine.NewNativeGoEngine(), &noopCache{}, nil, nil, nil)
	_, err := svc.GetWarmProgress("nothing")
	if !errors.Is(err, ErrWarmTaskNotFound) {
		t.Errorf("期望 ErrWarmTaskNotFound，实际 %v", err)
	}
}

// ---------- 辅助：noopCache 实现 Cache，所有操作即时失败/空；仅用于不需要缓存的测试 ----------

type noopCache struct{}

func (noopCache) Get(ctx context.Context, _, _ uint, _ string) (*CacheEntry, io.ReadCloser, error) {
	return nil, nil, ErrCacheMiss
}
func (noopCache) Put(ctx context.Context, _, _ uint, _, _, _ string, _ []byte) (*CacheEntry, error) {
	return nil, nil
}
func (noopCache) Purge(ctx context.Context, _ PurgeOpts) (int, error) {
	return 0, nil
}
func (noopCache) Stats(ctx context.Context, policyID uint) (CacheStats, error) {
	return CacheStats{PolicyID: policyID}, nil
}
func (noopCache) ListAllStats(ctx context.Context) ([]CacheStats, error) {
	return []CacheStats{}, nil
}
func (noopCache) Close() error { return nil }
