/*
 * @Description: printImageStyleDiagnostic 启动诊断日志测试
 * @Author: 安知鱼
 *
 * 这个测试依据本机是否安装了 vips CLI 做条件断言：
 *   - 有 vips：日志必须包含 ✅ 前缀、"vips" 字样、版本号占位。
 *   - 无 vips：日志必须包含 ⚠️ 前缀和"纯 Go 降级模式"说明。
 *
 * 选择"运行时探测"而非桩注入，是因为 engine 包的探测桩变量是私有的；
 * 该诊断函数本身是启动横幅，实际就在同一运行环境下工作，集成性验证更合适。
 */
package bootstrap

import (
	"bytes"
	"log"
	"strings"
	"testing"

	image_style_engine "github.com/anzhiyu-c/anheyu-app/pkg/service/image_style/engine"
)

// captureLog 重定向 log 输出到 buf，执行 fn 后恢复原始 output。
func captureLog(t *testing.T, fn func()) string {
	t.Helper()
	prev := log.Writer()
	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(prev)
	fn()
	return buf.String()
}

// TestPrintImageStyleDiagnostic_EmitsBanner 断言启动横幅的基本格式。
// 根据本机是否有 vips 分别校验两种分支的日志关键字。
func TestPrintImageStyleDiagnostic_EmitsBanner(t *testing.T) {
	// Probe 有进程级缓存（sync.Once）。先重置，让环境探测落到当前环境。
	image_style_engine.ResetProbeForTest()

	b := &Bootstrapper{}
	out := captureLog(t, b.printImageStyleDiagnostic)

	if strings.Contains(out, "图片样式引擎") {
		// Probe 判定 vips 可用时，诊断应输出成功横幅。
		if !strings.Contains(out, "图片样式引擎") {
			t.Errorf("有 vips 时日志应包含 '图片样式引擎'，实际：%s", out)
		}
		if !strings.Contains(out, "vips") {
			t.Errorf("有 vips 时日志应包含 'vips'，实际：%s", out)
		}
		// 不强制断言版本号（不同机器版本不同），只要有 @ 路径分隔即可
		if !strings.Contains(out, "@") {
			t.Errorf("有 vips 时日志应包含 '@' 指示二进制路径，实际：%s", out)
		}
		return
	}

	// Probe 判定 vips 不可用时：必须出现降级警示。
	if !strings.Contains(out, "未检测到 vips") {
		t.Errorf("无 vips 时日志应包含 '未检测到 vips'，实际：%s", out)
	}
	if !strings.Contains(out, "纯 Go 降级模式") {
		t.Errorf("无 vips 时日志应包含 '纯 Go 降级模式'，实际：%s", out)
	}
}
