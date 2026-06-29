/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-12 16:09:46
 * @LastEditTime: 2025-07-30 20:39:41
 * @LastEditors: 安知鱼
 */
package thumbnail

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// GenerateCacheName 根据文件所有者的公共ID和文件本身的公共ID生成一个唯一的、可预测的缓存文件名。
func GenerateCacheName(userPublicID, filePublicID string, ext string) string {
	// 格式: {user_public_id}_{file_public_id}.thumb.{ext}
	return fmt.Sprintf("%s_%s.%s", userPublicID, filePublicID, ext)
}

// GetCachePath 根据缓存根目录、文件的父级虚拟路径和缓存文件名，
// 构建出完整的、带有子目录结构的缓存文件绝对路径。
// 它会自动创建不存在的子目录。
func GetCachePath(cacheRootDir, virtualParentPath, cacheFileName string) (string, error) {
	relativePath := strings.TrimPrefix(virtualParentPath, "/")
	targetDir := filepath.Join(cacheRootDir, relativePath)
	if err := os.MkdirAll(targetDir, os.ModePerm); err != nil {
		log.Printf("[ERROR] Failed to create thumbnail directory '%s': %v", targetDir, err)
		return "", fmt.Errorf("无法创建缩略图子目录 '%s': %w", targetDir, err)
	}
	return filepath.Join(targetDir, cacheFileName), nil
}
