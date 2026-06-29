package album

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
	_ "golang.org/x/image/webp"
)

// CreateAlbumParams 定义了创建相册时需要的参数
type CreateAlbumParams struct {
	CategoryID   *uint
	ImageUrl     string
	BigImageUrl  string
	DownloadUrl  string
	ThumbParam   string
	BigParam     string
	Tags         []string
	Width        int
	Height       int
	FileSize     int64
	Format       string
	FileHash     string
	DisplayOrder int
	Title        string
	Description  string
	Location     string
	CreatedAt    *time.Time
	PublishedAt  *time.Time
}

// UpdateAlbumParams 定义了更新相册时需要的参数
type UpdateAlbumParams struct {
	CategoryID   *uint
	ImageUrl     string
	BigImageUrl  string
	DownloadUrl  string
	ThumbParam   string
	BigParam     string
	Tags         []string
	DisplayOrder *int
	Title        string
	Description  string
	Location     string
	PublishedAt  *time.Time
}

// FindAlbumsParams 定义了查询相册时需要的参数
type FindAlbumsParams struct {
	Page       int
	PageSize   int
	CategoryID *uint
	Tag        string
	Start      *time.Time
	End        *time.Time
	Sort       string
}

// BatchImportResult 批量导入的结果
type BatchImportResult struct {
	SuccessCount int
	FailCount    int
	SkipCount    int
	Errors       []BatchImportError
	Duplicates   []string
}

// BatchImportError 批量导入的错误信息
type BatchImportError struct {
	URL    string
	Reason string
}

// BatchImportParams 批量导入的参数
type BatchImportParams struct {
	CategoryID   *uint
	URLs         []string
	ThumbParam   string
	BigParam     string
	Tags         []string
	DisplayOrder int
}

// ExportAlbumData 定义导出的相册数据结构
type ExportAlbumData struct {
	Version  string                 `json:"version"`   // 导出格式版本
	ExportAt time.Time              `json:"export_at"` // 导出时间
	Albums   []ExportAlbumItem      `json:"albums"`    // 相册列表
	Meta     map[string]interface{} `json:"meta"`      // 元数据信息
}

// ExportAlbumItem 单个相册的导出数据
type ExportAlbumItem struct {
	CategoryID   *uint      `json:"category_id"`
	ImageUrl     string     `json:"image_url"`
	BigImageUrl  string     `json:"big_image_url"`
	DownloadUrl  string     `json:"download_url"`
	ThumbParam   string     `json:"thumb_param"`
	BigParam     string     `json:"big_param"`
	Tags         string     `json:"tags"`
	Width        int        `json:"width"`
	Height       int        `json:"height"`
	FileSize     int64      `json:"file_size"`
	Format       string     `json:"format"`
	AspectRatio  string     `json:"aspect_ratio"`
	FileHash     string     `json:"file_hash"`
	DisplayOrder int        `json:"display_order"`
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	Location     string     `json:"location"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	PublishedAt  *time.Time `json:"published_at"`
}

// ImportAlbumRequest 导入相册的请求
type ImportAlbumRequest struct {
	Data              ExportAlbumData `json:"data"`                // 导入的数据
	OverwriteExisting bool            `json:"overwrite_existing"`  // 是否覆盖已存在的相册
	SkipExisting      bool            `json:"skip_existing"`       // 是否跳过已存在的相册
	DefaultCategoryID *uint           `json:"default_category_id"` // 默认分类ID（如果数据中没有指定）
}

// ImportAlbumResult 导入结果
type ImportAlbumResult struct {
	TotalCount   int      `json:"total_count"`   // 总数
	SuccessCount int      `json:"success_count"` // 成功数
	SkippedCount int      `json:"skipped_count"` // 跳过数
	FailedCount  int      `json:"failed_count"`  // 失败数
	Errors       []string `json:"errors"`        // 错误信息列表
	CreatedIDs   []uint   `json:"created_ids"`   // 创建的相册ID列表
}

// AlbumService 定义了相册相关的业务逻辑接口
type AlbumService interface {
	CreateAlbum(ctx context.Context, params CreateAlbumParams) (*model.Album, error)
	BatchImportAlbums(ctx context.Context, params BatchImportParams) (*BatchImportResult, error)
	DeleteAlbum(ctx context.Context, id uint) error
	BatchDeleteAlbums(ctx context.Context, ids []uint) (int, error)
	UpdateAlbum(ctx context.Context, id uint, params UpdateAlbumParams) (*model.Album, error)
	FindAlbums(ctx context.Context, params FindAlbumsParams) (*repository.PageResult[model.Album], error)
	IncrementAlbumStat(ctx context.Context, id uint, statType string) error
	ExportAlbums(ctx context.Context, albumIDs []uint) (*ExportAlbumData, error)
	ExportAlbumsToZip(ctx context.Context, albumIDs []uint) ([]byte, error)
	ImportAlbums(ctx context.Context, req *ImportAlbumRequest) (*ImportAlbumResult, error)
	ImportAlbumsFromJSON(ctx context.Context, jsonData []byte, req *ImportAlbumRequest) (*ImportAlbumResult, error)
	ImportAlbumsFromZip(ctx context.Context, zipData []byte, req *ImportAlbumRequest) (*ImportAlbumResult, error)
}

// albumService 是 AlbumService 接口的实现
type albumService struct {
	albumRepo         repository.AlbumRepository
	tagRepo           repository.TagRepository
	albumCategoryRepo repository.AlbumCategoryRepository
	settingSvc        setting.SettingService
}

// NewAlbumService 是 albumService 的构造函数
func NewAlbumService(
	albumRepo repository.AlbumRepository,
	tagRepo repository.TagRepository,
	albumCategoryRepo repository.AlbumCategoryRepository,
	settingSvc setting.SettingService,
) AlbumService {
	return &albumService{
		albumRepo:         albumRepo,
		tagRepo:           tagRepo,
		albumCategoryRepo: albumCategoryRepo,
		settingSvc:        settingSvc,
	}
}

// effectiveAlbumFileHash 与 CreateAlbum 入库逻辑一致：优先非空 file_hash；否则对 image_url 做 SHA256。
// ImportAlbums 的 skip_existing 必须使用同一规则，否则库中旧数据 file_hash 为空时会与 Hexo 等导入 JSON 再次撞成重复。
func effectiveAlbumFileHash(fileHash, imageURL string) string {
	h := strings.TrimSpace(fileHash)
	if h != "" {
		return h
	}
	url := strings.TrimSpace(imageURL)
	if url == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(url))
	return hex.EncodeToString(sum[:])
}

// CreateAlbum 实现了创建相册的业务逻辑
func (s *albumService) CreateAlbum(ctx context.Context, params CreateAlbumParams) (*model.Album, error) {
	fileHash := effectiveAlbumFileHash(params.FileHash, params.ImageUrl)

	album := &model.Album{
		CategoryID:   params.CategoryID,
		ImageUrl:     params.ImageUrl,
		BigImageUrl:  params.BigImageUrl,
		DownloadUrl:  params.DownloadUrl,
		ThumbParam:   params.ThumbParam,
		BigParam:     params.BigParam,
		Tags:         strings.Join(params.Tags, ","),
		Width:        params.Width,
		Height:       params.Height,
		FileSize:     params.FileSize,
		Format:       params.Format,
		FileHash:     fileHash,
		AspectRatio:  getSimplifiedAspectRatioString(params.Width, params.Height),
		DisplayOrder: params.DisplayOrder,
		Title:        params.Title,
		Description:  params.Description,
		Location:     params.Location,
		PublishedAt:  params.PublishedAt,
	}

	// 如果提供了自定义的创建时间，则使用它
	if params.CreatedAt != nil {
		album.CreatedAt = *params.CreatedAt
	}

	// 在存入数据库前，应用默认值
	s.applyDefaultAlbumParams(album)

	finalAlbum, status, err := s.albumRepo.CreateOrRestore(ctx, album)
	if err != nil {
		return nil, fmt.Errorf("处理相册时发生数据库错误: %w", err)
	}

	// 根据返回的状态处理业务逻辑
	switch status {
	case repository.StatusCreated:
		fmt.Printf("新图片已创建，ID: %d\n", finalAlbum.ID)
		if len(params.Tags) > 0 {
			if _, err := s.tagRepo.FindOrCreate(ctx, params.Tags); err != nil {
				fmt.Printf("处理新图片标签时发生错误: %v\n", err)
			}
		}
	case repository.StatusRestored:
		fmt.Printf("已恢复并更新了被删除的图片，ID: %d\n", finalAlbum.ID)
		if len(params.Tags) > 0 {
			if _, err := s.tagRepo.FindOrCreate(ctx, params.Tags); err != nil {
				fmt.Printf("处理已恢复图片标签时发生错误: %v\n", err)
			}
		}
	case repository.StatusExisted:
		return nil, fmt.Errorf("这张图片已存在，id是%d，请勿重复添加", finalAlbum.ID)
	default:
		return nil, fmt.Errorf("处理相册时发生未知状态")
	}

	// 在返回最终结果前，再次应用默认值，确保返回给上层的数据是完整的
	s.applyDefaultAlbumParams(finalAlbum)
	return finalAlbum, nil
}

// DeleteAlbum 实现了删除相册的业务逻辑
func (s *albumService) DeleteAlbum(ctx context.Context, id uint) error {
	return s.albumRepo.Delete(ctx, id)
}

// BatchDeleteAlbums 实现了批量删除相册的业务逻辑
func (s *albumService) BatchDeleteAlbums(ctx context.Context, ids []uint) (int, error) {
	if len(ids) == 0 {
		return 0, fmt.Errorf("没有指定要删除的相册ID")
	}
	return s.albumRepo.BatchDelete(ctx, ids)
}

// UpdateAlbum 实现了更新相册的业务逻辑
func (s *albumService) UpdateAlbum(ctx context.Context, id uint, params UpdateAlbumParams) (*model.Album, error) {
	album, err := s.albumRepo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("查找待更新相册失败: %w", err)
	}
	if album == nil {
		return nil, fmt.Errorf("ID为 %d 的相册不存在", id)
	}

	// 更新字段
	album.CategoryID = params.CategoryID
	album.ImageUrl = params.ImageUrl
	album.BigImageUrl = params.BigImageUrl
	album.DownloadUrl = params.DownloadUrl
	album.ThumbParam = params.ThumbParam
	album.BigParam = params.BigParam
	album.Tags = strings.Join(params.Tags, ",")
	album.Title = params.Title
	album.Description = params.Description
	album.Location = params.Location
	album.PublishedAt = params.PublishedAt

	if params.DisplayOrder != nil {
		album.DisplayOrder = *params.DisplayOrder
	}

	if err := s.albumRepo.Update(ctx, album); err != nil {
		return nil, fmt.Errorf("更新相册失败: %w", err)
	}

	// 在返回更新后的 album 对象前，应用默认值，确保数据一致性
	s.applyDefaultAlbumParams(album)
	return album, nil
}

// FindAlbums 实现了查找相册的业务逻辑
func (s *albumService) FindAlbums(ctx context.Context, params FindAlbumsParams) (*repository.PageResult[model.Album], error) {
	opts := repository.AlbumQueryOptions{
		PageQuery: repository.PageQuery{
			Page:     params.Page,
			PageSize: params.PageSize,
		},
		CategoryID: params.CategoryID,
		Tag:        params.Tag,
		Start:      params.Start,
		End:        params.End,
		Sort:       params.Sort,
	}

	pageResult, err := s.albumRepo.FindListByOptions(ctx, opts)
	if err != nil {
		return nil, err
	}

	// 遍历结果集，为每一项应用默认值
	for _, album := range pageResult.Items {
		s.applyDefaultAlbumParams(album)
	}

	return pageResult, nil
}

// IncrementAlbumStat 实现了更新统计数据的业务逻辑
func (s *albumService) IncrementAlbumStat(ctx context.Context, id uint, statType string) error {
	switch statType {
	case "view":
		return s.albumRepo.IncrementViewCount(ctx, id)
	case "download":
		return s.albumRepo.IncrementDownloadCount(ctx, id)
	default:
		return fmt.Errorf("无效的统计类型: %s", statType)
	}
}

// BatchImportAlbums 实现批量导入相册的业务逻辑
func (s *albumService) BatchImportAlbums(ctx context.Context, params BatchImportParams) (*BatchImportResult, error) {
	result := &BatchImportResult{
		Errors:     make([]BatchImportError, 0),
		Duplicates: make([]string, 0),
	}

	// 获取现有的所有图片哈希，用于去重
	existingHashesMap := make(map[string]bool)
	allExisting, err := s.albumRepo.FindListByOptions(ctx, repository.AlbumQueryOptions{
		PageQuery: repository.PageQuery{
			Page:     1,
			PageSize: 100000, // 获取所有记录用于去重
		},
	})
	if err != nil {
		log.Printf("获取现有图片列表失败: %v", err)
	} else {
		for _, album := range allExisting.Items {
			if album.FileHash != "" {
				existingHashesMap[album.FileHash] = true
			}
		}
	}

	// 批量处理每个URL
	for i, url := range params.URLs {
		displayOrder := params.DisplayOrder + i

		// 获取图片元数据
		metadata, err := s.fetchImageMetadata(url)
		if err != nil {
			result.FailCount++
			result.Errors = append(result.Errors, BatchImportError{
				URL:    url,
				Reason: fmt.Sprintf("获取图片元数据失败: %v", err),
			})
			log.Printf("获取图片元数据失败 [%s]: %v", url, err)
			continue
		}

		// 检查是否已存在
		if existingHashesMap[metadata.FileHash] {
			result.SkipCount++
			result.Duplicates = append(result.Duplicates, url)
			log.Printf("跳过重复图片 [%s]", url)
			continue
		}

		// 创建相册记录
		_, err = s.CreateAlbum(ctx, CreateAlbumParams{
			CategoryID:   params.CategoryID,
			ImageUrl:     url,
			BigImageUrl:  url,
			DownloadUrl:  url,
			ThumbParam:   params.ThumbParam,
			BigParam:     params.BigParam,
			Tags:         params.Tags,
			Width:        metadata.Width,
			Height:       metadata.Height,
			FileSize:     metadata.FileSize,
			Format:       metadata.Format,
			FileHash:     metadata.FileHash,
			DisplayOrder: displayOrder,
		})

		if err != nil {
			// 检查是否为重复错误
			if strings.Contains(err.Error(), "已存在") || strings.Contains(err.Error(), "重复") {
				result.SkipCount++
				result.Duplicates = append(result.Duplicates, url)
				log.Printf("后端检测到重复图片 [%s]: %v", url, err)
			} else {
				result.FailCount++
				result.Errors = append(result.Errors, BatchImportError{
					URL:    url,
					Reason: err.Error(),
				})
				log.Printf("创建相册记录失败 [%s]: %v", url, err)
			}
		} else {
			result.SuccessCount++
			// 将新添加的哈希值加入集合，防止本批次内重复
			existingHashesMap[metadata.FileHash] = true
		}
	}

	return result, nil
}

// ImageMetadata 图片元数据
type ImageMetadata struct {
	Width    int
	Height   int
	FileSize int64
	Format   string
	FileHash string
}

// fetchImageMetadata 获取图片元数据
func (s *albumService) fetchImageMetadata(url string) (*ImageMetadata, error) {
	// 创建HTTP客户端，设置超时
	client := &http.Client{
		Timeout: 60 * time.Second,
	}

	// 创建请求
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	// 设置请求头
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Accept", "image/webp,image/apng,image/*,*/*;q=0.8")

	// 发送请求
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求图片失败: %w", err)
	}
	defer resp.Body.Close()

	// 检查响应状态
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("服务器返回错误状态: %d", resp.StatusCode)
	}

	// 读取图片数据到内存
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取图片数据失败: %w", err)
	}

	// 解析图片以获取尺寸
	img, format, err := image.DecodeConfig(strings.NewReader(string(data)))
	if err != nil {
		return nil, fmt.Errorf("解析图片失败: %w", err)
	}

	// 计算文件哈希
	hash := sha256.Sum256(data)
	fileHash := hex.EncodeToString(hash[:])

	// 确定文件格式
	fileFormat := format
	if fileFormat == "" {
		fileFormat = path.Ext(url)
		if len(fileFormat) > 0 && fileFormat[0] == '.' {
			fileFormat = fileFormat[1:]
		}
		if fileFormat == "" {
			fileFormat = "unknown"
		}
	}

	return &ImageMetadata{
		Width:    img.Width,
		Height:   img.Height,
		FileSize: int64(len(data)),
		Format:   fileFormat,
		FileHash: fileHash,
	}, nil
}

// gcd 函数用于计算两个整数的最大公约数
func gcd(a, b int) int {
	for b != 0 {
		a, b = b, a%b
	}
	return a
}

// getSimplifiedAspectRatioString 根据宽度和高度返回 "宽:高" 格式的最简比例字符串
func getSimplifiedAspectRatioString(width, height int) string {
	if width <= 0 || height <= 0 {
		return "0:0"
	}

	commonDivisor := gcd(width, height)
	return fmt.Sprintf("%d:%d", width/commonDivisor, height/commonDivisor)
}

// applyDefaultAlbumParams 是一个辅助方法，用于为一个相册模型填充默认值。
// 它检查几个关键字段，如果为空，则从配置中获取默认值或使用其他字段进行填充。
func (s *albumService) applyDefaultAlbumParams(album *model.Album) {
	if album == nil {
		return
	}

	if album.BigImageUrl == "" {
		album.BigImageUrl = album.ImageUrl
	}
	if album.DownloadUrl == "" {
		album.DownloadUrl = album.ImageUrl
	}

	if album.ThumbParam == "" {
		album.ThumbParam = s.settingSvc.Get(constant.KeyDefaultThumbParam.String())
	}
	if album.BigParam == "" {
		album.BigParam = s.settingSvc.Get(constant.KeyDefaultBigParam.String())
	}
}

// ExportAlbums 导出相册为 JSON 格式
func (s *albumService) ExportAlbums(ctx context.Context, albumIDs []uint) (*ExportAlbumData, error) {
	log.Printf("[导出相册] 开始导出 %d 个相册", len(albumIDs))

	exportData := &ExportAlbumData{
		Version:  "1.0",
		ExportAt: time.Now(),
		Albums:   make([]ExportAlbumItem, 0, len(albumIDs)),
		Meta: map[string]interface{}{
			"total_albums": len(albumIDs),
			"export_by":    "anheyu-app",
		},
	}

	for _, albumID := range albumIDs {
		// 获取相册详情
		album, err := s.albumRepo.FindByID(ctx, albumID)
		if err != nil {
			log.Printf("[导出相册] 获取相册 %d 失败: %v", albumID, err)
			continue
		}
		if album == nil {
			log.Printf("[导出相册] 相册 %d 不存在", albumID)
			continue
		}

		// 构建导出项
		exportItem := ExportAlbumItem{
			CategoryID:   album.CategoryID,
			ImageUrl:     album.ImageUrl,
			BigImageUrl:  album.BigImageUrl,
			DownloadUrl:  album.DownloadUrl,
			ThumbParam:   album.ThumbParam,
			BigParam:     album.BigParam,
			Tags:         album.Tags,
			Width:        album.Width,
			Height:       album.Height,
			FileSize:     album.FileSize,
			Format:       album.Format,
			AspectRatio:  album.AspectRatio,
			FileHash:     album.FileHash,
			DisplayOrder: album.DisplayOrder,
			Title:        album.Title,
			Description:  album.Description,
			Location:     album.Location,
			CreatedAt:    album.CreatedAt,
			UpdatedAt:    album.UpdatedAt,
			PublishedAt:  album.PublishedAt,
		}

		exportData.Albums = append(exportData.Albums, exportItem)
	}

	log.Printf("[导出相册] 成功导出 %d 个相册", len(exportData.Albums))
	return exportData, nil
}

// ExportAlbumsToZip 导出相册为 ZIP 压缩包
func (s *albumService) ExportAlbumsToZip(ctx context.Context, albumIDs []uint) ([]byte, error) {
	// 先导出为 JSON
	exportData, err := s.ExportAlbums(ctx, albumIDs)
	if err != nil {
		return nil, err
	}

	// 创建 ZIP buffer
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	// 添加 JSON 数据文件
	jsonData, err := json.MarshalIndent(exportData, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("序列化 JSON 失败: %w", err)
	}

	jsonFile, err := zipWriter.Create("albums.json")
	if err != nil {
		return nil, fmt.Errorf("创建 ZIP 文件失败: %w", err)
	}
	if _, err := jsonFile.Write(jsonData); err != nil {
		return nil, fmt.Errorf("写入 JSON 数据失败: %w", err)
	}

	// 添加 README 文件
	readme, err := zipWriter.Create("README.md")
	if err == nil {
		readmeContent := fmt.Sprintf(`# 相册导出包

- 导出时间: %s
- 导出版本: %s
- 相册总数: %d

## 文件说明

- albums.json: 包含所有相册的完整数据（JSON格式）

## 导入说明

使用本系统的导入功能，选择 albums.json 文件即可导入所有相册。
`,
			exportData.ExportAt.Format("2006-01-02 15:04:05"),
			exportData.Version,
			len(exportData.Albums),
		)
		readme.Write([]byte(readmeContent))
	}

	// 关闭 ZIP writer
	if err := zipWriter.Close(); err != nil {
		return nil, fmt.Errorf("关闭 ZIP 文件失败: %w", err)
	}

	return buf.Bytes(), nil
}

// ImportAlbums 从导出的数据导入相册
func (s *albumService) ImportAlbums(ctx context.Context, req *ImportAlbumRequest) (*ImportAlbumResult, error) {
	log.Printf("[导入相册] 开始导入 %d 个相册", len(req.Data.Albums))

	result := &ImportAlbumResult{
		TotalCount: len(req.Data.Albums),
		Errors:     make([]string, 0),
		CreatedIDs: make([]uint, 0),
	}

	// 预加载当前站点可用的分类，避免导入数据中的旧分类ID导致外键报错
	categorySet := make(map[uint]struct{})
	categories, err := s.albumCategoryRepo.FindAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("获取相册分类失败: %w", err)
	}
	for _, category := range categories {
		if category == nil {
			continue
		}
		categorySet[category.ID] = struct{}{}
	}

	var fallbackCategoryID *uint
	if req.DefaultCategoryID != nil {
		if _, exists := categorySet[*req.DefaultCategoryID]; exists {
			fallbackCategoryID = req.DefaultCategoryID
		} else {
			log.Printf("[导入相册] 默认分类ID=%d 不存在，已忽略默认分类", *req.DefaultCategoryID)
		}
	}

	// 获取现有的所有相册哈希，用于去重
	existingHashesMap := make(map[string]uint)
	if req.SkipExisting {
		allExisting, err := s.albumRepo.FindListByOptions(ctx, repository.AlbumQueryOptions{
			PageQuery: repository.PageQuery{
				Page:     1,
				PageSize: 100000, // 获取所有记录用于去重
			},
		})
		if err != nil {
			log.Printf("获取现有相册列表失败: %v", err)
		} else {
			for _, album := range allExisting.Items {
				key := effectiveAlbumFileHash(album.FileHash, album.ImageUrl)
				if key != "" {
					if _, dup := existingHashesMap[key]; !dup {
						existingHashesMap[key] = album.ID
					}
				}
			}
		}
	}

	for idx, albumData := range req.Data.Albums {
		log.Printf("[导入相册] 处理第 %d/%d 个相册", idx+1, result.TotalCount)

		// 检查是否已存在（FileHash 或与 CreateAlbum 一致的 URL 派生哈希）
		importKey := effectiveAlbumFileHash(albumData.FileHash, albumData.ImageUrl)
		if req.SkipExisting && importKey != "" {
			if existingID, exists := existingHashesMap[importKey]; exists {
				log.Printf("[导入相册] 跳过已存在的相册: ID=%d, key=%s", existingID, importKey)
				result.SkippedCount++
				continue
			}
		}

		// 确定分类ID
		categoryID := albumData.CategoryID
		if categoryID == nil {
			categoryID = fallbackCategoryID
		} else if _, exists := categorySet[*categoryID]; !exists {
			if fallbackCategoryID != nil {
				log.Printf("[导入相册] 分类ID=%d 不存在，回退到默认分类ID=%d", *categoryID, *fallbackCategoryID)
				categoryID = fallbackCategoryID
			} else {
				log.Printf("[导入相册] 分类ID=%d 不存在，回退为未分类导入", *categoryID)
				categoryID = nil
			}
		}

		// 解析标签
		var tags []string
		if albumData.Tags != "" {
			tags = strings.Split(albumData.Tags, ",")
		}

		var createdAtPtr *time.Time
		if !albumData.CreatedAt.IsZero() {
			t := albumData.CreatedAt
			createdAtPtr = &t
		}

		// 创建相册
		createdAlbum, err := s.CreateAlbum(ctx, CreateAlbumParams{
			CategoryID:   categoryID,
			ImageUrl:     albumData.ImageUrl,
			BigImageUrl:  albumData.BigImageUrl,
			DownloadUrl:  albumData.DownloadUrl,
			ThumbParam:   albumData.ThumbParam,
			BigParam:     albumData.BigParam,
			Tags:         tags,
			Width:        albumData.Width,
			Height:       albumData.Height,
			FileSize:     albumData.FileSize,
			Format:       albumData.Format,
			FileHash:     albumData.FileHash,
			DisplayOrder: albumData.DisplayOrder,
			Title:        albumData.Title,
			Description:  albumData.Description,
			Location:     albumData.Location,
			CreatedAt:    createdAtPtr,
			PublishedAt:  albumData.PublishedAt,
		})

		if err != nil {
			// 检查是否为重复错误
			if strings.Contains(err.Error(), "已存在") || strings.Contains(err.Error(), "重复") {
				result.SkippedCount++
				log.Printf("[导入相册] 跳过重复相册: %v", err)
			} else {
				errMsg := fmt.Sprintf("导入相册失败 (索引 %d): %v", idx+1, err)
				log.Printf("[导入相册] %s", errMsg)
				result.Errors = append(result.Errors, errMsg)
				result.FailedCount++
			}
			continue
		}

		log.Printf("[导入相册] 成功导入相册: ID=%d", createdAlbum.ID)
		result.CreatedIDs = append(result.CreatedIDs, createdAlbum.ID)
		result.SuccessCount++

		// 将新记录的有效哈希加入集合，防止本批次内重复（与 CreateAlbum 落库哈希一致）
		if key := effectiveAlbumFileHash(createdAlbum.FileHash, createdAlbum.ImageUrl); key != "" {
			existingHashesMap[key] = createdAlbum.ID
		}
	}

	log.Printf("[导入相册] 导入完成 - 总数: %d, 成功: %d, 跳过: %d, 失败: %d",
		result.TotalCount, result.SuccessCount, result.SkippedCount, result.FailedCount)

	return result, nil
}

// ImportAlbumsFromJSON 从 JSON 数据导入相册
func (s *albumService) ImportAlbumsFromJSON(ctx context.Context, jsonData []byte, req *ImportAlbumRequest) (*ImportAlbumResult, error) {
	var exportData ExportAlbumData
	if err := json.Unmarshal(jsonData, &exportData); err != nil {
		return nil, fmt.Errorf("解析 JSON 数据失败: %w", err)
	}

	req.Data = exportData
	return s.ImportAlbums(ctx, req)
}

// ImportAlbumsFromZip 从 ZIP 压缩包导入相册
func (s *albumService) ImportAlbumsFromZip(ctx context.Context, zipData []byte, req *ImportAlbumRequest) (*ImportAlbumResult, error) {
	// 读取 ZIP 内容
	zipReader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fmt.Errorf("读取 ZIP 文件失败: %w", err)
	}

	// 查找 albums.json 文件
	var jsonData []byte
	for _, file := range zipReader.File {
		if file.Name == "albums.json" {
			rc, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("打开 albums.json 失败: %w", err)
			}
			defer rc.Close()

			jsonData, err = io.ReadAll(rc)
			if err != nil {
				return nil, fmt.Errorf("读取 albums.json 失败: %w", err)
			}
			break
		}
	}

	if jsonData == nil {
		return nil, fmt.Errorf("ZIP 文件中未找到 albums.json")
	}

	return s.ImportAlbumsFromJSON(ctx, jsonData, req)
}
