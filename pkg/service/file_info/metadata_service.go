/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-10 14:02:40
 * @LastEditTime: 2025-07-30 17:01:46
 * @LastEditors: 安知鱼
 */
package file_info

import (
	"context"
	"log"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/repository"
)

type MetadataService struct {
	repo repository.MetadataRepository
}

func NewMetadataService(repo repository.MetadataRepository) *MetadataService {
	return &MetadataService{repo: repo}
}

func (s *MetadataService) DeleteByFileID(ctx context.Context, fileID uint) error {
	return s.repo.DeleteByFileID(ctx, fileID)
}

func (s *MetadataService) Set(ctx context.Context, fileID uint, name, value string) error {
	meta := &model.Metadata{FileID: fileID, Name: name, Value: value}
	return s.repo.Set(ctx, meta)
}

func (s *MetadataService) Delete(ctx context.Context, fileID uint, name string) error {
	return s.repo.Delete(ctx, fileID, name)
}

func (s *MetadataService) Get(ctx context.Context, fileID uint, name string) (string, error) {
	meta, err := s.repo.Get(ctx, fileID, name)
	if err != nil {
		return "", err
	}
	return meta.Value, nil
}

func (s *MetadataService) GetAllAsMap(ctx context.Context, fileID uint) (map[string]string, error) {
	metas, err := s.repo.GetAll(ctx, fileID)
	if err != nil {
		return nil, err
	}
	result := make(map[string]string, len(metas))
	for _, meta := range metas {
		result[meta.Name] = meta.Value
	}
	return result, nil
}

// HydrateFile 用元数据填充单个文件模型
func (s *MetadataService) HydrateFile(ctx context.Context, file *model.File) {
	if file == nil {
		return
	}
	metas, err := s.GetAllAsMap(ctx, file.ID)
	if err != nil {
		log.Printf("警告：填充文件 %d 的元数据失败: %v", file.ID, err)
		file.Metas = make(map[string]string)
		return
	}
	file.Metas = metas
}

// ResetThumbnailMetadataForFileIDs 批量删除指定文件ID列表的缩略图相关元数据。
// 这个方法会调用 repository 层的对应批量方法来执行一次数据库操作。
func (s *MetadataService) ResetThumbnailMetadataForFileIDs(ctx context.Context, fileIDs []uint) error {
	if len(fileIDs) == 0 {
		return nil
	}
	// 将请求传递给 repository 层进行处理
	return s.repo.ResetThumbnailMetadataForFileIDs(ctx, fileIDs)
}
