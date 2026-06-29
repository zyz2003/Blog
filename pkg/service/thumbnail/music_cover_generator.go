/*
 * @Description: 从音频文件中提取专辑封面作为缩略图的生成器。
 * @Author: 安知鱼
 * @Date: 2025-07-11 13:30:13
 * @LastEditTime: 2025-07-30 20:39:34
 * @LastEditors: 安知鱼
 */
package thumbnail

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"

	"github.com/dhowden/tag"
	"github.com/disintegration/imaging"
)

// MusicCoverGenerator 从音频文件中提取专辑封面。
type MusicCoverGenerator struct {
	cachePath     string
	supportedExts []string
	maxSize       int64
}

// NewMusicCoverGenerator 是 MusicCoverGenerator 的构造函数。
func NewMusicCoverGenerator(cachePath string, exts []string, maxSize int64) Generator {
	log.Println("[MusicCoverGenerator] 音频封面提取生成器已启用。")
	return &MusicCoverGenerator{
		cachePath:     cachePath,
		supportedExts: exts,
		maxSize:       maxSize,
	}
}

// CanHandle 检查文件是否为支持的音频格式。
func (g *MusicCoverGenerator) CanHandle(ctx context.Context, file *model.File) bool {
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

// Generate 提取封面，生成缩略图，并将其保存到由所有者和文件ID共同决定的、可预测的缓存路径。
func (g *MusicCoverGenerator) Generate(
	ctx context.Context,
	fileModel *model.File,
	sourcePath string,
	ownerPublicID string,
	filePublicID string,
	virtualParentPath string,
) (*Result, error) {
	file, err := os.Open(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("无法打开音频文件: %w", err)
	}
	defer file.Close()

	// 1. 使用 tag 库读取元数据
	meta, err := tag.ReadFrom(file)
	if err != nil {
		if err == tag.ErrNoTagsFound {
			return nil, fmt.Errorf("文件中未找到元数据标签")
		}
		return nil, fmt.Errorf("读取音频元数据失败: %w", err)
	}

	// 2. 提取封面图片
	pic := meta.Picture()
	if pic == nil {
		return nil, fmt.Errorf("音频文件中不包含封面图片")
	}

	// 3. 使用 imaging 库处理提取出的图片数据
	imgReader := bytes.NewReader(pic.Data)
	srcImage, err := imaging.Decode(imgReader)
	if err != nil {
		return nil, fmt.Errorf("解码内嵌的封面图片数据失败: %w", err)
	}

	thumbnail := imaging.Resize(srcImage, 400, 0, imaging.Lanczos)

	// 4. 使用所有ID和路径信息构建正确的缓存路径
	cacheFileName := GenerateCacheName(ownerPublicID, filePublicID, "jpeg")
	cacheFullPath, err := GetCachePath(g.cachePath, virtualParentPath, cacheFileName)
	if err != nil {
		return nil, fmt.Errorf("为音乐封面生成器构建缓存路径失败: %w", err)
	}

	// 5. 将生成的缩略图保存为 JPEG 格式
	err = imaging.Save(thumbnail, cacheFullPath, imaging.JPEGQuality(80))
	if err != nil {
		return nil, fmt.Errorf("保存封面缩略图失败: %w", err)
	}

	// 6. 成功后，返回自己的名称和非直接服务标志
	return &Result{
		GeneratorName: "music_cover",
		IsDirectServe: false,
		Format:        "jpeg",
	}, nil
}
