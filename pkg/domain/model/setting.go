/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-20 13:01:45
 * @LastEditTime: 2025-07-16 10:56:16
 * @LastEditors: 安知鱼
 */
package model

import "time"

// Setting 是核心业务模型
type Setting struct {
	ID        uint      `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	ConfigKey string    `json:"key"`
	Value     string    `json:"value"`
	Comment   string    `json:"comment"`
}
