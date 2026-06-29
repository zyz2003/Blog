/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-26 11:59:31
 * @LastEditTime: 2025-07-13 13:05:13
 * @LastEditors: 安知鱼
 */
package types

import (
	"database/sql/driver" // 引入 driver 包用于 Value() 方法
	"fmt"                 // 引入 fmt 包
	"strconv"             // 引入 strconv 包
)

// NullUint64 用于处理可为空的 uint64 类型。
// 它实现了 database/sql.Scanner 和 database/sql/driver.Valuer 接口，
// 以便在 数据库操作中正确处理 NULL 值。
type NullUint64 struct {
	Uint64 uint64
	Valid  bool // Valid 为 true 表示 Uint64 字段是非 NULL 的
}

// Scan 实现了 sql.Scanner 接口，用于从数据库读取数据到 NullUint64。
func (nu *NullUint64) Scan(value interface{}) error {
	if value == nil {
		nu.Uint64, nu.Valid = 0, false
		return nil
	}
	switch v := value.(type) {
	case uint64:
		nu.Uint64, nu.Valid = v, true
	case int64: // 数据库可能会返回 int64 类型
		nu.Uint64, nu.Valid = uint64(v), true
	case []byte: // 数据库也可能返回 []byte 类型
		i, err := strconv.ParseUint(string(v), 10, 64)
		if err != nil {
			return err
		}
		nu.Uint64, nu.Valid = i, true
	default:
		return fmt.Errorf("不支持的 Scan 类型，无法转换为 NullUint64: %T", value)
	}
	return nil
}

// Value 实现了 driver.Valuer 接口，用于将 NullUint64 写入数据库。
func (nu NullUint64) Value() (driver.Value, error) {
	if !nu.Valid {
		return nil, nil // 如果无效，则写入数据库 NULL
	}
	return int64(nu.Uint64), nil // 将 uint64 存储为 int64
}
