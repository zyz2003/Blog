package version

import (
	"fmt"
	"runtime"
	"runtime/debug"
	"strings"
	"time"
)

// 这些变量将在构建时通过 ldflags 注入
var (
	Version   = "dev"             // 版本号，如 v1.0.0
	Commit    = "unknown"         // Git commit hash
	Date      = "unknown"         // 构建时间
	GoVersion = runtime.Version() // Go 版本
)

const CommunityModulePath = "github.com/anzhiyu-c/anheyu-app"
const ProModulePath = "github.com/anzhiyu-c/anheyu-pro-backend"

// GetVersion 返回应用版本号
func GetVersion() string {
	// 如果通过 ldflags 注入了版本信息，则使用注入的版本
	if Version != "dev" && Version != "" {
		return Version
	}

	// 回退到从构建信息获取版本
	buildInfo, ok := debug.ReadBuildInfo()
	if !ok {
		return "unknown (no build info)"
	}

	if buildInfo.Path == ProModulePath {
		for _, dep := range buildInfo.Deps {
			// 找到社区版核心依赖
			if dep.Path == CommunityModulePath {
				return dep.Version
			}
		}
		return "pro (community core not found)"
	} else {
		if buildInfo.Main.Version != "" && buildInfo.Main.Version != "(devel)" {
			return buildInfo.Main.Version
		}
		return "dev"
	}
}

// GetBuildInfo 返回详细的构建信息
func GetBuildInfo() BuildInfo {
	return BuildInfo{
		Version:   GetVersion(),
		Commit:    GetCommit(),
		Date:      GetBuildDate(),
		GoVersion: GoVersion,
	}
}

// GetCommit 返回 Git commit hash
func GetCommit() string {
	if Commit != "unknown" && Commit != "" {
		return Commit
	}

	// 尝试从构建信息获取
	buildInfo, ok := debug.ReadBuildInfo()
	if !ok {
		return "unknown"
	}

	for _, setting := range buildInfo.Settings {
		if setting.Key == "vcs.revision" {
			if len(setting.Value) > 7 {
				return setting.Value[:7] // 返回短 commit hash
			}
			return setting.Value
		}
	}

	return "unknown"
}

// GetBuildDate 返回构建时间
func GetBuildDate() string {
	if Date != "unknown" && Date != "" {
		return Date
	}

	// 尝试从构建信息获取
	buildInfo, ok := debug.ReadBuildInfo()
	if !ok {
		return "unknown"
	}

	for _, setting := range buildInfo.Settings {
		if setting.Key == "vcs.time" {
			if t, err := time.Parse(time.RFC3339, setting.Value); err == nil {
				return t.Format("2006-01-02 15:04:05")
			}
			return setting.Value
		}
	}

	return "unknown"
}

// GetVersionString 返回完整的版本字符串
func GetVersionString() string {
	version := GetVersion()
	commit := GetCommit()
	date := GetBuildDate()

	var parts []string
	parts = append(parts, version)

	if commit != "unknown" {
		parts = append(parts, fmt.Sprintf("commit %s", commit))
	}

	if date != "unknown" {
		parts = append(parts, fmt.Sprintf("built at %s", date))
	}

	return strings.Join(parts, ", ")
}

// BuildInfo 包含构建信息
type BuildInfo struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	Date      string `json:"date"`
	GoVersion string `json:"go_version"`
}
