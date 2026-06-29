/*
 * @Description: 上传响应 URL 拼接默认样式后缀的决策逻辑
 * @Author: 安知鱼
 *
 * 对应 Spec §8.4：在所有上传 service（文章 / 评论 / 头像 / 即刻）返回 URL 前
 * 调用 ResolveUploadURLSuffix，若命中条件就返回 sep+styleName（例如 "!thumbnail"）。
 */
package image_style

import (
	"path/filepath"
	"strings"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
)

// resolveUploadURLSuffix 是无状态的纯函数实现，独立于 ImageStyleService。
// 这样 Handler/Service 测试可以直接调用它而不构造完整的 ImageStyleService。
//
// 决策树（对齐 Spec §8.4）：
//   1. policy == nil                                        → ""
//   2. image_process.enabled == false                       → ""
//   3. image_process.default_style == ""                    → ""
//   4. 文件扩展名不在 apply_to_extensions 中                  → ""
//   5. default_style 不在 image_styles 中                   → ""
//   6. 以上均满足 → 返回 sep+defaultStyle（sep 来自 style_separator，默认 "!"）
func resolveUploadURLSuffix(policy *model.StoragePolicy, filename string) string {
	if policy == nil {
		return ""
	}
	cfg := parseImageProcess(policy)
	if !cfg.Enabled || cfg.DefaultStyle == "" {
		return ""
	}
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(filename)), ".")
	if ext == "" {
		return ""
	}
	if !containsString(cfg.ApplyToExtensions, ext) {
		return ""
	}
	if _, ok := findStyleByName(policy, cfg.DefaultStyle); !ok {
		return ""
	}
	sep := policy.Settings.GetString(constant.StyleSeparatorSettingKey, "!")
	return sep + cfg.DefaultStyle
}
