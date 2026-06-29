package frontend

import (
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	StaticDirName   = "static"
	StaticDirEnvKey = "ANHEYU_STATIC_DIR"
)

// GetStaticDirPath returns the resolved static directory path.
//
// Priority:
// 1. ANHEYU_STATIC_DIR (explicit override)
// 2. <executable-dir>/static (documented behavior)
// 3. <current-working-dir>/static (backward compatibility)
func GetStaticDirPath() string {
	if envPath := strings.TrimSpace(os.Getenv(StaticDirEnvKey)); envPath != "" {
		if absPath, err := filepath.Abs(envPath); err == nil {
			return absPath
		}
		return envPath
	}

	execStaticDir := ""
	if executablePath, err := os.Executable(); err == nil {
		if realExecutablePath, evalErr := filepath.EvalSymlinks(executablePath); evalErr == nil {
			executablePath = realExecutablePath
		}
		execStaticDir = filepath.Join(filepath.Dir(executablePath), StaticDirName)
	}

	cwdStaticDir := StaticDirName
	if workingDir, err := os.Getwd(); err == nil {
		cwdStaticDir = filepath.Join(workingDir, StaticDirName)
	}
	if isStaticModeActiveAtPath(execStaticDir) {
		return execStaticDir
	}
	if isStaticModeActiveAtPath(cwdStaticDir) {
		return cwdStaticDir
	}
	if isExistingDir(execStaticDir) {
		return execStaticDir
	}
	if isExistingDir(cwdStaticDir) {
		return cwdStaticDir
	}
	if absPath, err := filepath.Abs(StaticDirName); err == nil {
		return absPath
	}
	if execStaticDir != "" {
		return execStaticDir
	}
	return StaticDirName
}

// IsStaticModeActive checks whether a valid static directory exists for custom frontend.
// When active, public-facing pages are served from this directory instead of
// proxying to Next.js. Admin pages still use the Next.js proxy.
func IsStaticModeActive() bool {
	return isStaticModeActiveAtPath(GetStaticDirPath())
}

func isStaticModeActiveAtPath(staticDir string) bool {
	if strings.TrimSpace(staticDir) == "" {
		return false
	}

	info, err := os.Stat(staticDir)
	if err != nil || !info.IsDir() {
		return false
	}

	indexPath := filepath.Join(staticDir, "index.html")
	indexInfo, err := os.Stat(indexPath)
	if err != nil || indexInfo.IsDir() {
		return false
	}
	if indexInfo.Size() == 0 {
		return false
	}

	entries, err := os.ReadDir(staticDir)
	if err != nil || len(entries) == 0 {
		return false
	}

	// Guard against accidental empty placeholder files.
	if len(entries) == 1 && entries[0].Name() == "index.html" {
		content, readErr := os.ReadFile(indexPath)
		if readErr != nil {
			return false
		}
		contentLower := strings.ToLower(string(content))
		if !strings.Contains(contentLower, "<html") && !strings.Contains(contentLower, "<!doctype") {
			return false
		}
	}

	return true
}

// handleStaticRequest serves the request from the static directory.
// Returns true if the request was handled; false means it should fall through to the proxy.
func handleStaticRequest(c *gin.Context, urlPath string) bool {
	if isAdminPath(urlPath) {
		return false
	}

	if serveStaticFile(c, urlPath) {
		return true
	}

	// For page routes (no file extension), serve index.html as SPA fallback
	if !hasFileExtension(urlPath) {
		serveStaticIndex(c)
		return true
	}

	// Static asset not found — let it fall through to the proxy so that
	// admin-related assets (e.g. /_next/) can still be served by Next.js.
	return false
}

// serveStaticFile attempts to serve a single file from the static directory.
func serveStaticFile(c *gin.Context, urlPath string) bool {
	filePath, ok := resolveStaticFilePath(urlPath)
	if !ok {
		return false
	}

	info, err := os.Stat(filePath)
	if err != nil || info.IsDir() {
		return false
	}

	// Prevent symlink escapes from the static root.
	if realPath, evalErr := filepath.EvalSymlinks(filePath); evalErr == nil {
		if !isPathInsideBase(GetStaticDirPath(), realPath) {
			return false
		}
	}

	etag := fmt.Sprintf(`"%x-%x"`, info.ModTime().Unix(), info.Size())
	if match := c.GetHeader("If-None-Match"); match == etag {
		c.Status(http.StatusNotModified)
		c.Abort()
		return true
	}

	ext := strings.ToLower(filepath.Ext(filePath))
	switch {
	case isImmutableAsset(ext):
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
	case ext == ".html":
		c.Header("Cache-Control", "no-cache")
	default:
		c.Header("Cache-Control", "public, max-age=3600")
	}
	c.Header("ETag", etag)

	c.File(filePath)
	c.Abort()
	return true
}

// serveStaticIndex serves index.html from the static directory (SPA fallback).
func serveStaticIndex(c *gin.Context) {
	indexPath := filepath.Join(GetStaticDirPath(), "index.html")
	c.Header("Cache-Control", "no-cache")
	c.File(indexPath)
	c.Abort()
}

// isAdminPath returns true for paths that belong to the admin interface and
// should always be handled by Next.js, even when static mode is active.
func isAdminPath(routePath string) bool {
	return hasExactOrChildPath(routePath, "/admin") ||
		hasExactOrChildPath(routePath, "/login") ||
		hasExactOrChildPath(routePath, "/admin-static") ||
		hasExactOrChildPath(routePath, "/admin-assets") ||
		strings.HasPrefix(routePath, "/_next/")
}

func hasFileExtension(urlPath string) bool {
	return path.Ext(urlPath) != ""
}

// isImmutableAsset returns true for extensions that use content-hashed filenames
// and can be cached indefinitely.
func isImmutableAsset(ext string) bool {
	switch ext {
	case ".js", ".css", ".woff", ".woff2", ".ttf", ".eot", ".otf":
		return true
	}
	return false
}

func resolveStaticFilePath(urlPath string) (string, bool) {
	staticDir := GetStaticDirPath()
	normalizedPath := normalizeURLPath(urlPath)
	targetPath := filepath.Join(staticDir, filepath.FromSlash(normalizedPath))
	if !isPathInsideBase(staticDir, targetPath) {
		return "", false
	}
	return targetPath, true
}

func normalizeURLPath(urlPath string) string {
	cleanPath := path.Clean("/" + urlPath)
	cleanPath = strings.TrimPrefix(cleanPath, "/")
	if cleanPath == "." {
		return ""
	}
	return cleanPath
}

func isPathInsideBase(basePath, targetPath string) bool {
	baseAbsPath, err := filepath.Abs(basePath)
	if err != nil {
		return false
	}
	targetAbsPath, err := filepath.Abs(targetPath)
	if err != nil {
		return false
	}
	relativePath, err := filepath.Rel(baseAbsPath, targetAbsPath)
	if err != nil {
		return false
	}
	return relativePath == "." ||
		(relativePath != ".." && !strings.HasPrefix(relativePath, ".."+string(os.PathSeparator)))
}

func hasExactOrChildPath(routePath, basePath string) bool {
	return routePath == basePath || strings.HasPrefix(routePath, basePath+"/")
}

func isExistingDir(dirPath string) bool {
	info, err := os.Stat(dirPath)
	return err == nil && info.IsDir()
}
