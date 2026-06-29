/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-08 16:10:36
 * @LastEditTime: 2025-08-08 16:10:41
 * @LastEditors: 安知鱼
 */
package parser

import "github.com/microcosm-cc/bluemonday"

var stripTagsPolicy *bluemonday.Policy

func init() {
	// StripTagsPolicy 会移除所有的HTML标签
	stripTagsPolicy = bluemonday.StripTagsPolicy()
}

// StripHTML 接受一个HTML字符串，返回一个去除了所有标签的纯文本字符串。
func StripHTML(htmlContent string) string {
	return stripTagsPolicy.Sanitize(htmlContent)
}
