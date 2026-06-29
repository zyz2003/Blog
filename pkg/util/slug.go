package util

import (
	"regexp"
	"strings"
	"unicode"

	"github.com/mozillazg/go-pinyin"
)

var (
	slugSeparatorRe = regexp.MustCompile(`[^a-z0-9]+`)
	slugTrimRe      = regexp.MustCompile(`^-+|-+$`)
)

// GenerateSlug 将名称转换为 URL 友好的 slug。
// 中文字符转拼音，英文保留原样，特殊字符替换为连字符。
// 例: "前端开发" -> "qian-duan-kai-fa", "Go 语言" -> "go-yu-yan"
func GenerateSlug(name string) string {
	if name == "" {
		return ""
	}

	a := pinyin.NewArgs()
	a.Style = pinyin.Normal
	a.Fallback = func(r rune, a pinyin.Args) []string {
		return []string{string(r)}
	}

	var parts []string
	var currentWord strings.Builder

	for _, r := range name {
		if unicode.Is(unicode.Han, r) {
			if currentWord.Len() > 0 {
				parts = append(parts, currentWord.String())
				currentWord.Reset()
			}
			py := pinyin.SinglePinyin(r, a)
			if len(py) > 0 {
				parts = append(parts, py[0])
			}
		} else {
			currentWord.WriteRune(r)
		}
	}
	if currentWord.Len() > 0 {
		parts = append(parts, currentWord.String())
	}

	joined := strings.ToLower(strings.Join(parts, "-"))
	slug := slugSeparatorRe.ReplaceAllString(joined, "-")
	slug = slugTrimRe.ReplaceAllString(slug, "")

	return slug
}
