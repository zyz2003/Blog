package frontend

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetStaticDirPathPrefersEnv(t *testing.T) {
	tempDir := t.TempDir()
	customStaticDir := filepath.Join(tempDir, "custom-static")
	if err := os.MkdirAll(customStaticDir, 0o755); err != nil {
		t.Fatalf("创建测试目录失败: %v", err)
	}
	t.Setenv(StaticDirEnvKey, customStaticDir)

	got := GetStaticDirPath()
	want, err := filepath.Abs(customStaticDir)
	if err != nil {
		t.Fatalf("解析绝对路径失败: %v", err)
	}
	if got != want {
		t.Fatalf("GetStaticDirPath() = %q, want %q", got, want)
	}
}

func TestIsStaticModeActiveValidation(t *testing.T) {
	tempDir := t.TempDir()
	staticDir := filepath.Join(tempDir, "static")
	if err := os.MkdirAll(staticDir, 0o755); err != nil {
		t.Fatalf("创建 static 目录失败: %v", err)
	}
	t.Setenv(StaticDirEnvKey, staticDir)

	// 空 index.html 视为无效。
	emptyIndex := filepath.Join(staticDir, "index.html")
	if err := os.WriteFile(emptyIndex, []byte(""), 0o644); err != nil {
		t.Fatalf("写入空 index.html 失败: %v", err)
	}
	if IsStaticModeActive() {
		t.Fatalf("空 index.html 不应激活 static 模式")
	}

	// 仅有 index.html 且不是 HTML 结构，视为无效。
	if err := os.WriteFile(emptyIndex, []byte("not-html"), 0o644); err != nil {
		t.Fatalf("写入无效 index.html 失败: %v", err)
	}
	if IsStaticModeActive() {
		t.Fatalf("无效 HTML 内容不应激活 static 模式")
	}

	// 合法 HTML 应激活 static 模式。
	if err := os.WriteFile(emptyIndex, []byte("<!doctype html><html><body>ok</body></html>"), 0o644); err != nil {
		t.Fatalf("写入有效 index.html 失败: %v", err)
	}
	if !IsStaticModeActive() {
		t.Fatalf("有效 index.html 应激活 static 模式")
	}
}

func TestResolveStaticFilePathStayInsideStaticDir(t *testing.T) {
	tempDir := t.TempDir()
	staticDir := filepath.Join(tempDir, "static")
	if err := os.MkdirAll(staticDir, 0o755); err != nil {
		t.Fatalf("创建 static 目录失败: %v", err)
	}
	t.Setenv(StaticDirEnvKey, staticDir)

	targetPath, ok := resolveStaticFilePath("/assets/app.js")
	if !ok {
		t.Fatalf("解析正常路径失败")
	}
	if !isPathInsideBase(staticDir, targetPath) {
		t.Fatalf("目标路径应位于 static 目录内, path=%q", targetPath)
	}

	targetPath, ok = resolveStaticFilePath("/../../etc/passwd")
	if !ok {
		t.Fatalf("遍历路径应被安全归一化到 static 目录内")
	}
	if !isPathInsideBase(staticDir, targetPath) {
		t.Fatalf("归一化后路径必须仍在 static 目录内, path=%q", targetPath)
	}
}

func TestIsAdminPath(t *testing.T) {
	testCases := []struct {
		path string
		want bool
	}{
		{path: "/admin", want: true},
		{path: "/admin/settings", want: true},
		{path: "/admin-guide", want: false},
		{path: "/login", want: true},
		{path: "/login/reset", want: true},
		{path: "/login-help", want: false},
		{path: "/_next/static/chunk.js", want: true},
		{path: "/article/hello", want: false},
	}

	for _, tc := range testCases {
		got := isAdminPath(tc.path)
		if got != tc.want {
			t.Fatalf("isAdminPath(%q) = %v, want %v", tc.path, got, tc.want)
		}
	}
}
