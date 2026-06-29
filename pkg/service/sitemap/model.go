/*
 * @Description: 站点地图数据模型
 * @Author: 安知鱼
 * @Date: 2025-09-21 00:00:00
 * @LastEditTime: 2025-09-21 00:00:00
 * @LastEditors: 安知鱼
 */
package sitemap

import (
	"encoding/xml"
	"time"
)

// URLSet 站点地图根元素
type URLSet struct {
	XMLName xml.Name `xml:"urlset"`
	Xmlns   string   `xml:"xmlns,attr"`
	URLs    []URL    `xml:"url"`
}

// URL 站点地图URL条目
type URL struct {
	Location     string  `xml:"loc"`
	LastModified string  `xml:"lastmod,omitempty"`
	ChangeFreq   string  `xml:"changefreq,omitempty"`
	Priority     float32 `xml:"priority,omitempty"`
}

// ChangeFrequency 更新频率枚举
type ChangeFrequency string

const (
	ChangeFreqAlways  ChangeFrequency = "always"
	ChangeFreqHourly  ChangeFrequency = "hourly"
	ChangeFreqDaily   ChangeFrequency = "daily"
	ChangeFreqWeekly  ChangeFrequency = "weekly"
	ChangeFreqMonthly ChangeFrequency = "monthly"
	ChangeFreqYearly  ChangeFrequency = "yearly"
	ChangeFreqNever   ChangeFrequency = "never"
)

// SitemapItem 站点地图条目接口
type SitemapItem struct {
	URL          string
	LastModified time.Time
	ChangeFreq   ChangeFrequency
	Priority     float32
}

// ToURL 转换为URL结构
func (s *SitemapItem) ToURL() URL {
	return URL{
		Location:     s.URL,
		LastModified: s.LastModified.Format("2006-01-02T15:04:05-07:00"),
		ChangeFreq:   string(s.ChangeFreq),
		Priority:     s.Priority,
	}
}
