/*
 * @Description: 使用 ffmpeg 命令行工具从视频文件中截取帧作为缩略图的生成器。
 * @Author: 安知鱼
 * @Date: 2025-07-18 19:15:00 // (示例修改时间)
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

// FfmpegCliGenerator 通过调用 ffmpeg 命令行工具来生成视频缩略图。
type FfmpegCliGenerator struct {
	ffmpegPath    string
	isAvailable   bool
	cachePath     string
	supportedExts []string
	maxSize       int64
	captureTime   string
}

// NewFfmpegCliGenerator 构造函数，自动发现 ffmpeg 命令。
func NewFfmpegCliGenerator(cachePath, userConfiguredPath string, exts []string, maxSize int64, captureTime string) Generator {
	var (
		foundPath string
		err       error
		available bool
	)

	if userConfiguredPath != "" && userConfiguredPath != "ffmpeg" {
		if _, statErr := os.Stat(userConfiguredPath); statErr == nil {
			foundPath = userConfiguredPath
		} else {
			log.Printf("[FfmpegCliGenerator] 警告: 用户配置的 FFmpeg 路径 '%s' 无效，将尝试自动搜索。", userConfiguredPath)
		}
	}

	if foundPath == "" {
		foundPath, err = exec.LookPath("ffmpeg")
		if err != nil {
			log.Println("[FfmpegCliGenerator] 未在系统中找到 'ffmpeg' 命令，FFmpeg 生成器将被禁用。")
			available = false
		}
	}

	if foundPath != "" {
		available = true
		log.Printf("[FfmpegCliGenerator] 成功找到 FFmpeg 命令位于 '%s'，生成器已启用。", foundPath)
	}

	return &FfmpegCliGenerator{
		ffmpegPath:    foundPath,
		isAvailable:   available,
		cachePath:     cachePath,
		supportedExts: exts,
		maxSize:       maxSize,
		captureTime:   captureTime,
	}
}

// CanHandle 检查 ffmpeg 是否可用，以及文件类型和大小是否符合配置。
func (g *FfmpegCliGenerator) CanHandle(ctx context.Context, file *model.File) bool {
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

// Generate 使用 ffmpeg 从视频中截取一帧作为缩略图，并保存到可预测的缓存路径。
func (g *FfmpegCliGenerator) Generate(
	ctx context.Context,
	file *model.File,
	sourcePath string,
	ownerPublicID string,
	filePublicID string,
	virtualParentPath string,
) (*Result, error) {

	// 1. 定义生成参数
	const targetHeight = "400"

	// 2. 构建并执行命令
	// -ss [capture_time]: 跳转到指定时间点
	// -i [input_file]: 输入文件
	// -vframes 1: 只输出一帧
	// -vf "scale=-1:[height]": 视频滤镜，将高度缩放到指定值，宽度按比例自动调整
	// -f mjpeg: 输出为mjpeg格式（单个jpeg帧）
	// -: 输出到 stdout (标准输出)
	safeSourcePath := sourcePath
	if strings.HasPrefix(safeSourcePath, "-") {
		safeSourcePath = "./" + safeSourcePath
	}

	cmd := exec.CommandContext(ctx, g.ffmpegPath,
		"-ss", g.captureTime,
		"-i", safeSourcePath,
		"-vframes", "1",
		"-vf", fmt.Sprintf("scale=-1:%s", targetHeight),
		"-f", "mjpeg",
		"--", "-",
	)

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	if err := cmd.Run(); err != nil {
		log.Printf("[FfmpegCliGenerator] ffmpeg 命令执行失败。错误: %v, Stderr: %s", err, errBuf.String())
		return nil, fmt.Errorf("调用 ffmpeg 命令失败: %w, 错误输出: %s", err, errBuf.String())
	}

	if outBuf.Len() == 0 {
		log.Printf("[FfmpegCliGenerator] ffmpeg 命令执行成功，但没有输出图像数据. Stderr: %s", errBuf.String())
		return nil, fmt.Errorf("ffmpeg 未生成图像数据, 错误输出: %s", errBuf.String())
	}

	// 3. 使用所有ID和路径信息构建正确的缓存路径
	cacheFileName := GenerateCacheName(ownerPublicID, filePublicID, "jpeg")
	cacheFullPath, err := GetCachePath(g.cachePath, virtualParentPath, cacheFileName)
	if err != nil {
		return nil, fmt.Errorf("为 Ffmpeg 生成器构建缓存路径失败: %w", err)
	}

	// 4. 将从 stdout 获取的图像数据写入文件
	if err := os.WriteFile(cacheFullPath, outBuf.Bytes(), 0644); err != nil {
		return nil, fmt.Errorf("无法写入缩略图缓存文件: %w", err)
	}

	// 5. 成功后，返回自己的名称和非直接服务标志
	return &Result{
		GeneratorName: "ffmpeg",
		IsDirectServe: false,
		Format:        "jpeg",
	}, nil
}
