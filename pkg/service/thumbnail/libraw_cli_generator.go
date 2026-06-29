/*
 * @Description: 使用 LibRaw/DCRaw 命令行工具处理 RAW 图像格式的缩略图生成器。
 * @Author: 安知鱼
 * @Date: 2025-07-30 11:50:00
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

// LibrawCliGenerator 通过调用 dcraw 命令行工具来为 RAW 图片生成预览。
type LibrawCliGenerator struct {
	dcrawPath     string
	isAvailable   bool
	cachePath     string
	supportedExts []string
	maxSize       int64
}

// NewLibrawCliGenerator 是 LibrawCliGenerator 的构造函数，它会自动发现 dcraw 相关的命令。
func NewLibrawCliGenerator(cachePath, userConfiguredPath string, exts []string, maxSize int64) Generator {
	var (
		foundPath string
		err       error
		available bool
	)

	// 优先使用用户在后台配置的路径
	if userConfiguredPath != "" {
		// 检查是否是绝对路径
		if strings.HasPrefix(userConfiguredPath, "/") {
			// 绝对路径，使用 os.Stat 检查
			if _, statErr := os.Stat(userConfiguredPath); statErr == nil {
				foundPath = userConfiguredPath
			} else {
				log.Printf("[LibrawCliGenerator] 警告: 用户配置的 LibRaw/DCRaw 路径 '%s' 无效，将尝试自动搜索。", userConfiguredPath)
			}
		} else {
			// 命令名，使用 exec.LookPath 检查
			if cmdPath, lookErr := exec.LookPath(userConfiguredPath); lookErr == nil {
				foundPath = cmdPath
				log.Printf("[LibrawCliGenerator] 成功找到用户配置的 LibRaw/DCRaw 命令位于 '%s'。", foundPath)
			} else {
				log.Printf("[LibrawCliGenerator] 警告: 用户配置的 LibRaw/DCRaw 命令 '%s' 无效，将尝试自动搜索。", userConfiguredPath)
			}
		}
	}

	// 如果没有配置或配置无效，则在系统中搜索
	if foundPath == "" {
		foundPath, err = exec.LookPath("simple_dcraw") // 默认尝试寻找 simple_dcraw
		if err != nil {
			// 如果找不到，再尝试寻找 dcraw
			foundPath, err = exec.LookPath("dcraw")
			if err != nil {
				log.Println("[LibrawCliGenerator] 未在系统中找到 'simple_dcraw' 或 'dcraw' 命令，该生成器将被禁用。")
				available = false
			}
		}
	}

	if foundPath != "" {
		available = true
		log.Printf("[LibrawCliGenerator] 成功找到 LibRaw/DCRaw 命令位于 '%s'，生成器已启用。", foundPath)
	}

	return &LibrawCliGenerator{
		dcrawPath:     foundPath,
		isAvailable:   available,
		cachePath:     cachePath,
		supportedExts: exts,
		maxSize:       maxSize,
	}
}

// CanHandle 检查 LibRaw/DCRaw 是否可用，以及文件类型和大小是否符合配置。
func (g *LibrawCliGenerator) CanHandle(ctx context.Context, file *model.File) bool {
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

// Generate 使用 dcraw 从 RAW 文件中提取图像数据作为缩略图。
func (g *LibrawCliGenerator) Generate(
	ctx context.Context,
	file *model.File,
	sourcePath string,
	ownerPublicID string,
	filePublicID string,
	virtualParentPath string,
) (*Result, error) {

	// 使用 dcraw 的 -c 参数将解码后的图像数据输出到标准输出(stdout)。
	// -w 参数使用相机内置的白平衡设置。
	// 这通常会生成一个 PPM 或 TIFF 格式的位图数据流。
	// 为了简单起见，直接将这个数据流保存为 .ppm 文件。
	// 在更高级的实现中，可以将其通过管道传递给 vips 或 imagemagick 转换为网页更友好的格式。
	safeSourcePath := sourcePath
	if strings.HasPrefix(safeSourcePath, "-") {
		safeSourcePath = "./" + safeSourcePath
	}

	cmd := exec.CommandContext(ctx, g.dcrawPath, "-c", "-w", "--", safeSourcePath)

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	if err := cmd.Run(); err != nil {
		log.Printf("[LibrawCliGenerator] dcraw 命令执行失败。错误: %v, Stderr: %s", err, errBuf.String())
		return nil, fmt.Errorf("调用 dcraw 命令失败: %w, 错误输出: %s", err, errBuf.String())
	}

	if outBuf.Len() == 0 {
		log.Printf("[LibrawCliGenerator] dcraw 命令执行成功，但没有输出图像数据. Stderr: %s", errBuf.String())
		return nil, fmt.Errorf("dcraw 未生成图像数据, 错误输出: %s", errBuf.String())
	}

	// 将输出保存为 .ppm 格式，这是一个可以被大多数图像库处理的简单位图格式。
	const outputFormat = "ppm"
	cacheFileName := GenerateCacheName(ownerPublicID, filePublicID, outputFormat)
	cacheFullPath, err := GetCachePath(g.cachePath, virtualParentPath, cacheFileName)
	if err != nil {
		return nil, fmt.Errorf("为 Libraw 生成器构建缓存路径失败: %w", err)
	}

	// 将从 stdout 获取的图像数据写入文件
	if err := os.WriteFile(cacheFullPath, outBuf.Bytes(), 0644); err != nil {
		return nil, fmt.Errorf("无法写入 RAW 缩略图缓存文件: %w", err)
	}

	return &Result{
		GeneratorName: "libraw",
		IsDirectServe: false,
		Format:        "." + outputFormat,
	}, nil
}
