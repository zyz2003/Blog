/*
 * @Description: 提供了用于 cron 任务的健壮的中间件（装饰器）。
 * @Author: 安知鱼
 * @Date: 2025-06-29 22:36:09
 * @LastEditTime: 2025-07-14 00:32:02
 * @LastEditors: 安知鱼
 */
package task

import (
	"log/slog"
	"reflect"
	"runtime/debug"
	"time"

	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
)

// JobWrapper 是 cron.JobWrapper 的类型别名，用于简化代码。
type JobWrapper = cron.JobWrapper

// NewLoggingWrapper 创建一个日志装饰器。
// 它使用结构化日志记录每个任务的开始和结束，并包含一个唯一的执行ID，
// 使得日志更易于查询和分析。
func NewLoggingWrapper(logger *slog.Logger) JobWrapper {
	return func(j cron.Job) cron.Job {
		return cron.FuncJob(func() {
			// 为本次执行生成一个唯一的ID，便于追踪
			executionID := uuid.New().String()
			jobName := getJobName(j)

			// 为本次任务运行创建一个带有上下文信息的专属logger
			jobLogger := logger.With(
				slog.String("job_name", jobName),
				slog.String("execution_id", executionID),
			)

			startTime := time.Now()
			jobLogger.Info("Job execution started")

			j.Run()

			duration := time.Since(startTime)
			jobLogger.Info("Job execution finished", slog.Duration("duration", duration))
		})
	}
}

// NewPanicRecoveryWrapper 创建一个健壮的 panic 恢复装饰器。
// 如果任务发生 panic，它会捕获 panic，使用结构化日志记录详细的错误信息和堆栈，
// 但不会导致整个应用程序崩溃。
func NewPanicRecoveryWrapper(logger *slog.Logger) JobWrapper {
	return func(j cron.Job) cron.Job {
		return cron.FuncJob(func() {
			defer func() {
				if r := recover(); r != nil {
					jobName := getJobName(j)
					// 使用结构化日志记录 panic，便于告警和分析
					logger.Error("Job panicked",
						slog.String("job_name", jobName),
						slog.Any("panic", r),
						slog.String("stack_trace", string(debug.Stack())),
					)
				}
			}()

			j.Run()
		})
	}
}

// getJobName 是一个辅助函数，用于从 cron.Job 接口中获取具体的类型名。
// 它优先使用任务自定义的 Name() 方法，如果不存在，则通过反射获取其结构体名称。
func getJobName(j cron.Job) string {
	// 优先尝试调用 Name() 方法，获取一个可读性好的自定义名称
	if namedJob, ok := j.(interface{ Name() string }); ok {
		return namedJob.Name()
	}

	// 如果没有 Name() 方法，通过反射获取其类型名称作为备用
	// 例如，对于 *task.MyJob 类型，它会返回 "task.MyJob"
	jobType := reflect.TypeOf(j)
	if jobType.Kind() == reflect.Ptr {
		return jobType.Elem().String()
	}
	return jobType.String()
}
