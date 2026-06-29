/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-07-09 11:00:56
 * @LastEditTime: 2025-07-31 10:04:15
 * @LastEditors: 安知鱼
 */
package utils

import (
	"context"
	"io"

	"golang.org/x/time/rate"
)

// ThrottledWriter 是一个实现了 io.Writer 接口的结构体，用于限制写入速度。
type ThrottledWriter struct {
	w       io.Writer
	limiter *rate.Limiter
	ctx     context.Context
}

// NewThrottledWriter 创建一个新的限速写入器。
// limit 是每秒允许的字节数。如果 limit <= 0，则不限速，返回原始的 writer。
func NewThrottledWriter(w io.Writer, limit int64, ctx context.Context) io.Writer {
	if limit <= 0 {
		return w
	}
	// rate.Limit 的单位是 "token/s"，让 1 token = 1 byte
	limiter := rate.NewLimiter(rate.Limit(limit), int(limit)) // 桶大小也设为limit
	return &ThrottledWriter{
		w:       w,
		limiter: limiter,
		ctx:     ctx,
	}
}

// Write 实现 io.Writer 接口
func (t *ThrottledWriter) Write(p []byte) (n int, err error) {
	// WaitN 方法可能会因为上下文取消而提前返回错误，所以先写入再等待
	// 这样可以确保即使等待失败，数据也已经写入了缓冲区
	n, err = t.w.Write(p)
	if err != nil {
		return n, err
	}

	if t.limiter != nil {
		err = t.limiter.WaitN(t.ctx, n)
	}

	return n, err
}
