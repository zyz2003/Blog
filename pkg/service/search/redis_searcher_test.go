package search

import (
	"strings"
	"testing"
	"time"
)

func TestTokenize(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:     "空字符串",
			input:    "",
			expected: []string{},
		},
		{
			name:     "纯空格",
			input:    "   \t\n  ",
			expected: []string{},
		},
		{
			name:     "纯英文",
			input:    "Hello World",
			expected: []string{"hello", "world"},
		},
		{
			name:     "纯中文",
			input:    "你好世界",
			expected: []string{"你", "好", "世", "界", "你好", "好世", "世界"},
		},
		{
			name:     "中英文混合",
			input:    "Hello 世界 World",
			expected: []string{"hello", "world", "世", "界", "世界"},
		},
		{
			name:     "包含HTML标签",
			input:    "<h1>Hello</h1> <p>世界</p>",
			expected: []string{"h1", "hello", "p", "世", "界", "世界"},
		},
		{
			name:     "包含特殊字符",
			input:    "Hello@World#世界$",
			expected: []string{"hello", "world", "世", "界", "世界"},
		},
		{
			name:     "包含数字（内容中）",
			input:    "Hello 123 World 456",
			expected: []string{"hello", "123", "world", "456"},
		},
		{
			name:     "包含标点符号",
			input:    "Hello, World! 你好，世界？",
			expected: []string{"hello", "world", "你", "好", "世", "界", "你好", "世界"},
		},
		{
			name:     "大小写混合",
			input:    "Hello WORLD hElLo",
			expected: []string{"hello", "world"}, // 新逻辑会去重
		},
		{
			name:     "重复词",
			input:    "Hello Hello World World",
			expected: []string{"hello", "world"},
		},
		{
			name:     "单个字符",
			input:    "a b c",
			expected: []string{"a", "b", "c"},
		},
		{
			name:     "Unicode字符",
			input:    "Hello 🌍 世界",
			expected: []string{"hello", "世", "界", "世界"},
		},
		{
			name:     "版本号",
			input:    "Go 1.18.0",
			expected: []string{"go", "1.18.0"},
		},
		{
			name:     "带下划线的标识符",
			input:    "user_name test_case",
			expected: []string{"user_name", "user", "name", "test_case", "test", "case"},
		},
		{
			name:     "带连字符的标识符",
			input:    "go-redis redis-cli",
			expected: []string{"go-redis", "go", "redis", "redis-cli", "cli"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tokenize(tt.input)
			if !compareStringSlices(result, tt.expected) {
				t.Errorf("tokenize(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

// 性能测试
func BenchmarkTokenize(b *testing.B) {
	input := "Hello World 你好世界 1234567890"
	for i := 0; i < b.N; i++ {
		tokenize(input)
	}
}

// 辅助函数：比较字符串切片
func compareStringSlices(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	// 创建映射来比较
	mapA := make(map[string]int)
	mapB := make(map[string]int)

	for _, s := range a {
		mapA[s]++
	}
	for _, s := range b {
		mapB[s]++
	}

	if len(mapA) != len(mapB) {
		return false
	}

	for k, v := range mapA {
		if mapB[k] != v {
			return false
		}
	}

	return true
}

// 边缘情况测试
func TestEdgeCases(t *testing.T) {
	t.Run("超长字符串", func(t *testing.T) {
		// 创建一个超长的字符串
		longString := ""
		for i := 0; i < 10000; i++ {
			longString += "a"
		}

		result := tokenize(longString)
		if len(result) == 0 {
			t.Error("超长字符串应该至少返回一个结果")
		}
	})

	t.Run("Unicode边界", func(t *testing.T) {
		// 测试Unicode边界字符
		boundaryChars := []rune{
			0x4DFF, // 中文字符范围之前
			0x4E00, // 中文字符范围开始
			0x9FFF, // 中文字符范围结束
			0xA000, // 中文字符范围之后
		}

		for _, char := range boundaryChars {
			input := string(char)
			result := tokenize(input)
			// 只应该索引中文字符范围内的字符
			if char >= 0x4E00 && char <= 0x9FFF {
				if len(result) == 0 {
					t.Errorf("中文字符 %U 应该被索引", char)
				}
			} else {
				if len(result) > 0 {
					t.Errorf("非中文字符 %U 不应该被索引", char)
				}
			}
		}
	})

	t.Run("特殊Unicode字符", func(t *testing.T) {
		// 测试各种特殊Unicode字符
		specialChars := []string{
			"Hello\u0000World", // 空字符
			"Hello\u0001World", // 控制字符
			"Hello\u00A0World", // 不间断空格
			"Hello\u200BWorld", // 零宽空格
			"Hello\uFEFFWorld", // 字节顺序标记
		}

		for _, input := range specialChars {
			result := tokenize(input)
			// 应该能正确处理特殊字符
			if len(result) == 0 {
				t.Errorf("特殊字符字符串应该返回结果: %q", input)
			}
		}
	})

	t.Run("数字处理", func(t *testing.T) {
		// 测试数字处理
		numberTests := []struct {
			input    string
			expected bool
		}{
			{"123", true},      // 连续数字应该被索引
			{"1.2.3", true},    // 带点的版本号应该被索引
			{"go-1.18", true},  // 带连字符的版本号应该被索引
			{"user_123", true}, // 带下划线的标识符应该被索引
		}

		for _, tt := range numberTests {
			result := tokenize(tt.input)
			hasExpected := false
			for _, word := range result {
				// 检查是否包含数字或版本号模式
				if strings.Contains(word, "123") || strings.Contains(word, "1.18") ||
					strings.Contains(word, "1.2.3") || strings.Contains(word, "user_123") {
					hasExpected = true
					break
				}
			}
			if hasExpected != tt.expected {
				t.Errorf("数字处理 %s 的结果不正确: got %v, want %v, 分词结果: %v", tt.input, hasExpected, tt.expected, result)
			}
		}
	})
}

// 测试常量定义
func TestConstants(t *testing.T) {
	t.Run("权重常量", func(t *testing.T) {
		if WeightTitle != 10.0 {
			t.Errorf("标题权重应该是 10.0，实际是 %f", WeightTitle)
		}
		if WeightContent != 1.0 {
			t.Errorf("内容权重应该是 1.0，实际是 %f", WeightContent)
		}
	})

	t.Run("Key前缀常量", func(t *testing.T) {
		if KeyPrefixArticle != "anheyu:search:article:" {
			t.Errorf("文章Key前缀应该是 'anheyu:search:article:'，实际是 '%s'", KeyPrefixArticle)
		}
		if KeyPrefixIndex != "anheyu:search:index:" {
			t.Errorf("索引Key前缀应该是 'anheyu:search:index:'，实际是 '%s'", KeyPrefixIndex)
		}
		if KeyPrefixWords != "anheyu:search:words:" {
			t.Errorf("词条Key前缀应该是 'anheyu:search:words:'，实际是 '%s'", KeyPrefixWords)
		}
	})

	t.Run("缓存TTL", func(t *testing.T) {
		if ResultCacheTTL != 10*time.Minute {
			t.Errorf("结果缓存TTL应该是 10分钟，实际是 %v", ResultCacheTTL)
		}
	})
}

// 测试正则表达式
func TestRegexPatterns(t *testing.T) {
	t.Run("HTML标签正则", func(t *testing.T) {
		testCases := []struct {
			input    string
			expected string
		}{
			{"<h1>Hello</h1>", "Hello"},
			{"<p>世界</p>", "世界"},
			{"<div class='test'>Content</div>", "Content"},
			{"No tags here", "No tags here"},
		}

		for _, tc := range testCases {
			result := reHTMLTags.ReplaceAllString(tc.input, "")
			if result != tc.expected {
				t.Errorf("HTML标签清理失败: 输入 '%s', 期望 '%s', 实际 '%s'", tc.input, tc.expected, result)
			}
		}
	})

	t.Run("中文字符正则", func(t *testing.T) {
		testCases := []struct {
			input       string
			shouldMatch bool
		}{
			{"你", true},
			{"好", true},
			{"a", false},
			{"1", false},
			{"🌍", false},
		}

		for _, tc := range testCases {
			matches := reChineseChars.MatchString(tc.input)
			if matches != tc.shouldMatch {
				t.Errorf("中文字符匹配失败: 输入 '%s', 期望匹配 %v, 实际匹配 %v", tc.input, tc.shouldMatch, matches)
			}
		}
	})

	t.Run("字母数字正则", func(t *testing.T) {
		testCases := []struct {
			input       string
			shouldMatch bool
		}{
			{"hello", true},
			{"123", true},
			{"go-1.18", true},
			{"user_name", true},
			{"你好", false},
			{"@#$", false},
		}

		for _, tc := range testCases {
			matches := reAlphanumeric.MatchString(tc.input)
			if matches != tc.shouldMatch {
				t.Errorf("字母数字匹配失败: 输入 '%s', 期望匹配 %v, 实际匹配 %v", tc.input, tc.shouldMatch, matches)
			}
		}
	})
}
