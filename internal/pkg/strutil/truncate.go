/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-08 16:10:53
 * @LastEditTime: 2025-08-08 16:10:58
 * @LastEditors: 安知鱼
 */
package strutil

import "unicode/utf8"

// Truncate 安全地将UTF-8字符串截断到指定的长度，并在需要时添加省略号。
func Truncate(s string, maxLength int) string {
	// 如果原字符串没有超出最大长度，直接返回
	if utf8.RuneCountInString(s) <= maxLength {
		return s
	}

	// 将字符串转换为 rune 切片
	runes := []rune(s)

	// 截取指定长度的 rune，并转换回字符串
	return string(runes[:maxLength]) + "..."
}
