/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-12 17:41:31
 * @LastEditTime: 2025-07-12 17:41:35
 * @LastEditors: 安知鱼
 */
package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

// JSONMap 是一个自定义类型，用于在 Ent 中处理 JSON 字段。
// 它实现了 database/sql/driver.Valuer 和 database/sql.Scanner 接口。
type JSONMap map[string]interface{}

// Value 实现了 driver.Valuer 接口，用于将 JSONMap 写入数据库。
func (j JSONMap) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan 实现了 sql.Scanner 接口，用于从数据库读取数据到 JSONMap。
func (j *JSONMap) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	var byteSlice []byte
	switch v := value.(type) {
	case []byte:
		byteSlice = v
	case string:
		byteSlice = []byte(v)
	default:
		return fmt.Errorf("unsupported type for JSONMap scan: %T", value)
	}
	return json.Unmarshal(byteSlice, j)
}
