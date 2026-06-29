/*
 * @Description: 使用 vips 命令行工具进行高性能图片和文档缩略图生成的生成器。
 * @Author: 安知鱼
 * @Date: 2025-07-18 19:50:00
 * @LastEditTime: 2025-08-06 10:13:24
 * @LastEditors: 安知鱼
 */
package thumbnail

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// VipsCliGenerator 通过调用 vips 命令行工具来生成缩略图。
type VipsCliGenerator struct {
	vipsPath      string
	isAvailable   bool
	cachePath     string
	supportedExts []string
	maxSize       int64
}

// NewVipsCliGenerator 构造函数，自动发现 vips 命令。
func NewVipsCliGenerator(cachePath, userConfiguredPath string, exts []string, maxSize int64) Generator {
	// ... 这部分代码无需修改 ...
	var (
		foundPath string
		err       error
		available bool
	)

	if userConfiguredPath != "" && userConfiguredPath != "vips" {
		if _, statErr := os.Stat(userConfiguredPath); statErr == nil {
			foundPath = userConfiguredPath
		} else {
			log.Printf("[VipsCliGenerator] 警告: 用户配置的 VIPS 路径 '%s' 无效，将尝试自动搜索。", userConfiguredPath)
		}
	}

	if foundPath == "" {
		foundPath, err = exec.LookPath("vips")
		if err != nil {
			log.Println("[VipsCliGenerator] 未在系统中找到 'vips' 命令，VIPS 生成器将被禁用。")
			available = false
		}
	}

	if foundPath != "" {
		available = true
		log.Printf("[VipsCliGenerator] 成功找到 VIPS 命令位于 '%s'，生成器已启用。", foundPath)
	}

	return &VipsCliGenerator{
		vipsPath:      foundPath,
		isAvailable:   available,
		cachePath:     cachePath,
		supportedExts: exts,
		maxSize:       maxSize,
	}
}

// CanHandle 检查 vips 是否可用，以及文件类型和大小是否符合配置。
func (g *VipsCliGenerator) CanHandle(ctx context.Context, file *model.File) bool {
	// ... 这部分代码无需修改 ...
	if !g.isAvailable {
		return false
	}

	if g.maxSize > 0 && file.Size > g.maxSize {
		return false
	}

	ext := strings.ToLower(filepath.Ext(file.Name))
	for _, supportedExt := range g.supportedExts {
		if "."+supportedExt == ext {
			return true
		}
	}
	return false
}

// Generate 使用 vips 命令行工具生成缩略图，并对特殊文件类型进行优化。
func (g *VipsCliGenerator) Generate(
	ctx context.Context,
	file *model.File,
	sourcePath string,
	ownerPublicID string,
	filePublicID string,
	virtualParentPath string,
) (*Result, error) {
	sourceFile, err := os.Open(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("无法打开源文件: %w", err)
	}
	defer sourceFile.Close()

	const (
		targetHeight       = "400"
		unconstrainedWidth = "10000"
		outputExt          = ".webp"
		outputFormat       = ".webp[Q=75,strip]"
	)

	inputOptions := "[descriptor=0]"
	fileExt := strings.ToLower(filepath.Ext(file.Name))
	switch fileExt {
	case ".pdf", ".svg", ".svgz", ".ai", ".eps":
		inputOptions = "[descriptor=0,dpi=150]"
	}

	cmd := exec.CommandContext(ctx, g.vipsPath, "thumbnail_source", inputOptions, outputFormat, unconstrainedWidth, "--height", targetHeight)

	var outBuf, errBuf bytes.Buffer
	cmd.Stdin = sourceFile
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	if err := cmd.Run(); err != nil {
		log.Printf("[VipsCliGenerator] vips 命令执行失败。错误: %v, Stderr: %s", err, errBuf.String())
		return nil, fmt.Errorf("调用 vips 命令失败: %w, 错误输出: %s", err, errBuf.String())
	}

	cacheFileName := GenerateCacheName(ownerPublicID, filePublicID, outputExt)
	cacheFullPath, err := GetCachePath(g.cachePath, virtualParentPath, cacheFileName)
	if err != nil {
		return nil, fmt.Errorf("为 Vips 生成器构建缓存路径失败: %w", err)
	}

	if err := os.WriteFile(cacheFullPath, outBuf.Bytes(), 0644); err != nil {
		return nil, fmt.Errorf("无法写入缩略图缓存文件: %w", err)
	}

	return &Result{
		GeneratorName: "vips",
		IsDirectServe: false,
		Format:        outputExt,
	}, nil
}
