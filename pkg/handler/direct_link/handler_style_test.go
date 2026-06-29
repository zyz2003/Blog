/*
 * @Description: 直链 handler 样式解析工具测试
 * @Author: 安知鱼
 *
 * 聚焦 extractLocalStyleName / isValidStyleName 两个纯函数的边界行为；
 * serveStyledLocal 依赖 gin.Context 与 ImageStyleService，留给上层集成测试覆盖。
 */
package direct_link

import "testing"

func TestIsValidStyleName(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want bool
	}{
		{"空字符串", "", false},
		{"单字符合法", "a", true},
		{"数字开头合法", "9thumb", true},
		{"下划线合法", "foo_bar", true},
		{"连字符合法", "foo-bar", true},
		{"混合合法", "ABC_abc-123", true},
		{"32 位边界合法", "abcdefghijklmnopqrstuvwxyz012345", true}, // 32 chars
		{"超长非法", "abcdefghijklmnopqrstuvwxyz0123456", false},   // 33 chars
		{"空格非法", "foo bar", false},
		{"点号非法", "foo.bar", false},
		{"斜杠非法", "foo/bar", false},
		{"感叹号非法", "!foo", false},
		{"查询字符非法", "foo?bar", false},
		{"中文非法", "缩略图", false},
		{"HTML 注入字符", "<script>", false},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got := isValidStyleName(tc.in)
			if got != tc.want {
				t.Fatalf("isValidStyleName(%q) = %v, 期望 %v", tc.in, got, tc.want)
			}
		})
	}
}

func TestExtractLocalStyleName(t *testing.T) {
	tests := []struct {
		name     string
		fullPath string
		filename string
		want     string
	}{
		// 基础命中
		{
			name:     "标准命中",
			fullPath: "/1776843958024851004.jpg!thumbnail",
			filename: "1776843958024851004.jpg",
			want:     "thumbnail",
		},
		{
			name:     "开头无斜杠",
			fullPath: "foo.png!thumbnail",
			filename: "foo.png",
			want:     "thumbnail",
		},
		{
			name:     "样式名含连字符",
			fullPath: "/foo.png!thumb-1",
			filename: "foo.png",
			want:     "thumb-1",
		},
		{
			name:     "样式名含下划线",
			fullPath: "/foo.png!thumb_x",
			filename: "foo.png",
			want:     "thumb_x",
		},

		// 无样式（回退原图）
		{
			name:     "路径无感叹号",
			fullPath: "/foo.jpg",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "filename 不匹配前缀",
			fullPath: "/other.jpg!thumb",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "空路径",
			fullPath: "",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "空 filename",
			fullPath: "/foo.jpg!thumb",
			filename: "",
			want:     "",
		},

		// 样式名非法 → 视为无样式，交由调用方降级
		{
			name:     "样式名含空格非法",
			fullPath: "/foo.jpg!thumb x",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "样式名含 HTML 非法",
			fullPath: "/foo.jpg!<script>",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "样式名以斜杠包含 (路径遍历)",
			fullPath: "/foo.jpg!../etc/passwd",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "样式名空 (仅尾感叹号)",
			fullPath: "/foo.jpg!",
			filename: "foo.jpg",
			want:     "",
		},
		{
			name:     "样式名超长",
			fullPath: "/foo.jpg!abcdefghijklmnopqrstuvwxyz0123456", // 33 chars
			filename: "foo.jpg",
			want:     "",
		},

		// filename 本身含感叹号（罕见但允许）
		{
			name:     "filename 含感叹号无样式",
			fullPath: "/foo!bar.jpg",
			filename: "foo!bar.jpg",
			want:     "",
		},
		{
			name:     "filename 含感叹号加样式",
			fullPath: "/foo!bar.jpg!thumbnail",
			filename: "foo!bar.jpg",
			want:     "thumbnail",
		},

		// 连续感叹号 → 第一个 `!` 后面的部分会被判为非法（因包含 `!`）
		{
			name:     "连续感叹号非法",
			fullPath: "/foo.jpg!!thumbnail",
			filename: "foo.jpg",
			want:     "",
		},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got := extractLocalStyleName(tc.fullPath, tc.filename)
			if got != tc.want {
				t.Fatalf("extractLocalStyleName(%q, %q) = %q, 期望 %q",
					tc.fullPath, tc.filename, got, tc.want)
			}
		})
	}
}
