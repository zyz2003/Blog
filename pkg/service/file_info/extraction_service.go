// internal/app/service/file_info/extraction_service.go

/*
 * @Description: 媒体信息提取服务
 * @Author: 安知鱼
 * @Date: 2025-07-11 14:15:00
 * @LastEditTime: 2025-07-29 14:48:59
 * @LastEditors: 安知鱼
 */
package file_info

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/volume"

	"github.com/dhowden/tag"
	"github.com/dsoprea/go-exif/v3"

	heicexif "github.com/dsoprea/go-heic-exif-extractor"
	jpegstructure "github.com/dsoprea/go-jpeg-image-structure"
	pngstructure "github.com/dsoprea/go-png-image-structure"
	tiffstructure "github.com/dsoprea/go-tiff-image-structure"
	riimage "github.com/dsoprea/go-utility/image"
)

type (
	exifParser interface {
		Parse(rs io.ReadSeeker, size int) (ec riimage.MediaContext, err error)
	}
)

func getExifParser(ext string) exifParser {
	switch ext {
	case ".jpg", ".jpeg":
		return jpegstructure.NewJpegMediaParser()
	case ".png":
		return pngstructure.NewPngMediaParser()
	case ".tiff":
		return tiffstructure.NewTiffMediaParser()
	case ".heic", ".heif", ".avif":
		return heicexif.NewHeicExifMediaParser()
	default:
		// 对于其他 RAW 格式，将依赖蛮力搜索
		return nil
	}
}

// ExtractionService 负责从媒体文件中提取元数据
type ExtractionService struct {
	fileRepo        repository.FileRepository
	settingSvc      setting.SettingService
	metadataService *MetadataService
	vfsSvc          volume.IVFSService
}

// NewExtractionService 构造函数
func NewExtractionService(
	fileRepo repository.FileRepository,
	settingSvc setting.SettingService,
	metadataService *MetadataService,
	vfsSvc volume.IVFSService,
) *ExtractionService {
	return &ExtractionService{
		fileRepo:        fileRepo,
		settingSvc:      settingSvc,
		metadataService: metadataService,
		vfsSvc:          vfsSvc,
	}
}

// ExtractAndSave 是此服务的主要入口点
func (s *ExtractionService) ExtractAndSave(ctx context.Context, fileID uint) error {
	file, err := s.fileRepo.FindByID(ctx, fileID)
	if err != nil {
		return fmt.Errorf("无法找到文件ID %d: %w", fileID, err)
	}
	log.Printf("[Extractor] 开始为文件 '%s' (ID: %d) 提取元数据...", file.Name, file.ID)
	s.extractExif(ctx, file)
	s.extractMusicTags(ctx, file)
	log.Printf("[Extractor] 文件 '%s' (ID: %d) 的元数据提取流程完成。", file.Name, file.ID)
	return nil
}

func (s *ExtractionService) extractExif(ctx context.Context, file *model.File) {
	if !s.settingSvc.GetBool(constant.KeyEnableExifExtractor.String()) {
		return
	}

	reader, err := s.vfsSvc.GetFileReader(ctx, file)
	if err != nil {
		log.Printf("[Extractor-Go] 错误: 获取文件 %d 的读取器失败: %v", file.ID, err)
		return
	}
	defer reader.Close()

	readSeeker, ok := reader.(io.ReadSeeker)
	if !ok {
		log.Printf("[Extractor-Go] 错误: 文件 %d 的读取器不支持 ReadSeek", file.ID)
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Name))
	parser := getExifParser(ext)
	var exifData []byte

	// 1. 尝试结构化解析
	if parser != nil {
		if res, pErr := parser.Parse(readSeeker, int(file.Size)); pErr == nil {
			_, exifData, _ = res.Exif()
		} else {
			log.Printf("[Extractor-Go] 信息: 结构化解析文件 %d 失败: %v。将尝试蛮力搜索。", file.ID, pErr)
		}
	}

	// 2. 如果失败，并且配置允许，则进行蛮力搜索
	bruteForce := s.settingSvc.GetBool(constant.KeyExifUseBruteForce.String())
	if bruteForce && len(exifData) == 0 {
		if _, seekErr := readSeeker.Seek(0, io.SeekStart); seekErr != nil {
			log.Printf("[Extractor-Go] 错误: 无法重置文件 %d 的读取位置以进行蛮力搜索: %v", file.ID, seekErr)
			return
		}
		exifData, err = exif.SearchAndExtractExifWithReader(readSeeker)
		if err != nil && !errors.Is(err, exif.ErrNoExif) {
			log.Printf("[Extractor-Go] 警告: 为文件 %d 进行蛮力搜索时出错: %v", file.ID, err)
		}
	}

	if len(exifData) == 0 {
		log.Printf("[Extractor-Go] 信息: 在文件 %d 中未找到EXIF数据。", file.ID)
		return
	}

	// 3. 解析提取到的 EXIF 数据块
	entries, _, err := exif.GetFlatExifData(exifData, nil)
	if err != nil {
		log.Printf("[Extractor-Go] 错误: 解析文件 %d 的EXIF条目失败: %v", file.ID, err)
		return
	}

	rawExifMap := make(map[string]string)
	for _, tag := range entries {
		if tag.TagName != "" {
			// 清理空字符
			cleanedValue := strings.ReplaceAll(tag.FormattedFirst, "\x00", "")
			if cleanedValue != "" {
				rawExifMap[tag.TagName] = cleanedValue
			}
		}
	}

	if len(rawExifMap) > 0 {
		mappedData := s.mapExifData(rawExifMap)
		s.saveMetadataFromMap(ctx, file.ID, mappedData)
		log.Printf("[Extractor-Go] 成功为文件 %d 提取并保存 %d 条EXIF信息。", file.ID, len(mappedData))
	}
}

func (s *ExtractionService) mapExifData(exifMap map[string]string) map[string]string {
	metasToSave := make(map[string]string)
	if v, ok := exifMap["Make"]; ok {
		metasToSave[model.MetaKeyExifMake] = v
	}
	if v, ok := exifMap["Model"]; ok {
		metasToSave[model.MetaKeyExifModel] = v
	}
	if v, ok := exifMap["Software"]; ok {
		metasToSave[model.MetaKeyExifSoftware] = v
	}
	if v, ok := exifMap["ExposureTime"]; ok {
		metasToSave[model.MetaKeyExifExposureTime] = v
	}
	if v, ok := exifMap["ISOSpeedRatings"]; ok {
		metasToSave[model.MetaKeyExifISOSpeed] = v
	}
	for _, tagName := range []string{"DateTimeOriginal", "CreateDate", "DateTime"} {
		if value, ok := exifMap[tagName]; ok {
			if t, err := time.Parse("2006:01:02 15:04:05", value); err == nil {
				metasToSave[model.MetaKeyExifDateTime] = t.Format(time.RFC3339)
				break
			}
		}
	}
	if v, ok := exifMap["FNumber"]; ok {
		if f, err := parseRational(v); err == nil {
			metasToSave[model.MetaKeyExifFNumber] = fmt.Sprintf("%.1f", f)
		}
	}
	if v, ok := exifMap["FocalLength"]; ok {
		if f, err := parseRational(v); err == nil {
			metasToSave[model.MetaKeyExifFocalLength] = fmt.Sprintf("%d", int(f))
		}
	}
	return metasToSave
}

func parseRational(s string) (float64, error) {
	parts := strings.Split(s, "/")
	if len(parts) != 2 {
		return 0, errors.New("invalid rational format")
	}
	num, err1 := strconv.ParseFloat(parts[0], 64)
	den, err2 := strconv.ParseFloat(parts[1], 64)
	if err1 != nil || err2 != nil || den == 0 {
		return 0, errors.New("invalid rational components")
	}
	return num / den, nil
}

func (s *ExtractionService) saveMetadataFromMap(_ctx context.Context, fileID uint, data map[string]string) {
	for key, value := range data {
		if value != "" && value != "0" {
			go func(k, v string) {
				if err := s.metadataService.Set(context.Background(), fileID, k, v); err != nil {
					log.Printf("[Extractor] 错误: 保存元数据 (FileID: %d, Key: %s) 失败: %v", fileID, k, err)
				}
			}(key, value)
		}
	}
}

func (s *ExtractionService) extractMusicTags(ctx context.Context, file *model.File) {
	if !s.settingSvc.GetBool(constant.KeyEnableMusicExtractor.String()) {
		return
	}
	ext := strings.ToLower(filepath.Ext(file.Name))
	supportedExts := map[string]bool{".mp3": true, ".m4a": true, ".flac": true, ".ogg": true}
	if !supportedExts[ext] {
		return
	}
	reader, err := s.vfsSvc.GetFileReader(ctx, file)
	if err != nil {
		log.Printf("[Extractor-Music] 错误: 获取文件 %d 的读取器失败: %v", file.ID, err)
		return
	}
	defer reader.Close()
	readSeeker, ok := reader.(io.ReadSeeker)
	if !ok {
		log.Printf("[Extractor-Music] 错误: 文件 %d 的读取器不支持 ReadSeek", file.ID)
		return
	}
	m, err := tag.ReadFrom(readSeeker)
	if err != nil {
		return
	}
	musicData := map[string]string{model.MetaKeyMusicFormat: string(m.FileType()), model.MetaKeyMusicTitle: m.Title(), model.MetaKeyMusicAlbum: m.Album(), model.MetaKeyMusicArtist: m.Artist(), model.MetaKeyMusicAlbumArtist: m.AlbumArtist(), model.MetaKeyMusicComposer: m.Composer(), model.MetaKeyMusicGenre: m.Genre(), model.MetaKeyMusicYear: strconv.Itoa(m.Year())}
	s.saveMetadataFromMap(ctx, file.ID, musicData)
	log.Printf("[Extractor-Music] 成功为文件 %d 提取并保存 %d 条音乐信息。", file.ID, len(musicData))
}
