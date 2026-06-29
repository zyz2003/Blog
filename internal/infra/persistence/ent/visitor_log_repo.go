/*
 * @Description: 访问日志仓储实现
 * @Author: 安知鱼
 * @Date: 2025-01-20 15:30:00
 * @LastEditTime: 2025-08-21 10:50:33
 * @LastEditors: 安知鱼
 */
package ent

import (
	"context"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/ent"
	"github.com/anzhiyu-c/anheyu-app/ent/visitorlog"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/utils"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

type entVisitorLogRepository struct {
	client *ent.Client
}

// NewVisitorLogRepository 创建访问日志仓储实例
func NewVisitorLogRepository(client *ent.Client) repository.VisitorLogRepository {
	return &entVisitorLogRepository{
		client: client,
	}
}

// normalizeRefererAnalyticsKey 将同一站点不同路径的 Referer 合并为同一统计维度（小写 hostname），
// 与后台「访问来源」图表按域名展示一致，避免多条记录显示相同标签。
func normalizeRefererAnalyticsKey(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	u, err := url.Parse(s)
	if err != nil {
		return s
	}
	scheme := strings.ToLower(u.Scheme)
	// 含主机的绝对 URL（含 //host 形式 scheme 为空）
	if u.Host != "" && (scheme == "http" || scheme == "https" || scheme == "") {
		host := strings.ToLower(u.Hostname())
		if host != "" {
			return host
		}
	}
	return s
}

func (r *entVisitorLogRepository) Create(ctx context.Context, log *ent.VisitorLog) error {
	_, err := r.client.VisitorLog.Create().
		SetVisitorID(log.VisitorID).
		SetNillableSessionID(log.SessionID).
		SetIPAddress(log.IPAddress).
		SetNillableUserAgent(log.UserAgent).
		SetNillableReferer(log.Referer).
		SetURLPath(log.URLPath).
		SetNillableCountry(log.Country).
		SetNillableRegion(log.Region).
		SetNillableCity(log.City).
		SetNillableBrowser(log.Browser).
		SetNillableOs(log.Os).
		SetNillableDevice(log.Device).
		SetDuration(log.Duration).
		SetIsBounce(log.IsBounce).
		Save(ctx)
	return err
}

func (r *entVisitorLogRepository) CreateBatch(ctx context.Context, logs []*ent.VisitorLog) error {
	bulk := make([]*ent.VisitorLogCreate, len(logs))
	for i, log := range logs {
		bulk[i] = r.client.VisitorLog.Create().
			SetVisitorID(log.VisitorID).
			SetNillableSessionID(log.SessionID).
			SetIPAddress(log.IPAddress).
			SetNillableUserAgent(log.UserAgent).
			SetNillableReferer(log.Referer).
			SetURLPath(log.URLPath).
			SetNillableCountry(log.Country).
			SetNillableRegion(log.Region).
			SetNillableCity(log.City).
			SetNillableBrowser(log.Browser).
			SetNillableOs(log.Os).
			SetNillableDevice(log.Device).
			SetDuration(log.Duration).
			SetIsBounce(log.IsBounce)
	}

	_, err := r.client.VisitorLog.CreateBulk(bulk...).Save(ctx)
	return err
}

func (r *entVisitorLogRepository) GetByTimeRange(ctx context.Context, startTime, endTime time.Time) ([]*ent.VisitorLog, error) {
	return r.client.VisitorLog.Query().
		Where(
			visitorlog.CreatedAtGTE(startTime),
			visitorlog.CreatedAtLTE(endTime),
		).
		Order(ent.Desc(visitorlog.FieldCreatedAt)).
		All(ctx)
}

func (r *entVisitorLogRepository) GetByVisitorID(ctx context.Context, visitorID string, limit int) ([]*ent.VisitorLog, error) {
	return r.client.VisitorLog.Query().
		Where(visitorlog.VisitorIDEQ(visitorID)).
		Order(ent.Desc(visitorlog.FieldCreatedAt)).
		Limit(limit).
		All(ctx)
}

func (r *entVisitorLogRepository) CountUniqueVisitors(ctx context.Context, date time.Time) (int64, error) {
	// 使用中国时区 UTC+8 来匹配数据库中存储的时间
	startOfDay := utils.StartOfDayInChina(date)
	endOfDay := startOfDay.AddDate(0, 0, 1)
	visitorIDs, err := r.client.VisitorLog.
		Query().
		Where(
			visitorlog.CreatedAtGTE(startOfDay),
			visitorlog.CreatedAtLT(endOfDay),
		).
		GroupBy(visitorlog.FieldVisitorID).
		Strings(ctx)

	if err != nil {
		return 0, err
	}

	return int64(len(visitorIDs)), nil
}

func (r *entVisitorLogRepository) CountTotalViews(ctx context.Context, date time.Time) (int64, error) {
	// 使用中国时区 UTC+8 来匹配数据库中存储的时间
	startOfDay := utils.StartOfDayInChina(date)
	endOfDay := utils.EndOfDayInChina(date)

	count, err := r.client.VisitorLog.Query().
		Where(
			visitorlog.CreatedAtGTE(startOfDay),
			visitorlog.CreatedAtLTE(endOfDay),
		).
		Count(ctx)

	if err != nil {
		return 0, err
	}

	return int64(count), nil
}

func (r *entVisitorLogRepository) GetFirstDate(ctx context.Context) (*time.Time, error) {
	log, err := r.client.VisitorLog.
		Query().
		Order(ent.Asc(visitorlog.FieldCreatedAt)).
		First(ctx)
	if err != nil {
		return nil, err
	}
	return &log.CreatedAt, nil
}

func (r *entVisitorLogRepository) GetVisitorAnalytics(ctx context.Context, startDate, endDate time.Time) (*model.VisitorAnalytics, error) {
	analytics := &model.VisitorAnalytics{}

	// 查询基础数据
	logs, err := r.GetByTimeRange(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// 统计国家分布
	countryMap := make(map[string]int64)
	cityMap := make(map[string]int64)
	browserMap := make(map[string]int64)
	osMap := make(map[string]int64)
	deviceMap := make(map[string]int64)
	refererMap := make(map[string]int64)

	for _, log := range logs {
		if log.Country != nil && *log.Country != "" {
			countryMap[*log.Country]++
		}
		if log.City != nil && *log.City != "" {
			cityMap[*log.City]++
		}
		if log.Browser != nil && *log.Browser != "" {
			browserMap[*log.Browser]++
		}
		if log.Os != nil && *log.Os != "" {
			osMap[*log.Os]++
		}
		if log.Device != nil && *log.Device != "" {
			deviceMap[*log.Device]++
		}
		ref := ""
		if log.Referer != nil {
			ref = strings.TrimSpace(*log.Referer)
		}
		// 空 Referer 记为「直接访问」；http(s) 按 hostname 合并，与前台展示一致
		key := normalizeRefererAnalyticsKey(ref)
		refererMap[key]++
	}

	// 转换为排序后的切片（这里简化处理，实际应该排序）
	for country, count := range countryMap {
		analytics.TopCountries = append(analytics.TopCountries, model.CountryStats{
			Country: country,
			Count:   count,
		})
	}

	for city, count := range cityMap {
		analytics.TopCities = append(analytics.TopCities, model.CityStats{
			City:  city,
			Count: count,
		})
	}

	for browser, count := range browserMap {
		analytics.TopBrowsers = append(analytics.TopBrowsers, model.BrowserStats{
			Browser: browser,
			Count:   count,
		})
	}

	for os, count := range osMap {
		analytics.TopOS = append(analytics.TopOS, model.OSStats{
			OS:    os,
			Count: count,
		})
	}

	for device, count := range deviceMap {
		analytics.TopDevices = append(analytics.TopDevices, model.DeviceStats{
			Device: device,
			Count:  count,
		})
	}

	type refAgg struct {
		key   string
		count int64
	}
	refList := make([]refAgg, 0, len(refererMap))
	for referer, count := range refererMap {
		refList = append(refList, refAgg{key: referer, count: count})
	}
	sort.Slice(refList, func(i, j int) bool {
		if refList[i].count != refList[j].count {
			return refList[i].count > refList[j].count
		}
		return refList[i].key < refList[j].key
	})
	for _, e := range refList {
		analytics.TopReferers = append(analytics.TopReferers, model.RefererStats{
			Referer: e.key,
			Count:   e.count,
		})
	}

	return analytics, nil
}

func (r *entVisitorLogRepository) CleanupOldLogs(ctx context.Context, keepDays int) error {
	cutoffDate := utils.NowInChina().AddDate(0, 0, -keepDays)

	_, err := r.client.VisitorLog.Delete().
		Where(visitorlog.CreatedAtLT(cutoffDate)).
		Exec(ctx)

	return err
}
