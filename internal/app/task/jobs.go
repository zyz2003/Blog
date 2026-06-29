/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-12 16:09:46
 * @LastEditTime: 2025-07-31 10:03:36
 * @LastEditors: 安知鱼
 */
// internal/app/task/jobs.go
package task

// 它与 cron.Job 接口兼容。
type Job interface {
	Run()
	Name() string
}

type NamedJob interface {
	Job
	Name() string
}
