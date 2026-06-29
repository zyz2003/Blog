/*
 * @Description: 统一监听 FileCreated 事件，并协调分发所有后续的后台处理任务。
 * @Author: 安知鱼
 * @Date: 2025-07-18 17:30:00 // (示例创建时间)
 * @LastEditTime: 2025-07-18 14:01:58
 * @LastEditors: 安知鱼
 */
package listener

import (
	"context"
	"log"

	"github.com/anzhiyu-c/anheyu-app/internal/app/task"
	"github.com/anzhiyu-c/anheyu-app/internal/pkg/event"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/file_info"
)

// FilePostProcessingListener 监听 FileCreated 事件，并作为总协调器，
// 派发所有后续的后台处理任务，如元数据提取和缩略图生成。
type FilePostProcessingListener struct {
	broker        *task.Broker
	extractionSvc *file_info.ExtractionService
}

// NewFilePostProcessingListener 是 FilePostProcessingListener 的构造函数。
// 它订阅 FileCreated 事件，并成为处理新文件后台任务的唯一入口。
func NewFilePostProcessingListener(
	eventBus *event.EventBus,
	broker *task.Broker,
	extractionSvc *file_info.ExtractionService,
) *FilePostProcessingListener {
	listener := &FilePostProcessingListener{
		broker:        broker,
		extractionSvc: extractionSvc,
	}
	// 成为 FileCreated 事件的唯一订阅者
	eventBus.Subscribe(event.FileCreated, listener.handleFileCreated)
	return listener
}

// handleFileCreated 是事件处理器，负责协调和分发任务。
func (l *FilePostProcessingListener) handleFileCreated(payload interface{}) {
	fileID, ok := payload.(uint)
	if !ok {
		log.Printf("[FilePostProcessingListener] 错误：收到的FileCreated事件负载类型不正确")
		return
	}

	log.Printf("[FilePostProcessingListener] 收到 FileCreated 事件 for FileID %d，开始协调后台任务...", fileID)

	// 任务1：立即在后台开始提取媒体元数据 (EXIF, 音乐标签等)
	// 这个任务通常比较快，并且是独立的。
	go func() {
		log.Printf("[FilePostProcessingListener] -> 正在为 FileID %d 触发元数据提取...", fileID)
		err := l.extractionSvc.ExtractAndSave(context.Background(), fileID)
		if err != nil {
			log.Printf("[FilePostProcessingListener] 错误: 为 FileID %d 提取元数据失败: %v", fileID, err)
		} else {
			log.Printf("[FilePostProcessingListener] -> FileID %d 元数据提取完成。", fileID)
		}
	}()

	// 任务2：将计算密集型的缩略图生成任务派发到后台任务队列 (Broker)
	// Broker 内部会处理任务的分发和执行。
	log.Printf("[FilePostProcessingListener] -> 正在为 FileID %d 派发缩略图生成任务...", fileID)
	l.broker.DispatchThumbnailGeneration(fileID)
}
