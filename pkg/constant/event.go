/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-10-09 18:07:37
 * @LastEditTime: 2025-10-09 18:07:49
 * @LastEditors: 安知鱼
 */
package constant

import "github.com/anzhiyu-c/anheyu-app/internal/pkg/event"

// EventTopic 事件主题类型
type EventTopic = event.Topic

// 导出事件主题常量，供外部使用
const (
	// EventFileCreated 文件创建事件
	EventFileCreated EventTopic = event.FileCreated
	// 友链事件
	EventLinkCreated EventTopic = event.LinkCreated
	EventLinkUpdated EventTopic = event.LinkUpdated
	EventLinkDeleted EventTopic = event.LinkDeleted
)
