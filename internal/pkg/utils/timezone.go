/*
 * @Description: 时区工具 - 统一使用 UTC+8 时区
 * @Author: 安知鱼
 * @Date: 2026-01-15 10:00:00
 * @LastEditTime: 2026-01-15 10:00:00
 * @LastEditors: 安知鱼
 */
package utils

import "time"

// ChinaTimezone 中国标准时间 UTC+8
var ChinaTimezone = time.FixedZone("CST", 8*60*60)

// NowInChina 获取当前中国时间
func NowInChina() time.Time {
	return time.Now().In(ChinaTimezone)
}

// ToChina 将时间转换为中国时区
func ToChina(t time.Time) time.Time {
	return t.In(ChinaTimezone)
}

// StartOfDayInChina 获取指定日期在中国时区的开始时间（00:00:00）
func StartOfDayInChina(t time.Time) time.Time {
	chinaTime := t.In(ChinaTimezone)
	return time.Date(chinaTime.Year(), chinaTime.Month(), chinaTime.Day(), 0, 0, 0, 0, ChinaTimezone)
}

// EndOfDayInChina 获取指定日期在中国时区的结束时间（23:59:59.999999999）
func EndOfDayInChina(t time.Time) time.Time {
	chinaTime := t.In(ChinaTimezone)
	return time.Date(chinaTime.Year(), chinaTime.Month(), chinaTime.Day(), 23, 59, 59, 999999999, ChinaTimezone)
}

// ParseInChina 使用中国时区解析时间字符串
func ParseInChina(layout, value string) (time.Time, error) {
	return time.ParseInLocation(layout, value, ChinaTimezone)
}
