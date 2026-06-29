/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-08-08 15:57:23
 * @LastEditTime: 2025-08-08 15:57:28
 * @LastEditors: 安知鱼
 */
// internal/pkg/parser/markdown.go
package parser

import (
	"bytes"

	"github.com/microcosm-cc/bluemonday"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

var mdParser goldmark.Markdown
var policy *bluemonday.Policy

func init() {
	// 初始化 Goldmark 解析器，并启用常用扩展
	mdParser = goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,           // 支持 GitHub Flavored Markdown
			extension.Footnote,      // 支持脚注
			extension.Typographer,   // 美化排版
			extension.Linkify,       // 自动识别链接
			extension.Strikethrough, // 删除线
			extension.Table,         // 表格
			extension.TaskList,      // 任务列表
		),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(), // 自动为标题生成 ID
		),
		goldmark.WithRendererOptions(
			html.WithHardWraps(), // 硬换行
			html.WithXHTML(),     // 渲染为 XHTML
			html.WithUnsafe(),    // 信任所有原始 HTML，后续由 bluemonday 清理
		),
	)

	// 初始化 bluemonday 的安全策略
	// UGCPolicy 是一个很好的起点，它适用于用户生成的内容
	policy = bluemonday.UGCPolicy()
	// 允许代码高亮需要的 class 属性
	policy.AllowAttrs("class").Matching(bluemonday.SpaceSeparatedTokens).OnElements("code", "span")
	// 允许表格相关元素
	policy.AllowElements("table", "thead", "tbody", "tr", "th", "td")
	// 允许标题的 id 属性，用于锚点链接
	policy.AllowAttrs("id").OnElements("h1", "h2", "h3", "h4", "h5", "h6")
}

// MarkdownToHTML 将 Markdown 字符串转换为安全的 HTML 字符串
func MarkdownToHTML(mdContent string) (string, error) {
	var buf bytes.Buffer
	if err := mdParser.Convert([]byte(mdContent), &buf); err != nil {
		return "", err
	}
	// 使用 bluemonday 清理 HTML，防止 XSS
	safeHTML := policy.Sanitize(buf.String())
	return safeHTML, nil
}
