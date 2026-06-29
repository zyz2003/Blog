/*
 * @Description: image_style 服务层对外的错误语义
 * @Author: 安知鱼
 *
 * 这些错误会被 handler 层据以决定 HTTP 响应（302/404/原图 fallback）。
 * 引擎层的 ErrFormatUnsupported 属于 engine 子包，不在此处暴露。
 */
package image_style

import "errors"

// ErrStyleNotApplicable 表示样式处理不适用于当前请求；
// 典型场景：策略未启用、扩展名不在 ApplyToExtensions 中、未指定样式且无默认样式。
// HTTP handler 收到该错误时应 302 重定向到原图直链。
var ErrStyleNotApplicable = errors.New("image style not applicable for this file")

// ErrStyleNotFound 表示请求的命名样式在策略配置中不存在。
// HTTP handler 收到该错误时应返回 404。
var ErrStyleNotFound = errors.New("named style not found")

// ErrStyleProcessFailed 表示处理过程本身失败（引擎错误、配置非法等）。
// HTTP handler 收到该错误时应记录日志并 302 回原图，避免向用户暴露内部错误。
var ErrStyleProcessFailed = errors.New("image style process failed")
