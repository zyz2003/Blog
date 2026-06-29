/*
 * @Description: vips 探测的单元测试
 * @Author: 安知鱼
 *
 * 对应 Plan Task 2.1.2：
 *  - vipsLookPath 返回错误 → Available: false
 *  - 用桩命令返回预设输出 → 解析版本 / 输入 / 输出格式正确
 *  - --version 执行失败 → Available: false 且带 BinaryPath 便于排查
 *  - Probe() 有进程级缓存：多次调用只触发一次命令
 *  - parseVipsVersion / parseVipsForeignClasses / extractFormatFromClassName 的
 *    解析纯函数单独做表驱动测试
 */
package engine

import (
	"context"
	"errors"
	"reflect"
	"sort"
	"strings"
	"sync/atomic"
	"testing"
)

// withStubVips 安装桩实现并返回恢复函数。
func withStubVips(t *testing.T, lookPath func(string) (string, error),
	runCmd func(ctx context.Context, name string, args ...string) ([]byte, error)) func() {
	t.Helper()
	prevLook := vipsLookPath
	prevRun := vipsRunCommand
	vipsLookPath = lookPath
	vipsRunCommand = runCmd
	ResetProbeForTest()
	return func() {
		vipsLookPath = prevLook
		vipsRunCommand = prevRun
		ResetProbeForTest()
	}
}

func TestProbe_NoVipsInPath(t *testing.T) {
	restore := withStubVips(t,
		func(string) (string, error) { return "", errors.New("not found") },
		func(ctx context.Context, name string, args ...string) ([]byte, error) {
			t.Fatalf("LookPath 失败时不应调用 vips 命令，实际被调用：%s %v", name, args)
			return nil, nil
		},
	)
	defer restore()

	cap := Probe()
	if cap.Available {
		t.Fatalf("无 vips 时 Available 应为 false，实际 %+v", cap)
	}
	if cap.BinaryPath != "" || cap.Version != "" {
		t.Errorf("无 vips 时不应有路径或版本，实际 %+v", cap)
	}
}

func TestProbe_HappyPath_Vips818(t *testing.T) {
	// 精简版 `vips -l` 输出片段（真实的输出超过千行；这里只保留关键 foreign 行）。
	listOutput := `  VipsOperation (operation), operations
      VipsForeignLoadPng (pngload_base), load png base class, priority=200
        VipsForeignLoadPngFile (pngload), load png from file (.png), priority=200, is_a, get_flags, get_flags_filename, header, load
        VipsForeignLoadPngBuffer (pngload_buffer), load png from buffer, priority=200, is_a_buffer, get_flags, get_flags_filename, header, load
        VipsForeignLoadPngSource (pngload_source), load png from source, nocache, priority=200, is_a_source, get_flags, get_flags_filename, header, load
      VipsForeignLoadJpeg (jpegload_base), load jpeg, priority=50
        VipsForeignLoadJpegFile (jpegload), load jpeg from file (.jpg, .jpeg), priority=50, is_a, get_flags, header, load
      VipsForeignLoadWebp (webpload_base), load webp, priority=200
        VipsForeignLoadWebpFile (webpload), load webp from file (.webp), priority=200, is_a, get_flags
      VipsForeignLoadNsgif (gifload_base), load GIF with libnsgif, priority=50
        VipsForeignLoadNsgifFile (gifload), load GIF with libnsgif (.gif), priority=50, is_a
      VipsForeignLoadHeif (heifload_base), load a HEIF image, priority=0
        VipsForeignLoadHeifFile (heifload), load a HEIF image (.heic, .heif, .avif), priority=0
      VipsForeignSavePng (pngsave_base), save as png
        VipsForeignSavePngFile (pngsave), save image to png file (.png)
        VipsForeignSavePngTarget (pngsave_target), save image to png target
      VipsForeignSaveJpeg (jpegsave_base), save as jpeg
        VipsForeignSaveJpegFile (jpegsave), save image to jpeg file (.jpg, .jpeg)
        VipsForeignSaveJpegTarget (jpegsave_target), save image to jpeg target
      VipsForeignSaveWebp (webpsave_base), save as webp
        VipsForeignSaveWebpFile (webpsave), save image to webp file (.webp)
        VipsForeignSaveWebpTarget (webpsave_target), save image to webp target
      VipsForeignSaveHeif (heifsave_base), save as heif
        VipsForeignSaveHeifFile (heifsave), save image in HEIF format (.heic, .heif, .avif)
`

	var (
		lookCalls atomic.Int32
		runCalls  atomic.Int32
	)

	restore := withStubVips(t,
		func(name string) (string, error) {
			lookCalls.Add(1)
			if name != "vips" {
				t.Errorf("LookPath 应查询 'vips'，实际 %q", name)
			}
			return "/usr/bin/vips", nil
		},
		func(ctx context.Context, name string, args ...string) ([]byte, error) {
			runCalls.Add(1)
			if name != "/usr/bin/vips" {
				t.Errorf("应使用 LookPath 返回的路径，实际 %q", name)
			}
			if len(args) == 1 && args[0] == "--version" {
				return []byte("vips-8.18.2\n"), nil
			}
			if len(args) == 1 && args[0] == "-l" {
				return []byte(listOutput), nil
			}
			t.Errorf("未预期的 vips 调用参数: %v", args)
			return nil, errors.New("unexpected")
		},
	)
	defer restore()

	cap := Probe()
	if !cap.Available {
		t.Fatalf("快乐路径应 Available=true，实际 %+v", cap)
	}
	if cap.BinaryPath != "/usr/bin/vips" {
		t.Errorf("BinaryPath 错误：%s", cap.BinaryPath)
	}
	if cap.Version != "8.18.2" {
		t.Errorf("Version 应解析为 8.18.2，实际 %s", cap.Version)
	}

	mustContain := func(label string, list []string, want ...string) {
		t.Helper()
		set := map[string]bool{}
		for _, s := range list {
			set[s] = true
		}
		for _, w := range want {
			if !set[w] {
				sort.Strings(list)
				t.Errorf("%s 缺少 %q（当前：%v）", label, w, list)
			}
		}
	}
	mustContain("InputFormats", cap.InputFormats, "png", "jpeg", "jpg", "webp", "gif", "heic", "heif", "avif")
	mustContain("OutputFormats", cap.OutputFormats, "png", "jpeg", "jpg", "webp", "heic", "heif", "avif")

	// 缓存：第二次调 Probe 不应再 fork 子进程。
	before := runCalls.Load()
	_ = Probe()
	_ = Probe()
	if runCalls.Load() != before {
		t.Errorf("Probe 应进程内缓存；实际重复调用：%d", runCalls.Load()-before)
	}
}

func TestProbe_VersionCommandFails(t *testing.T) {
	restore := withStubVips(t,
		func(string) (string, error) { return "/opt/bin/vips", nil },
		func(ctx context.Context, name string, args ...string) ([]byte, error) {
			return nil, errors.New("exec failed")
		},
	)
	defer restore()

	cap := Probe()
	if cap.Available {
		t.Fatalf("--version 失败时 Available 应为 false，实际 %+v", cap)
	}
	if cap.BinaryPath != "/opt/bin/vips" {
		t.Errorf("即便不可用，也应保留 BinaryPath 便于排查；实际 %q", cap.BinaryPath)
	}
}

func TestProbe_ListCommandFailsStillAvailable(t *testing.T) {
	// `vips -l` 失败时应保守地标记可用但没有格式列表，这样 AutoEngine 可以降级到保守模式。
	var calls atomic.Int32
	restore := withStubVips(t,
		func(string) (string, error) { return "/opt/bin/vips", nil },
		func(ctx context.Context, name string, args ...string) ([]byte, error) {
			calls.Add(1)
			if args[0] == "--version" {
				return []byte("vips-9.0.0\n"), nil
			}
			return nil, errors.New("list failed")
		},
	)
	defer restore()

	cap := Probe()
	if !cap.Available {
		t.Fatalf("--version 成功 / -l 失败应仍标记 Available=true，实际 %+v", cap)
	}
	if cap.Version != "9.0.0" {
		t.Errorf("Version 解析错误：%s", cap.Version)
	}
	if len(cap.InputFormats) != 0 || len(cap.OutputFormats) != 0 {
		t.Errorf("-l 失败时格式列表应为空，实际 in=%v out=%v", cap.InputFormats, cap.OutputFormats)
	}
}

func TestParseVipsVersion(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"classic", "vips-8.18.2", "8.18.2"},
		{"two-part", "vips-8.14 (dev)\n", "8.14"},
		{"multiline-stable", "vips-8.15.3\n\n(C) Kleisauke", "8.15.3"},
		{"unknown", "custom build", "custom build"},
		{"empty", "", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := parseVipsVersion(c.in); got != c.want {
				t.Errorf("parseVipsVersion(%q) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}

func TestExtractFormatFromClassName(t *testing.T) {
	cases := []struct {
		name   string
		line   string
		prefix string
		want   string
	}{
		{"load-png-file", "VipsForeignLoadPngFile (pngload), ...", "VipsForeignLoad", "png"},
		{"load-jpeg-buffer", "VipsForeignLoadJpegBuffer (jpegload_buffer), ...", "VipsForeignLoad", "jpeg"},
		{"save-webp-target", "VipsForeignSaveWebpTarget (webpsave_target), ...", "VipsForeignSave", "webp"},
		{"load-heif-source", "VipsForeignLoadHeifSource (heifload_source), ...", "VipsForeignLoad", "heif"},
		{"load-nsgif-file", "VipsForeignLoadNsgifFile (gifload), ...", "VipsForeignLoad", "nsgif"},
		{"prefix-missing", "VipsOperation (operation)", "VipsForeignLoad", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := extractFormatFromClassName(c.line, c.prefix)
			if got != c.want {
				t.Errorf("got %q, want %q", got, c.want)
			}
		})
	}
}

func TestParseVipsForeignClasses_Aliases(t *testing.T) {
	input := `
VipsForeignLoadJpegFile (jpegload), load jpeg (.jpg, .jpeg)
VipsForeignSaveHeifFile (heifsave), save heif (.heic, .heif, .avif)
VipsForeignLoadNsgifFile (gifload), load gif (.gif)
`
	in, out := parseVipsForeignClasses(input)

	// 输入应包含 jpeg/jpg / gif；注意 heif 只出现在 save 分支。
	wantIn := []string{"jpeg", "jpg", "gif"}
	if !reflect.DeepEqual(in, wantIn) {
		t.Errorf("InputFormats = %v, want %v", in, wantIn)
	}

	// heif 别名展开：heif / heic / avif 应同时出现。
	joined := strings.Join(out, ",")
	for _, f := range []string{"heif", "heic", "avif"} {
		if !strings.Contains(joined, f) {
			t.Errorf("OutputFormats 缺少别名 %q：%v", f, out)
		}
	}
}

func TestProbe_ResetForTest_AllowsSecondProbe(t *testing.T) {
	// 先安装一套桩，记录 run 次数；调用一次 Probe。
	var calls atomic.Int32
	restore1 := withStubVips(t,
		func(string) (string, error) { return "/a", nil },
		func(ctx context.Context, name string, args ...string) ([]byte, error) {
			calls.Add(1)
			if args[0] == "--version" {
				return []byte("vips-8.0.0"), nil
			}
			return []byte(""), nil
		},
	)
	cap1 := Probe()
	if !cap1.Available {
		t.Fatalf("第一次 Probe 应 Available=true：%+v", cap1)
	}
	calls1 := calls.Load()
	restore1()

	// 安装第二套桩并重置 once；Probe 应再次触发。
	restore2 := withStubVips(t,
		func(string) (string, error) { return "/b", nil },
		func(ctx context.Context, name string, args ...string) ([]byte, error) {
			calls.Add(1)
			if args[0] == "--version" {
				return []byte("vips-9.1.0"), nil
			}
			return []byte(""), nil
		},
	)
	defer restore2()

	cap2 := Probe()
	if cap2.Version != "9.1.0" {
		t.Errorf("ResetProbeForTest 应让新桩生效，期望 9.1.0，实际 %s", cap2.Version)
	}
	if calls.Load() <= calls1 {
		t.Errorf("Reset 后应再次执行 vips 命令；calls before reset=%d after=%d", calls1, calls.Load())
	}
}
