/*
 * @Description: 嵌入默认字体供图片水印使用
 * @Author: 安知鱼
 *
 * Plan Task 3.3：以 //go:embed 方式把 Go 官方 Bigelow & Holmes 设计的 Go 字体
 * 直接编译进二进制，避免部署时漏放字体文件。
 *
 * 字体来源：https://go.googlesource.com/image/+/refs/heads/master/font/gofont/ttfs/Go-Regular.ttf
 * 许可：BSD-3-Clause（详见同目录 LICENSE）
 */
package assets

import _ "embed"

// GoRegular 是 Go 官方 Regular 字体（TrueType）的原始字节。
// 使用前推荐用 golang.org/x/image/font/opentype 或 github.com/golang/freetype/truetype 解析。
//
//go:embed GoRegular.ttf
var GoRegular []byte
