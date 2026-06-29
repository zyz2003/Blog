/*
 * @Description: 存储策略模型
 * @Author: 安知鱼
 * @Date: 2025-06-28 00:21:55
 * @LastEditTime: 2025-08-23 01:38:51
 * @LastEditors: 安知鱼
 */
package model

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
)

type StoragePolicySettings map[string]interface{}

// GetString 是一个辅助方法，用于从 settings map 中安全地获取字符串值。
// 如果键不存在，或者值的类型不是字符串，则返回提供的默认值。
func (s StoragePolicySettings) GetString(key, defaultValue string) string {
	if val, ok := s[key].(string); ok && val != "" {
		return val
	}
	return defaultValue
}

// GetInt safely retrieves an integer value from the settings map.
func (s StoragePolicySettings) GetInt(key string, defaultValue int) int {
	if value, ok := s[key]; ok {
		if floatVal, isFloat := value.(float64); isFloat {
			return int(floatVal)
		}
		if intVal, isInt := value.(int); isInt {
			return intVal
		}
	}
	return defaultValue
}

// Value - 实现 driver.Valuer 接口, Ent 保存时调用
func (s StoragePolicySettings) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}
	return json.Marshal(s)
}

// Scan - 实现 sql.Scanner 接口, Ent 查询时调用
func (s *StoragePolicySettings) Scan(value interface{}) error {
	b, ok := value.([]byte)
	if !ok {
		if value == nil {
			*s = make(StoragePolicySettings)
			return nil
		}
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(b, s)
}

// StoragePolicy 是存储策略的领域模型
type StoragePolicy struct {
	ID          uint                       `json:"id"`
	CreatedAt   time.Time                  `json:"created_at"`
	UpdatedAt   time.Time                  `json:"updated_at"`
	DeletedAt   *time.Time                 `json:"deleted_at,omitempty"`
	Flag        string                     `json:"flag,omitempty"`
	Name        string                     `json:"name"`
	Type        constant.StoragePolicyType `json:"type"`
	Server      string                     `json:"server"`
	BucketName  string                     `json:"bucket_name"`
	IsPrivate   bool                       `json:"is_private"`
	AccessKey   string                     `json:"access_key"`
	SecretKey   string                     `json:"secret_key"`
	MaxSize     int64                      `json:"max_size"`
	BasePath    string                     `json:"base_path"`
	VirtualPath string                     `json:"virtual_path"`
	Settings    StoragePolicySettings      `json:"settings"`
	NodeID      *uint                      `json:"node_id"`
}

// StoragePolicyResponse 是用于API响应的存储策略数据传输对象 (DTO)。
type StoragePolicyResponse struct {
	ID          string                 `json:"id"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Flag        string                 `json:"flag,omitempty"`
	Server      string                 `json:"server,omitempty"`
	BucketName  string                 `json:"bucket_name,omitempty"`
	IsPrivate   bool                   `json:"is_private"`
	AccessKey   string                 `json:"access_key,omitempty"`
	SecretKey   string                 `json:"secret_key,omitempty"`
	MaxSize     int64                  `json:"max_size"`
	BasePath    string                 `json:"base_path,omitempty"`
	VirtualPath string                 `json:"virtual_path,omitempty"`
	Settings    map[string]interface{} `json:"settings,omitempty"`
}
