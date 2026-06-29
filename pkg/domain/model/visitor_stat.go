/*
 * @Description: 访问统计数据模型
 * @Author: 安知鱼
 * @Date: 2025-01-20 15:30:00
 * @LastEditTime: 2025-01-20 15:30:00
 * @LastEditors: 安知鱼
 */
package model

import "time"

// VisitorStatistics 访问统计数据
type VisitorStatistics struct {
	TodayVisitors     int64 `json:"today_visitors"`     // 今日人数
	TodayViews        int64 `json:"today_views"`        // 今日访问
	YesterdayVisitors int64 `json:"yesterday_visitors"` // 昨日人数
	YesterdayViews    int64 `json:"yesterday_views"`    // 昨日访问
	MonthViews        int64 `json:"month_views"`        // 最近月访问
	YearViews         int64 `json:"year_views"`         // 最近年访问
}

// VisitorLogRequest 访问日志请求
type VisitorLogRequest struct {
	URLPath   string `json:"url_path" binding:"required"`
	PageTitle string `json:"page_title"`
	Referer   string `json:"referer"`
	Duration  int    `json:"duration"`
}

// URLStatistics URL统计信息
type URLStatistics struct {
	URLPath       string     `json:"url_path"`
	PageTitle     string     `json:"page_title"`
	TotalViews    int64      `json:"total_views"`
	UniqueViews   int64      `json:"unique_views"`
	BounceCount   int64      `json:"bounce_count"`
	BounceRate    float64    `json:"bounce_rate"`
	AvgDuration   float64    `json:"avg_duration"`
	LastVisitedAt *time.Time `json:"last_visited_at"`
}

// VisitorAnalytics 访客分析数据
type VisitorAnalytics struct {
	TopCountries []CountryStats `json:"top_countries"`
	TopCities    []CityStats    `json:"top_cities"`
	TopBrowsers  []BrowserStats `json:"top_browsers"`
	TopOS        []OSStats      `json:"top_os"`
	TopDevices   []DeviceStats  `json:"top_devices"`
	TopReferers  []RefererStats `json:"top_referers"`
}

type CountryStats struct {
	Country string `json:"country"`
	Count   int64  `json:"count"`
}

type CityStats struct {
	City  string `json:"city"`
	Count int64  `json:"count"`
}

type BrowserStats struct {
	Browser string `json:"browser"`
	Count   int64  `json:"count"`
}

type OSStats struct {
	OS    string `json:"os"`
	Count int64  `json:"count"`
}

type DeviceStats struct {
	Device string `json:"device"`
	Count  int64  `json:"count"`
}

type RefererStats struct {
	Referer string `json:"referer"`
	Count   int64  `json:"count"`
}

// DateRangeStats 时间范围统计
type DateRangeStats struct {
	Date     time.Time `json:"date"`
	Visitors int64     `json:"visitors"`
	Views    int64     `json:"views"`
}

// VisitorTrendData 访客趋势数据
type VisitorTrendData struct {
	Daily   []DateRangeStats `json:"daily"`   // 每日数据
	Weekly  []DateRangeStats `json:"weekly"`  // 每周数据
	Monthly []DateRangeStats `json:"monthly"` // 每月数据
}
