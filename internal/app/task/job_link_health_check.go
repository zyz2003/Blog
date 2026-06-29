package task

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

// LinkHealthCheckJob 定义友链健康检查任务。
type LinkHealthCheckJob struct {
	linkRepo repository.LinkRepository
	logger   *slog.Logger
}

// NewLinkHealthCheckJob 创建一个新的友链健康检查任务。
func NewLinkHealthCheckJob(linkRepo repository.LinkRepository, logger *slog.Logger) *LinkHealthCheckJob {
	return &LinkHealthCheckJob{
		linkRepo: linkRepo,
		logger:   logger,
	}
}

// Run 执行友链健康检查任务。
func (j *LinkHealthCheckJob) Run() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	j.logger.Info("Starting link health check job...")

	// 1. 获取所有已审核通过的友链
	approvedLinks, err := j.linkRepo.GetAllApprovedLinks(ctx)
	if err != nil {
		j.logger.Error("Failed to get approved links", slog.Any("error", err))
		return
	}

	// 2. 获取所有失联的友链（用于检查是否恢复）
	invalidLinks, err := j.linkRepo.GetAllInvalidLinks(ctx)
	if err != nil {
		j.logger.Error("Failed to get invalid links", slog.Any("error", err))
		return
	}

	totalChecked := len(approvedLinks) + len(invalidLinks)
	if totalChecked == 0 {
		j.logger.Info("No links to check")
		return
	}

	// 3. 创建 HTTP 客户端，设置超时时间
	client := &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return fmt.Errorf("重定向次数过多")
			}
			return nil
		},
	}

	// 4. 使用 WaitGroup 和互斥锁来并发检查友链
	var wg sync.WaitGroup
	var mu sync.Mutex
	toInvalidIDs := make([]int, 0)  // 需要标记为失联的友链ID
	toApprovedIDs := make([]int, 0) // 需要恢复的友链ID
	healthyCount := 0
	unhealthyCount := 0
	recoveredCount := 0
	failedCount := 0

	// 创建一个带缓冲的通道来限制并发数
	semaphore := make(chan struct{}, 10) // 最多同时检查 10 个友链

	// 5. 检查已审核通过的友链，将失联的标记为 INVALID
	for _, link := range approvedLinks {
		wg.Add(1)
		go func(linkID int, linkURL string) {
			defer wg.Done()
			semaphore <- struct{}{}        // 获取信号量
			defer func() { <-semaphore }() // 释放信号量

			isHealthy := checkLinkHealth(client, linkURL)
			mu.Lock()
			if isHealthy {
				healthyCount++
			} else {
				unhealthyCount++
				toInvalidIDs = append(toInvalidIDs, linkID)
			}
			mu.Unlock()
		}(link.ID, link.URL)
	}

	// 6. 检查失联的友链，将恢复的标记为 APPROVED
	for _, link := range invalidLinks {
		wg.Add(1)
		go func(linkID int, linkURL string) {
			defer wg.Done()
			semaphore <- struct{}{}        // 获取信号量
			defer func() { <-semaphore }() // 释放信号量

			isHealthy := checkLinkHealth(client, linkURL)
			mu.Lock()
			if isHealthy {
				recoveredCount++
				toApprovedIDs = append(toApprovedIDs, linkID)
			} else {
				failedCount++
			}
			mu.Unlock()
		}(link.ID, link.URL)
	}

	wg.Wait()

	// 7. 批量更新失联友链的状态为 INVALID
	if len(toInvalidIDs) > 0 {
		if err := j.linkRepo.BatchUpdateStatus(ctx, toInvalidIDs, "INVALID"); err != nil {
			j.logger.Error("Failed to update unhealthy links status", slog.Any("error", err))
		} else {
			j.logger.Info("Marked links as INVALID", slog.Any("link_ids", toInvalidIDs))
		}
	}

	// 8. 批量恢复健康友链的状态为 APPROVED
	if len(toApprovedIDs) > 0 {
		if err := j.linkRepo.BatchUpdateStatus(ctx, toApprovedIDs, "APPROVED"); err != nil {
			j.logger.Error("Failed to restore healthy links status", slog.Any("error", err))
		} else {
			j.logger.Info("Restored links to APPROVED", slog.Any("link_ids", toApprovedIDs))
		}
	}

	j.logger.Info("Link health check job completed",
		slog.Int("total_checked", totalChecked),
		slog.Int("approved_links_checked", len(approvedLinks)),
		slog.Int("invalid_links_checked", len(invalidLinks)),
		slog.Int("still_healthy", healthyCount),
		slog.Int("newly_failed", unhealthyCount),
		slog.Int("recovered", recoveredCount),
		slog.Int("still_failed", failedCount),
	)
}

// checkLinkHealth 检查单个友链的健康状态。
func checkLinkHealth(client *http.Client, url string) bool {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false
	}

	// 设置 User-Agent 避免被网站屏蔽
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; LinkHealthChecker/1.0)")

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	// 认为 2xx 和 3xx 状态码为健康
	return resp.StatusCode >= 200 && resp.StatusCode < 400
}

// Name 返回任务名称。
func (j *LinkHealthCheckJob) Name() string {
	return "LinkHealthCheckJob"
}
