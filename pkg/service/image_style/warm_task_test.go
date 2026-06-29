/*
 * @Description: warmTaskManager 行为测试
 * @Author: 安知鱼
 */
package image_style

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestWarmTaskManager_Register_CreatesPendingTask(t *testing.T) {
	m := newWarmTaskManager(nil)
	taskID, ctx, ok := m.register(1, "thumbnail")
	if !ok {
		t.Fatalf("首次注册应 ok=true")
	}
	if taskID == "" {
		t.Fatalf("taskID 不应为空")
	}
	if ctx == nil {
		t.Fatalf("register 应返回非 nil ctx")
	}
	select {
	case <-ctx.Done():
		t.Fatalf("新建任务的 ctx 不应已经 Done")
	default:
	}
	p, err := m.get(taskID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if p.Status != "pending" {
		t.Errorf("初始状态应为 pending，实际 %s", p.Status)
	}
	if p.PolicyID != 1 || p.StyleName != "thumbnail" {
		t.Errorf("策略/样式未正确记录：%+v", p)
	}
}

func TestWarmTaskManager_Register_DuplicateReturnsExisting(t *testing.T) {
	m := newWarmTaskManager(nil)
	first, _, ok1 := m.register(1, "thumbnail")
	if !ok1 {
		t.Fatal("首次注册应成功")
	}
	second, ctx2, ok2 := m.register(1, "thumbnail")
	if ok2 {
		t.Errorf("相同 (policy, style) 的重复注册不应成功")
	}
	if second != first {
		t.Errorf("重复注册应返回已有 taskID %s，实际 %s", first, second)
	}
	if ctx2 != nil {
		t.Errorf("重复注册不应返回新的 ctx")
	}
}

func TestWarmTaskManager_FinishReleasesLockForSameKey(t *testing.T) {
	m := newWarmTaskManager(nil)
	first, _, _ := m.register(1, "thumbnail")
	m.setTotal(first, 3)
	m.inc(first, "processed", "")
	m.inc(first, "processed", "")
	m.inc(first, "processed", "")
	m.finish(first, "done", "")

	second, _, ok := m.register(1, "thumbnail")
	if !ok {
		t.Errorf("任务完成后同策略+样式应可再次注册")
	}
	if second == first {
		t.Errorf("第二次任务应获得新 taskID")
	}
}

func TestWarmTaskManager_Cancel_SignalsContextAndMarksCancelled(t *testing.T) {
	m := newWarmTaskManager(nil)
	id, ctx, ok := m.register(1, "thumbnail")
	if !ok {
		t.Fatalf("首次注册应成功")
	}
	m.setTotal(id, 100)

	if cancelled := m.cancel(id); !cancelled {
		t.Fatalf("cancel 应返回 true")
	}
	select {
	case <-ctx.Done():
		// expected
	case <-time.After(100 * time.Millisecond):
		t.Fatalf("cancel 后 ctx 应在短时间内 Done")
	}
	// 模拟 goroutine 接收 ctx.Done 后把状态置为 cancelled
	m.finish(id, "cancelled", "外部请求取消")
	p, err := m.get(id)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if p.Status != "cancelled" {
		t.Errorf("期望状态 cancelled，实际 %s", p.Status)
	}
}

func TestWarmTaskManager_Cancel_UnknownTaskReturnsFalse(t *testing.T) {
	m := newWarmTaskManager(nil)
	if m.cancel("nope") {
		t.Errorf("cancel 未知任务应返回 false")
	}
}

func TestWarmTaskManager_GetMissingReturnsError(t *testing.T) {
	m := newWarmTaskManager(nil)
	_, err := m.get("does-not-exist")
	if !errors.Is(err, ErrWarmTaskNotFound) {
		t.Errorf("期望 ErrWarmTaskNotFound，实际 %v", err)
	}
}

// TestWarmTaskManager_ConcurrentRegister_OnlyOneTaskCreated
// 50 个 goroutine 并发注册同策略+样式；仅 1 个 register 应获 ok=true。
func TestWarmTaskManager_ConcurrentRegister_OnlyOneTaskCreated(t *testing.T) {
	m := newWarmTaskManager(nil)
	const concurrency = 50
	var wg sync.WaitGroup
	var okCount int64
	taskIDs := make([]string, concurrency)

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			id, _, ok := m.register(7, "banner")
			if ok {
				atomic.AddInt64(&okCount, 1)
			}
			taskIDs[idx] = id
		}(i)
	}
	wg.Wait()

	if got := atomic.LoadInt64(&okCount); got != 1 {
		t.Errorf("期望仅 1 个 goroutine 成功注册新任务，实际 %d", got)
	}
	// 所有 goroutine 拿到的 taskID 应一致
	first := taskIDs[0]
	for i, id := range taskIDs {
		if id != first {
			t.Fatalf("taskID 不一致：idx=%d 得到 %s 与 %s", i, id, first)
		}
	}
}

func TestWarmTaskManager_GetReturnsCopy(t *testing.T) {
	m := newWarmTaskManager(nil)
	taskID, _, _ := m.register(1, "a")
	p, err := m.get(taskID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	p.Processed = 9999 // 修改拷贝
	p2, _ := m.get(taskID)
	if p2.Processed != 0 {
		t.Errorf("get 返回应为拷贝，外部修改不应回写。实际 Processed=%d", p2.Processed)
	}
}

func TestWarmTaskManager_Reap_RemovesOldFinishedTasks(t *testing.T) {
	fakeNow := time.Now()
	m := newWarmTaskManager(func() time.Time { return fakeNow })

	idOld, _, _ := m.register(1, "old")
	m.finish(idOld, "done", "")

	// 时间前进 2 小时
	fakeNow = fakeNow.Add(2 * time.Hour)
	idRecent, _, _ := m.register(2, "recent")
	m.finish(idRecent, "done", "")

	// reap 1 小时前 cutoff，应只清理 idOld
	removed := m.reap(fakeNow.Add(-1 * time.Hour))
	if removed != 1 {
		t.Errorf("期望回收 1 个旧任务，实际 %d", removed)
	}
	if _, err := m.get(idOld); !errors.Is(err, ErrWarmTaskNotFound) {
		t.Errorf("idOld 应已被回收")
	}
	if _, err := m.get(idRecent); err != nil {
		t.Errorf("idRecent 不应被回收，但 get 返回 %v", err)
	}
}

func TestWarmTaskManager_IncFailed_CapturesLastError(t *testing.T) {
	m := newWarmTaskManager(nil)
	id, _, _ := m.register(3, "x")
	m.setTotal(id, 5)
	m.inc(id, "failed", "io read error")
	m.inc(id, "processed", "")
	p, _ := m.get(id)
	if p.Failed != 1 || p.Processed != 1 {
		t.Errorf("计数错误：%+v", p)
	}
	if p.LastError != "io read error" {
		t.Errorf("LastError 未正确写入：%+v", p)
	}
	if p.Status != "running" {
		t.Errorf("setTotal 后应切到 running，实际 %s", p.Status)
	}
}
