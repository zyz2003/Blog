/*
 * @Description: 字体嵌入自检
 * @Author: 安知鱼
 */
package assets

import (
	"bytes"
	"testing"
)

// TestGoRegular_HasBytes 确认 go:embed 生效，字节非空。
func TestGoRegular_HasBytes(t *testing.T) {
	if len(GoRegular) == 0 {
		t.Fatal("GoRegular 字节为空，go:embed 未生效")
	}
	// TTF 文件魔数：0x00 0x01 0x00 0x00 (TrueType) 或 "OTTO" (OpenType)
	ttfHeader := []byte{0x00, 0x01, 0x00, 0x00}
	otfHeader := []byte("OTTO")
	if !bytes.HasPrefix(GoRegular, ttfHeader) && !bytes.HasPrefix(GoRegular, otfHeader) {
		t.Fatalf("GoRegular 头部不是合法的 TrueType/OpenType 签名：%x", GoRegular[:4])
	}
}
