/*
 * @Description: 访问统计服务
 * @Author: 安知鱼
 * @Date: 2025-01-20 15:30:00
 * @LastEditTime: 2025-10-26 21:22:33
 * @LastEditors: 安知鱼
 */
package statistics

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/utils"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/utility"

	"github.com/gin-gonic/gin"
)

// 性能日志开关（生产环境建议设置为false）
const enablePerfLog = true // 设置为 false 可关闭性能日志，提升约0.01-0.02ms

// visitTask 访问任务结构
type visitTask struct {
	ctx       context.Context
	clientIP  string
	userAgent string
	visitorID string
	req       *model.VisitorLogRequest
	timestamp time.Time
}

// userAgentCache UA解析缓存项
type userAgentCache struct {
	browser   string
	os        string
	device    string
	timestamp time.Time
}

// VisitorStatService 访问统计服务接口
type VisitorStatService interface {
	// 记录访问日志
	RecordVisit(ctx context.Context, c *gin.Context, req *model.VisitorLogRequest) error

	// 获取基础统计数据
	GetBasicStatistics(ctx context.Context) (*model.VisitorStatistics, error)

	// 获取访客分析数据
	GetVisitorAnalytics(ctx context.Context, startDate, endDate time.Time) (*model.VisitorAnalytics, error)

	// 获取热门页面
	GetTopPages(ctx context.Context, limit int) ([]*model.URLStatistics, error)

	// 获取访客趋势数据
	GetVisitorTrend(ctx context.Context, period string, days int) (*model.VisitorTrendData, error)

	// 聚合日统计数据
	AggregateDaily(ctx context.Context, date time.Time) error

	// 获取实时统计数据
	GetRealTimeStats(ctx context.Context) (*model.VisitorStatistics, error)

	// 获取最后一次成功聚合的日期
	GetLastAggregatedDate(ctx context.Context) (*time.Time, error)

	// 获取第一条访问日志的日期
	GetFirstLogDate(ctx context.Context) (*time.Time, error)

	// 获取访客访问日志（时间范围）
	GetVisitorLogs(ctx context.Context, startDate, endDate time.Time) ([]*ent.VisitorLog, error)
}

type visitorStatService struct {
	visitorStatRepo repository.VisitorStatRepository
	visitorLogRepo  repository.VisitorLogRepository
	urlStatRepo     repository.URLStatRepository
	geoipService    utility.GeoIPService
	cacheService    utility.CacheService

	// 性能优化相关
	workerPool     chan struct{}   // Worker 池，控制并发数
	visitQueue     chan *visitTask // 访问任务队列
	userAgentCache *sync.Map       // User-Agent解析缓存
	requestDedup   *sync.Map       // 请求去重Map
}

// 性能优化配置常量
const (
	// Worker池配置
	MaxWorkers     = 50   // 最大并发worker数量
	VisitQueueSize = 1000 // 访问任务队列大小

	// 缓存配置
	UACacheExpire = 12 * time.Hour  // User-Agent缓存过期时间
	DedupExpire   = 3 * time.Second // 请求去重过期时间
)

// NewVisitorStatService 创建访问统计服务实例
func NewVisitorStatService(
	visitorStatRepo repository.VisitorStatRepository,
	visitorLogRepo repository.VisitorLogRepository,
	urlStatRepo repository.URLStatRepository,
	cacheService utility.CacheService,
	geoipService utility.GeoIPService,
) (VisitorStatService, error) {
	svc := &visitorStatService{
		visitorStatRepo: visitorStatRepo,
		visitorLogRepo:  visitorLogRepo,
		urlStatRepo:     urlStatRepo,
		cacheService:    cacheService,
		geoipService:    geoipService,

		// 初始化性能优化组件
		workerPool:     make(chan struct{}, MaxWorkers),
		visitQueue:     make(chan *visitTask, VisitQueueSize),
		userAgentCache: &sync.Map{},
		requestDedup:   &sync.Map{},
	}

	// 启动worker池处理访问任务
	go svc.startWorkerPool()

	// 启动定期清理缓存的任务
	go svc.cleanupCaches()

	return svc, nil
}

// 获取最后一次成功聚合的日期
func (s *visitorStatService) GetLastAggregatedDate(ctx context.Context) (*time.Time, error) {
	return s.visitorStatRepo.GetLatestDate(ctx)
}

// 获取第一条访问日志的日期
func (s *visitorStatService) GetFirstLogDate(ctx context.Context) (*time.Time, error) {
	return s.visitorLogRepo.GetFirstDate(ctx)
}

// 获取访客访问日志（时间范围）
func (s *visitorStatService) GetVisitorLogs(ctx context.Context, startDate, endDate time.Time) ([]*ent.VisitorLog, error) {
	return s.visitorLogRepo.GetByTimeRange(ctx, startDate, endDate)
}

// startWorkerPool 启动worker池处理访问任务
func (s *visitorStatService) startWorkerPool() {
	for task := range s.visitQueue {
		// 获取worker许可（限制并发数）
		s.workerPool <- struct{}{}

		go func(t *visitTask) {
			defer func() {
				<-s.workerPool // 释放worker许可
				if r := recover(); r != nil {
					fmt.Printf("[统计] Worker panic: %v\n", r)
				}
			}()

			s.processVisitTask(t)
		}(task)
	}
}

// processVisitTask 处理单个访问任务（异步处理所有统计）
func (s *visitorStatService) processVisitTask(task *visitTask) {
	var taskStartTime, redisStart, t1, t2, t3, t4, t5, t6 time.Time
	var uaStart, logCreateStart, dbStart, urlStatStart time.Time

	if enablePerfLog {
		taskStartTime = time.Now()
		redisStart = time.Now()
	}

	ctx := task.ctx
	now := utils.ToChina(task.timestamp)
	today := now.Format("2006-01-02")

	// 1. Redis批量操作（判断新访客 + 更新计数）
	isUnique := false
	if s.cacheService != nil {
		if enablePerfLog {
			t1 = time.Now()
		}

		visitorSetKey := CacheKeyVisitorsSet + today
		isNew, err := s.cacheService.SAdd(ctx, visitorSetKey, task.visitorID)

		if enablePerfLog {
			fmt.Printf("[性能-异步] Redis.SAdd耗时: %v\n", time.Since(t1))
		}

		if err == nil {
			if isNew > 0 {
				isUnique = true

				if enablePerfLog {
					t2 = time.Now()
				}
				s.cacheService.Expire(ctx, visitorSetKey, 48*time.Hour)
				if enablePerfLog {
					fmt.Printf("[性能-异步] Redis.Expire(visitor)耗时: %v\n", time.Since(t2))
					t3 = time.Now()
				}

				todayVisitorsKey := CacheKeyTodayVisitors + today
				s.cacheService.Increment(ctx, todayVisitorsKey)

				if enablePerfLog {
					fmt.Printf("[性能-异步] Redis.Increment(visitors)耗时: %v\n", time.Since(t3))
					t4 = time.Now()
				}

				s.cacheService.Expire(ctx, todayVisitorsKey, CacheExpireToday)

				if enablePerfLog {
					fmt.Printf("[性能-异步] Redis.Expire(visitors)耗时: %v\n", time.Since(t4))
				}
			}

			if enablePerfLog {
				t5 = time.Now()
			}
			todayViewsKey := CacheKeyTodayViews + today
			s.cacheService.Increment(ctx, todayViewsKey)

			if enablePerfLog {
				fmt.Printf("[性能-异步] Redis.Increment(views)耗时: %v\n", time.Since(t5))
				t6 = time.Now()
			}

			s.cacheService.Expire(ctx, todayViewsKey, CacheExpireToday)

			if enablePerfLog {
				fmt.Printf("[性能-异步] Redis.Expire(views)耗时: %v\n", time.Since(t6))
			}

			// 异步删除缓存，避免阻塞主流程（这是优化项，Delete操作较慢）
			go func() {
				t7 := time.Now()
				s.cacheService.Delete(context.Background(), CacheKeyBasicStats)
				if enablePerfLog {
					fmt.Printf("[性能-异步] Redis.Delete(cache)耗时: %v\n", time.Since(t7))
				}
			}()
		} else if enablePerfLog {
			fmt.Printf("[性能-异步] Redis操作失败: %v\n", err)
		}
	}

	if enablePerfLog {
		fmt.Printf("[性能-异步] Redis操作总耗时: %v\n", time.Since(redisStart))
		uaStart = time.Now()
	}

	// 2. 解析User-Agent（带缓存）
	browser, os, device := s.parseUserAgentCached(task.userAgent)

	if enablePerfLog {
		fmt.Printf("[性能-异步] UA解析耗时: %v\n", time.Since(uaStart))
		logCreateStart = time.Now()
	}

	// 3. 创建访问日志
	log := &ent.VisitorLog{
		VisitorID: task.visitorID,
		IPAddress: task.clientIP,
		UserAgent: &task.userAgent,
		Referer:   &task.req.Referer,
		URLPath:   task.req.URLPath,
		Country:   nil,
		Region:    nil,
		City:      nil,
		Browser:   &browser,
		Os:        &os,
		Device:    &device,
		Duration:  task.req.Duration,
		IsBounce:  task.req.Duration < 10,
		CreatedAt: now,
	}

	if enablePerfLog {
		fmt.Printf("[性能-异步] 创建日志对象耗时: %v\n", time.Since(logCreateStart))
		dbStart = time.Now()
	}

	// 4. 保存访问日志（不重试）
	if err := s.visitorLogRepo.Create(ctx, log); err != nil {
		if !strings.Contains(err.Error(), "duplicate key") {
			fmt.Printf("[统计] 保存访问日志失败: %v\n", err)
		}
		if enablePerfLog {
			fmt.Printf("[性能-异步] 数据库写入耗时(失败): %v\n", time.Since(dbStart))
		}
		return
	}

	if enablePerfLog {
		fmt.Printf("[性能-异步] 数据库写入耗时: %v\n", time.Since(dbStart))
		urlStatStart = time.Now()
	}

	// 5. 更新URL统计（传入跳出标记）
	isBounce := task.req.Duration < 10 // 停留时间小于10秒视为跳出
	if err := s.urlStatRepo.IncrementViews(ctx, task.req.URLPath, isUnique, task.req.Duration, isBounce); err != nil {
		fmt.Printf("[统计] 更新URL统计失败: %v\n", err)
	}

	if enablePerfLog {
		fmt.Printf("[性能-异步] URL统计更新耗时: %v\n", time.Since(urlStatStart))

		totalTaskTime := time.Since(taskStartTime)
		fmt.Printf("[性能-异步]Worker任务总耗时: %v\n", totalTaskTime)

		if totalTaskTime > 100*time.Millisecond {
			fmt.Printf("[性能警告-异步] Worker任务耗时超过100ms: %v\n", totalTaskTime)
		}
	}
}

// cleanupCaches 定期清理过期缓存
func (s *visitorStatService) cleanupCaches() {
	ticker := time.NewTicker(30 * time.Minute) // 每30分钟清理一次
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()

		// 清理User-Agent缓存
		s.userAgentCache.Range(func(key, value interface{}) bool {
			if cache, ok := value.(*userAgentCache); ok {
				if now.Sub(cache.timestamp) > UACacheExpire {
					s.userAgentCache.Delete(key)
				}
			}
			return true
		})

		// 清理请求去重Map
		s.requestDedup.Range(func(key, value interface{}) bool {
			if timestamp, ok := value.(time.Time); ok {
				if now.Sub(timestamp) > DedupExpire {
					s.requestDedup.Delete(key)
				}
			}
			return true
		})
	}
}

// parseUserAgentCached 解析User-Agent（带缓存）
func (s *visitorStatService) parseUserAgentCached(userAgent string) (browser, os, device string) {
	// 生成缓存键（使用MD5避免过长）
	hash := md5.Sum([]byte(userAgent))
	cacheKey := fmt.Sprintf("%x", hash)

	// 从缓存获取
	if cached, ok := s.userAgentCache.Load(cacheKey); ok {
		if uaCache, ok := cached.(*userAgentCache); ok {
			// 检查是否过期
			if time.Since(uaCache.timestamp) < UACacheExpire {
				return uaCache.browser, uaCache.os, uaCache.device
			}
		}
	}

	// 缓存未命中或过期，解析User-Agent
	browser, os, device = s.parseUserAgent(userAgent)

	// 存入缓存
	s.userAgentCache.Store(cacheKey, &userAgentCache{
		browser:   browser,
		os:        os,
		device:    device,
		timestamp: time.Now(),
	})

	return browser, os, device
}

func (s *visitorStatService) RecordVisit(ctx context.Context, c *gin.Context, req *model.VisitorLogRequest) error {
	var startTime, t1, t2, t3, t4 time.Time
	if enablePerfLog {
		startTime = time.Now()
		t1 = time.Now()
	}

	// === 极致优化：完全异步处理，只做最小化验证 ===
	clientIP := s.getClientIP(c)
	userAgent := c.GetHeader("User-Agent")
	visitorID := s.generateVisitorID(clientIP, userAgent)

	if enablePerfLog {
		fmt.Printf("[性能] 获取基本信息耗时: %v\n", time.Since(t1))
		t2 = time.Now()
	}

	// 请求去重检查（内存操作，极快）
	requestKey := fmt.Sprintf("%s:%s:%d", visitorID, req.URLPath, time.Now().Unix()/int64(DedupExpire.Seconds()))
	if _, exists := s.requestDedup.LoadOrStore(requestKey, time.Now()); exists {
		if enablePerfLog {
			fmt.Printf("[性能] 去重检查(重复)耗时: %v, 总耗时: %v\n", time.Since(t2), time.Since(startTime))
		}
		return nil // 重复请求，直接返回
	}

	if enablePerfLog {
		fmt.Printf("[性能] 去重检查耗时: %v\n", time.Since(t2))
		t3 = time.Now()
	}

	// 创建访问任务
	task := &visitTask{
		ctx:       context.Background(),
		clientIP:  clientIP,
		userAgent: userAgent,
		visitorID: visitorID,
		req:       req,
		timestamp: utils.NowInChina(),
	}

	if enablePerfLog {
		fmt.Printf("[性能] 创建任务耗时: %v\n", time.Since(t3))
		t4 = time.Now()
	}

	// 非阻塞入队
	select {
	case s.visitQueue <- task:
		if enablePerfLog {
			fmt.Printf("[性能] 入队耗时: %v\n", time.Since(t4))
		}
	default:
		fmt.Printf("[统计警告] 访问任务队列已满，当前任务被丢弃\n")
	}

	if enablePerfLog {
		totalTime := time.Since(startTime)
		fmt.Printf("[性能]RecordVisit总耗时: %v\n", totalTime)

		if totalTime > 10*time.Millisecond {
			fmt.Printf("[性能警告] RecordVisit耗时超过10ms: %v\n", totalTime)
		}
	}

	return nil
}

// enrichTodayYesterdayFromVisitorLogs 用 visitor_log 按中国时区自然日统计今日、昨日。
//
// visitor_stats 依赖定时任务按日聚合；在尚未写入「今天/昨天」行时，仓储层 GetBasicStatistics 会得到 0，
// 但本月/本年仍会对表内其它日期的行求和而出现非零，造成「今日昨日为 0、月年却有数据」的错觉。
// 展示侧以原始访问日志为准，保证与真实访问一致。
func (s *visitorStatService) enrichTodayYesterdayFromVisitorLogs(ctx context.Context, stats *model.VisitorStatistics) {
	if s.visitorLogRepo == nil || stats == nil {
		return
	}
	now := utils.NowInChina()
	today := utils.StartOfDayInChina(now)
	yesterday := today.AddDate(0, 0, -1)

	if v, err := s.visitorLogRepo.CountTotalViews(ctx, today); err == nil {
		stats.TodayViews = v
	}
	if v, err := s.visitorLogRepo.CountUniqueVisitors(ctx, today); err == nil {
		stats.TodayVisitors = v
	}
	if v, err := s.visitorLogRepo.CountTotalViews(ctx, yesterday); err == nil {
		stats.YesterdayViews = v
	}
	if v, err := s.visitorLogRepo.CountUniqueVisitors(ctx, yesterday); err == nil {
		stats.YesterdayVisitors = v
	}
}

func (s *visitorStatService) GetBasicStatistics(ctx context.Context) (*model.VisitorStatistics, error) {
	// 尝试从缓存获取
	if s.cacheService != nil {
		cachedData, err := s.cacheService.Get(ctx, CacheKeyBasicStats)
		if err == nil && cachedData != "" {
			var stats model.VisitorStatistics
			if json.Unmarshal([]byte(cachedData), &stats) == nil {
				s.enrichTodayYesterdayFromVisitorLogs(ctx, &stats)
				return &stats, nil
			}
		}
	}

	// 缓存未命中，尝试从Redis实时计数获取
	if s.cacheService != nil {
		stats := &model.VisitorStatistics{}
		now := utils.NowInChina()
		today := now.Format("2006-01-02")

		// 从Redis获取今日实时数据
		if todayViews, err := s.cacheService.Get(ctx, CacheKeyTodayViews+today); err == nil && todayViews != "" {
			if views, err := strconv.ParseInt(todayViews, 10, 64); err == nil {
				stats.TodayViews = views
			}
		}

		if todayVisitors, err := s.cacheService.Get(ctx, CacheKeyTodayVisitors+today); err == nil && todayVisitors != "" {
			if visitors, err := strconv.ParseInt(todayVisitors, 10, 64); err == nil {
				stats.TodayVisitors = visitors
			}
		}

		// 如果Redis中有今日数据，从数据库获取其他数据
		if stats.TodayViews > 0 || stats.TodayVisitors > 0 {
			// 从数据库获取昨日、月、年数据
			dbStats, err := s.visitorStatRepo.GetBasicStatistics(ctx)
			if err == nil {
				stats.YesterdayVisitors = dbStats.YesterdayVisitors
				stats.YesterdayViews = dbStats.YesterdayViews
				stats.MonthViews = dbStats.MonthViews
				stats.YearViews = dbStats.YearViews
			}

			s.enrichTodayYesterdayFromVisitorLogs(ctx, stats)

			// 写入缓存
			if data, err := json.Marshal(stats); err == nil {
				s.cacheService.Set(ctx, CacheKeyBasicStats, string(data), CacheExpireBasicStats)
			}

			return stats, nil
		}
	}

	// 如果Redis中没有实时数据，从数据库获取
	stats, err := s.visitorStatRepo.GetBasicStatistics(ctx)
	if err != nil {
		return nil, err
	}

	s.enrichTodayYesterdayFromVisitorLogs(ctx, stats)

	// 写入缓存
	if s.cacheService != nil {
		if data, err := json.Marshal(stats); err == nil {
			s.cacheService.Set(ctx, CacheKeyBasicStats, string(data), CacheExpireBasicStats)
		}
	}

	return stats, nil
}

func (s *visitorStatService) GetVisitorAnalytics(ctx context.Context, startDate, endDate time.Time) (*model.VisitorAnalytics, error) {
	return s.visitorLogRepo.GetVisitorAnalytics(ctx, startDate, endDate)
}

func (s *visitorStatService) GetTopPages(ctx context.Context, limit int) ([]*model.URLStatistics, error) {
	// 尝试从缓存获取
	if s.cacheService != nil {
		cacheKey := fmt.Sprintf("%s%d", CacheKeyTopPages, limit)
		cachedData, err := s.cacheService.Get(ctx, cacheKey)
		if err == nil && cachedData != "" {
			var pages []*model.URLStatistics
			if json.Unmarshal([]byte(cachedData), &pages) == nil {
				return pages, nil
			}
		}
	}

	// 缓存未命中，从数据库获取
	pages, err := s.urlStatRepo.GetTopPages(ctx, limit)
	if err != nil {
		return nil, err
	}

	// 写入缓存
	if s.cacheService != nil {
		if data, err := json.Marshal(pages); err == nil {
			cacheKey := fmt.Sprintf("%s%d", CacheKeyTopPages, limit)
			s.cacheService.Set(ctx, cacheKey, string(data), CacheExpireTopPages)
		}
	}

	return pages, nil
}

func (s *visitorStatService) GetVisitorTrend(ctx context.Context, period string, days int) (*model.VisitorTrendData, error) {
	if days <= 0 {
		days = 30
	}
	if s.visitorLogRepo == nil {
		return nil, fmt.Errorf("visitor log repository is not configured")
	}

	// 按中国时区自然日、从 visitor_log 汇总，避免仅依赖 visitor_stats 日表（未跑定时聚合时趋势全为 0）
	now := utils.NowInChina()
	endDay := utils.StartOfDayInChina(now)
	startDay := utils.StartOfDayInChina(now.AddDate(0, 0, -days))

	trendData := &model.VisitorTrendData{
		Daily: make([]model.DateRangeStats, 0, days+1),
	}

	for d := startDay; !d.After(endDay); d = d.AddDate(0, 0, 1) {
		views, err := s.visitorLogRepo.CountTotalViews(ctx, d)
		if err != nil {
			return nil, err
		}
		visitors, err := s.visitorLogRepo.CountUniqueVisitors(ctx, d)
		if err != nil {
			return nil, err
		}
		trendData.Daily = append(trendData.Daily, model.DateRangeStats{
			Date:     d,
			Visitors: visitors,
			Views:    views,
		})
	}

	_ = period // 预留 weekly/monthly，当前与历史实现一致仅返回 daily 序列
	return trendData, nil
}

func (s *visitorStatService) AggregateDaily(ctx context.Context, date time.Time) error {
	// 统计指定日期的数据
	uniqueVisitors, err := s.visitorLogRepo.CountUniqueVisitors(ctx, date)
	if err != nil {
		return fmt.Errorf("统计独立访客失败: %w", err)
	}

	totalViews, err := s.visitorLogRepo.CountTotalViews(ctx, date)
	if err != nil {
		return fmt.Errorf("统计总访问量失败: %w", err)
	}

	// 创建或更新统计记录
	stat := &ent.VisitorStat{
		Date:           date,
		UniqueVisitors: uniqueVisitors,
		TotalViews:     totalViews,
		PageViews:      totalViews, // 简化处理，实际可能需要区分页面浏览和其他请求
		BounceCount:    0,          // 需要单独统计跳出次数
	}

	if err := s.visitorStatRepo.CreateOrUpdate(ctx, stat); err != nil {
		return err
	}

	// 聚合完成后清除统计缓存，确保下次查询获取最新数据
	if s.cacheService != nil {
		s.cacheService.Delete(ctx, CacheKeyBasicStats)
	}

	return nil
}

// GetRealTimeStats 获取实时统计数据（优先从缓存获取）
func (s *visitorStatService) GetRealTimeStats(ctx context.Context) (*model.VisitorStatistics, error) {
	// 尝试从缓存获取
	if s.cacheService != nil {
		cacheKey := CacheKeyRealTime + utils.NowInChina().Format("2006-01-02")
		cachedData, err := s.cacheService.Get(ctx, cacheKey)
		if err == nil && cachedData != "" {
			var stats model.VisitorStatistics
			if json.Unmarshal([]byte(cachedData), &stats) == nil {
				return &stats, nil
			}
		}
	}

	// 缓存未命中，从数据库获取
	return s.GetBasicStatistics(ctx)
}

// 高并发优化配置
const (
	// Redis Key 命名空间前缀
	StatsKeyNamespace = "anheyu:"

	// 缓存键常量
	CacheKeyBasicStats = StatsKeyNamespace + "stats:basic"
	CacheKeyTopPages   = StatsKeyNamespace + "stats:top_pages:"
	CacheKeyAnalytics  = StatsKeyNamespace + "stats:analytics:"
	CacheKeyTodayViews = StatsKeyNamespace + "stats:today:views:"

	// 实时计数缓存键
	CacheKeyRealTimeViews    = StatsKeyNamespace + "stats:realtime:views:"
	CacheKeyRealTimeVisitors = StatsKeyNamespace + "stats:realtime:visitors:"
	CacheKeyBatchQueue       = StatsKeyNamespace + "stats:batch:queue:"

	// 访客相关缓存键前缀
	CacheKeyVisitorsSet   = StatsKeyNamespace + "stats:visitors:set:"
	CacheKeyTodayVisitors = StatsKeyNamespace + "stats:today:visitors:"
	CacheKeyVisitor       = StatsKeyNamespace + "stats:visitor:"
	CacheKeyRealTime      = StatsKeyNamespace + "stats:realtime:"

	// 缓存过期时间
	CacheExpireBasicStats = 5 * time.Minute
	CacheExpireTopPages   = 15 * time.Minute
	CacheExpireAnalytics  = 30 * time.Minute
	CacheExpireToday      = 24 * time.Hour
	CacheExpireRealTime   = 1 * time.Hour
	CacheExpireBatchQueue = 10 * time.Minute

	// 批量处理配置
	BatchSizeThreshold = 100 // 批量写入阈值
	BatchTimeThreshold = 30  // 批量写入时间阈值(秒)
	MaxRetryAttempts   = 3   // 最大重试次数
)

// 访问记录批次结构
type VisitBatch struct {
	Visits    []*ent.VisitorLog `json:"visits"`
	Count     int               `json:"count"`
	CreatedAt time.Time         `json:"created_at"`
}

// 高并发优化的访问记录方法
func (s *visitorStatService) RecordVisitOptimized(ctx context.Context, c *gin.Context, req *model.VisitorLogRequest) error {
	// 1. 立即更新Redis实时计数（毫秒级响应）
	if err := s.updateRealTimeCounts(ctx, c, req); err != nil {
		// 实时计数失败不影响用户体验，只记录日志
		fmt.Printf("实时计数更新失败: %v\n", err)
	}

	// 2. 异步批量写入数据库（不阻塞用户请求）
	go func() {
		if err := s.batchWriteVisit(ctx, c, req); err != nil {
			fmt.Printf("批量写入访问记录失败: %v\n", err)
		}
	}()

	return nil
}

// 更新实时计数
func (s *visitorStatService) updateRealTimeCounts(ctx context.Context, c *gin.Context, req *model.VisitorLogRequest) error {
	if s.cacheService == nil {
		return nil
	}

	now := utils.NowInChina()
	today := now.Format("2006-01-02")

	// 使用Redis原子操作增加计数
	viewsKey := CacheKeyRealTimeViews + today
	visitorsKey := CacheKeyRealTimeVisitors + today

	// 增加访问量
	if _, err := s.cacheService.Increment(ctx, viewsKey); err != nil {
		return fmt.Errorf("增加访问量失败: %w", err)
	}
	s.cacheService.Expire(ctx, viewsKey, CacheExpireRealTime)

	// 检查是否为新访客（基于IP和UserAgent的简单判断）
	// 注意：这里需要从gin.Context获取IP和UserAgent，因为req中没有这些字段
	clientIP := s.getClientIP(c)
	userAgent := c.GetHeader("User-Agent")
	visitorKey := fmt.Sprintf("%s%s:%s", CacheKeyVisitor, clientIP, userAgent)
	if exists, _ := s.cacheService.Get(ctx, visitorKey); exists == "" {
		// 新访客，增加访客数
		if _, err := s.cacheService.Increment(ctx, visitorsKey); err != nil {
			return fmt.Errorf("增加访客数失败: %w", err)
		}
		s.cacheService.Expire(ctx, visitorsKey, CacheExpireRealTime)

		// 标记访客已存在（24小时过期）
		s.cacheService.Set(ctx, visitorKey, "1", 24*time.Hour)
	}

	// 清除基础统计缓存，确保数据一致性
	s.cacheService.Delete(ctx, CacheKeyBasicStats)

	return nil
}

// 批量写入访问记录
func (s *visitorStatService) batchWriteVisit(ctx context.Context, c *gin.Context, req *model.VisitorLogRequest) error {
	// 1. 将访问记录添加到批量队列
	batchKey := CacheKeyBatchQueue + utils.NowInChina().Format("2006-01-02")

	// 创建访问日志
	userAgent := c.GetHeader("User-Agent")
	clientIP := s.getClientIP(c)
	// 获取客户端 Referer，用于 NSUUU API 白名单验证
	httpReferer := c.GetHeader("Referer")
	visitorID := s.generateVisitorID(clientIP, userAgent)
	country, region, city := s.getGeoLocation(clientIP, httpReferer)
	browser, os, device := s.parseUserAgent(userAgent)

	log := &ent.VisitorLog{
		VisitorID: visitorID,
		IPAddress: clientIP,
		UserAgent: &userAgent,
		Referer:   &req.Referer,
		URLPath:   req.URLPath,
		Country:   &country,
		Region:    &region,
		City:      &city,
		Browser:   &browser,
		Os:        &os,
		Device:    &device,
		Duration:  req.Duration,
		IsBounce:  req.Duration < 10,
		CreatedAt: utils.NowInChina(),
	}

	// 2. 添加到批量队列
	if err := s.addToBatchQueue(ctx, batchKey, log); err != nil {
		return fmt.Errorf("添加到批量队列失败: %w", err)
	}

	// 3. 检查是否需要立即处理批次
	if shouldProcessBatch, err := s.shouldProcessBatch(ctx, batchKey); err == nil && shouldProcessBatch {
		return s.processBatchQueue(ctx, batchKey)
	}

	return nil
}

// 添加到批量队列
func (s *visitorStatService) addToBatchQueue(ctx context.Context, batchKey string, log *ent.VisitorLog) error {
	if s.cacheService == nil {
		return nil
	}

	// 使用Redis List结构存储批量数据
	logData, err := json.Marshal(log)
	if err != nil {
		return fmt.Errorf("序列化访问日志失败: %w", err)
	}

	// 添加到队列尾部
	if err := s.cacheService.RPush(ctx, batchKey, string(logData)); err != nil {
		return fmt.Errorf("添加到批量队列失败: %w", err)
	}

	// 设置过期时间
	s.cacheService.Expire(ctx, batchKey, CacheExpireBatchQueue)

	return nil
}

// 检查是否应该处理批次
func (s *visitorStatService) shouldProcessBatch(ctx context.Context, batchKey string) (bool, error) {
	if s.cacheService == nil {
		return false, nil
	}

	// 检查队列长度
	length, err := s.cacheService.LLen(ctx, batchKey)
	if err != nil {
		return false, err
	}

	// 如果队列长度超过阈值，立即处理
	if length >= BatchSizeThreshold {
		return true, nil
	}

	// 检查队列中最早的数据时间
	firstItem, err := s.cacheService.LIndex(ctx, batchKey, 0)
	if err != nil || firstItem == "" {
		return false, nil
	}

	// 解析时间戳
	var log ent.VisitorLog
	if err := json.Unmarshal([]byte(firstItem), &log); err != nil {
		return false, nil
	}

	// 如果最早的数据超过时间阈值，立即处理
	if time.Since(log.CreatedAt) > time.Duration(BatchTimeThreshold)*time.Second {
		return true, nil
	}

	return false, nil
}

// 处理批量队列
func (s *visitorStatService) processBatchQueue(ctx context.Context, batchKey string) error {
	if s.cacheService == nil {
		return nil
	}

	// 1. 获取批次中的所有数据
	items, err := s.cacheService.LRange(ctx, batchKey, 0, -1)
	if err != nil {
		return fmt.Errorf("获取批量数据失败: %w", err)
	}

	if len(items) == 0 {
		return nil
	}

	// 2. 批量写入数据库
	var logs []*ent.VisitorLog
	for _, item := range items {
		var log ent.VisitorLog
		if err := json.Unmarshal([]byte(item), &log); err != nil {
			continue // 跳过无效数据
		}
		logs = append(logs, &log)
	}

	// 3. 批量创建访问日志（简化版本，逐个创建）
	if err := s.batchCreateVisitorLogs(ctx, logs); err != nil {
		return fmt.Errorf("批量创建访问日志失败: %w", err)
	}

	// 4. 更新URL统计（简化版本，逐个更新）
	if err := s.batchUpdateURLStats(ctx, logs); err != nil {
		return fmt.Errorf("批量更新URL统计失败: %w", err)
	}

	// 5. 清空队列
	s.cacheService.Del(ctx, batchKey)

	return nil
}

// 批量创建访问日志
func (s *visitorStatService) batchCreateVisitorLogs(ctx context.Context, logs []*ent.VisitorLog) error {
	// 分批处理，避免单次事务过大
	batchSize := 100
	for i := 0; i < len(logs); i += batchSize {
		end := i + batchSize
		if end > len(logs) {
			end = len(logs)
		}

		batch := logs[i:end]
		// 使用现有的Create方法逐个创建
		for _, log := range batch {
			if err := s.visitorLogRepo.Create(ctx, log); err != nil {
				return fmt.Errorf("创建访问日志失败: %w", err)
			}
		}
	}

	return nil
}

// 批量更新URL统计
func (s *visitorStatService) batchUpdateURLStats(ctx context.Context, logs []*ent.VisitorLog) error {
	// 统计每个URL的访问量和访客数
	urlStats := make(map[string]*struct {
		Views    int64
		Visitors map[string]bool
		Duration int64
		Count    int
	})

	for _, log := range logs {
		if urlStats[log.URLPath] == nil {
			urlStats[log.URLPath] = &struct {
				Views    int64
				Visitors map[string]bool
				Duration int64
				Count    int
			}{
				Visitors: make(map[string]bool),
			}
		}

		stats := urlStats[log.URLPath]
		stats.Views++
		stats.Visitors[log.VisitorID] = true
		stats.Duration += int64(log.Duration)
		stats.Count++
	}

	// 批量更新URL统计
	for urlPath, stats := range urlStats {
		uniqueVisitors := int64(len(stats.Visitors))
		avgDuration := stats.Duration / int64(stats.Count)
		isBounce := avgDuration < 10 // 平均停留时间小于10秒视为跳出

		// 使用现有的IncrementViews方法逐个更新
		if err := s.urlStatRepo.IncrementViews(ctx, urlPath, uniqueVisitors > 0, int(avgDuration), isBounce); err != nil {
			return fmt.Errorf("更新URL统计失败: %w", err)
		}
	}

	return nil
}

// 智能获取基础统计数据（支持高并发）
func (s *visitorStatService) GetBasicStatisticsOptimized(ctx context.Context) (*model.VisitorStatistics, error) {
	// 1. 尝试从缓存获取
	if s.cacheService != nil {
		cachedData, err := s.cacheService.Get(ctx, CacheKeyBasicStats)
		if err == nil && cachedData != "" {
			var stats model.VisitorStatistics
			if json.Unmarshal([]byte(cachedData), &stats) == nil {
				s.enrichTodayYesterdayFromVisitorLogs(ctx, &stats)
				return &stats, nil
			}
		}
	}

	// 2. 从Redis实时计数获取今日数据
	stats := &model.VisitorStatistics{}
	if s.cacheService != nil {
		now := utils.NowInChina()
		today := now.Format("2006-01-02")

		// 获取实时访问量
		if todayViews, err := s.cacheService.Get(ctx, CacheKeyRealTimeViews+today); err == nil && todayViews != "" {
			if views, err := strconv.ParseInt(todayViews, 10, 64); err == nil {
				stats.TodayViews = views
			}
		}

		// 获取实时访客数
		if todayVisitors, err := s.cacheService.Get(ctx, CacheKeyRealTimeVisitors+today); err == nil && todayVisitors != "" {
			if visitors, err := strconv.ParseInt(todayVisitors, 10, 64); err == nil {
				stats.TodayVisitors = visitors
			}
		}

		// 如果Redis中有今日数据，从数据库获取其他数据
		if stats.TodayViews > 0 || stats.TodayVisitors > 0 {
			// 异步更新数据库统计（不阻塞读取）
			go func() {
				if err := s.updateDatabaseStats(ctx, stats); err != nil {
					fmt.Printf("异步更新数据库统计失败: %v\n", err)
				}
			}()

			s.enrichTodayYesterdayFromVisitorLogs(ctx, stats)

			// 写入缓存
			if data, err := json.Marshal(stats); err == nil {
				s.cacheService.Set(ctx, CacheKeyBasicStats, string(data), CacheExpireBasicStats)
			}

			return stats, nil
		}
	}

	// 3. 从数据库获取完整数据
	dbStats, err := s.visitorStatRepo.GetBasicStatistics(ctx)
	if err != nil {
		return nil, err
	}

	// 4. 合并Redis实时数据和数据库历史数据
	stats.TodayVisitors = dbStats.TodayVisitors
	stats.TodayViews = dbStats.TodayViews
	stats.YesterdayVisitors = dbStats.YesterdayVisitors
	stats.YesterdayViews = dbStats.YesterdayViews
	stats.MonthViews = dbStats.MonthViews
	stats.YearViews = dbStats.YearViews

	s.enrichTodayYesterdayFromVisitorLogs(ctx, stats)

	// 5. 写入缓存
	if s.cacheService != nil {
		if data, err := json.Marshal(stats); err == nil {
			s.cacheService.Set(ctx, CacheKeyBasicStats, string(data), CacheExpireBasicStats)
		}
	}

	return stats, nil
}

// 异步更新数据库统计
func (s *visitorStatService) updateDatabaseStats(ctx context.Context, stats *model.VisitorStatistics) error {
	// 这里可以实现异步更新逻辑，比如将统计数据写入消息队列
	// 然后由后台worker处理，避免阻塞主流程
	return nil
}

// 获取客户端真实IP
func (s *visitorStatService) getClientIP(c *gin.Context) string {
	// 检查代理头
	if ip := c.GetHeader("X-Forwarded-For"); ip != "" {
		// X-Forwarded-For 可能包含多个IP，取第一个
		if ips := strings.Split(ip, ","); len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	if ip := c.GetHeader("X-Real-IP"); ip != "" {
		return ip
	}

	if ip := c.GetHeader("X-Original-Forwarded-For"); ip != "" {
		return ip
	}

	// 返回默认IP
	return c.ClientIP()
}

// 生成访客ID
func (s *visitorStatService) generateVisitorID(ip, userAgent string) string {
	hash := md5.Sum([]byte(ip + userAgent))
	return fmt.Sprintf("%x", hash)
}

// 获取地理位置信息
// referer 参数用于 NSUUU API 白名单验证
func (s *visitorStatService) getGeoLocation(ip, referer string) (country, region, city string) {
	if s.geoipService == nil {
		return "未知", "未知", "未知"
	}

	location, err := s.geoipService.Lookup(ip, referer)
	if err != nil {
		return "未知", "未知", "未知"
	}

	// 解析位置字符串，格式可能是 "省份 城市" 或 "城市" 或 "省份" 或 "国家"
	parts := strings.Split(strings.TrimSpace(location), " ")

	if len(parts) == 2 {
		// 格式: "省份 城市"
		return "未知", parts[0], parts[1]
	} else if len(parts) == 1 {
		// 格式: "城市" 或 "省份" 或 "国家"
		// 这里我们假设是城市，因为大多数情况下返回的是城市名
		return "未知", "未知", parts[0]
	}

	return "未知", "未知", "未知"
}

// 解析User-Agent
func (s *visitorStatService) parseUserAgent(userAgent string) (browser, os, device string) {
	// 这里可以使用第三方库来解析User-Agent，简化处理
	ua := strings.ToLower(userAgent)

	// 检测浏览器
	if strings.Contains(ua, "chrome") {
		browser = "Chrome"
	} else if strings.Contains(ua, "firefox") {
		browser = "Firefox"
	} else if strings.Contains(ua, "safari") {
		browser = "Safari"
	} else if strings.Contains(ua, "edge") {
		browser = "Edge"
	} else {
		browser = "其他"
	}

	// 检测操作系统
	if strings.Contains(ua, "windows") {
		os = "Windows"
	} else if strings.Contains(ua, "mac") {
		os = "macOS"
	} else if strings.Contains(ua, "linux") {
		os = "Linux"
	} else if strings.Contains(ua, "android") {
		os = "Android"
	} else if strings.Contains(ua, "ios") {
		os = "iOS"
	} else {
		os = "其他"
	}

	// 检测设备类型
	if strings.Contains(ua, "mobile") {
		device = "手机"
	} else if strings.Contains(ua, "tablet") {
		device = "平板"
	} else {
		device = "桌面"
	}

	return browser, os, device
}
