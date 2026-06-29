/*
 * @Description: vips CLI 能力探测
 * @Author: 安知鱼
 *
 * Phase 2 Task 2.1：真实探测 vips CLI。
 *
 * 探测步骤：
 *  1. exec.LookPath("vips") 找可执行文件；找不到直接返回 Available: false。
 *  2. `vips --version` 解析版本号（形如 `vips-8.18.2`）。
 *  3. `vips -l` 解析输出中的 VipsForeignLoad* / VipsForeignSave* 类名，
 *     提取支持的格式列表（去后缀 File/Buffer/Source/Target，转小写并归一化）。
 *
 * 探测结果进程级缓存（sync.Once），避免启动阶段反复 fork。
 * 为可测试性，exec.LookPath / exec.Command 通过包变量暴露，测试可注入桩函数。
 */
package engine

import (
	"bufio"
	"context"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"time"
)

// vipsLookPath 在运行时查找 vips 可执行文件。测试可注入桩。
var vipsLookPath = exec.LookPath

// vipsRunCommand 用给定二进制和参数执行命令，返回合并后的 stdout+stderr。
// 测试可注入桩，避免依赖真实 vips。
var vipsRunCommand = func(ctx context.Context, name string, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, name, args...).CombinedOutput()
}

// probeTimeout 限定每次 vips 探测子命令的执行时长，防止启动阻塞。
const probeTimeout = 5 * time.Second

var (
	probeOnce   sync.Once
	probeResult VipsCapability
)

// Probe 返回本机 vips CLI 的探测结果。结果在进程内缓存，重复调用零开销。
// Phase 2 前返回固定 Available: false，Phase 2 起真实执行命令。
func Probe() VipsCapability {
	probeOnce.Do(func() {
		probeResult = probeNow()
	})
	return probeResult
}

// ResetProbeForTest 仅供测试使用：重置探测缓存，允许重复调用 Probe。
func ResetProbeForTest() {
	probeOnce = sync.Once{}
	probeResult = VipsCapability{}
}

// probeNow 执行一次真实探测，不走缓存。
func probeNow() VipsCapability {
	bin, err := vipsLookPath("vips")
	if err != nil || bin == "" {
		return VipsCapability{Available: false}
	}

	ctx, cancel := context.WithTimeout(context.Background(), probeTimeout)
	defer cancel()
	verOut, err := vipsRunCommand(ctx, bin, "--version")
	if err != nil {
		// 找到了 vips 但 --version 失败，保守返回不可用（但带上路径便于排查）。
		return VipsCapability{Available: false, BinaryPath: bin}
	}
	version := parseVipsVersion(string(verOut))

	ctx2, cancel2 := context.WithTimeout(context.Background(), probeTimeout)
	defer cancel2()
	listOut, err := vipsRunCommand(ctx2, bin, "-l")
	var inputs, outputs []string
	if err == nil {
		inputs, outputs = parseVipsForeignClasses(string(listOut))
	}
	return VipsCapability{
		Available:     true,
		BinaryPath:    bin,
		Version:       version,
		InputFormats:  inputs,
		OutputFormats: outputs,
	}
}

var vipsVersionRe = regexp.MustCompile(`vips-(\d+\.\d+(?:\.\d+)?)`)

// parseVipsVersion 从 `vips --version` 输出中抽取语义版本号。
// 匹配不到时退回去掉空白的整行（至少留个原始信息便于日志显示）。
func parseVipsVersion(s string) string {
	m := vipsVersionRe.FindStringSubmatch(s)
	if len(m) >= 2 {
		return m[1]
	}
	return strings.TrimSpace(s)
}

// parseVipsForeignClasses 从 `vips -l` 输出中提取支持的输入/输出格式。
// 输出遵循"首次出现顺序"，且互相去重。
//
// 解析规则：
//   - 包含 `VipsForeignLoad<Xxx>` → Xxx 去 File/Buffer/Source 后小写 → 输入格式
//   - 包含 `VipsForeignSave<Xxx>` → Xxx 去 File/Buffer/Target 后小写 → 输出格式
//   - 归一化：heif / heic 同类，额外加别名；jpeg 统一为 jpeg（外部可再映射 jpg）
func parseVipsForeignClasses(out string) (inputs, outputs []string) {
	inSeen := map[string]struct{}{}
	outSeen := map[string]struct{}{}

	addInput := func(fmt string) {
		for _, alias := range expandFormatAliases(fmt) {
			if _, ok := inSeen[alias]; ok {
				continue
			}
			inSeen[alias] = struct{}{}
			inputs = append(inputs, alias)
		}
	}
	addOutput := func(fmt string) {
		for _, alias := range expandFormatAliases(fmt) {
			if _, ok := outSeen[alias]; ok {
				continue
			}
			outSeen[alias] = struct{}{}
			outputs = append(outputs, alias)
		}
	}

	sc := bufio.NewScanner(strings.NewReader(out))
	// 默认 Buffer 是 64KB，对 `vips -l` 偶尔会爆；直接放大到 1MB 保险。
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for sc.Scan() {
		line := sc.Text()
		if idx := strings.Index(line, "VipsForeignLoad"); idx >= 0 {
			name := extractFormatFromClassName(line[idx:], "VipsForeignLoad")
			addInput(name)
		}
		if idx := strings.Index(line, "VipsForeignSave"); idx >= 0 {
			name := extractFormatFromClassName(line[idx:], "VipsForeignSave")
			addOutput(name)
		}
	}
	return inputs, outputs
}

// extractFormatFromClassName 从形如 "VipsForeignLoadPngFile (...), ..." 的片段中
// 抽取 "png"（已去除 File/Buffer/Source/Target 后缀并转小写）。
func extractFormatFromClassName(fragment, prefix string) string {
	if !strings.HasPrefix(fragment, prefix) {
		return ""
	}
	tail := fragment[len(prefix):]
	end := len(tail)
	for i, c := range tail {
		// 类名以大写字母开头，一直到第一个空格/逗号/括号截止。
		if c == ' ' || c == ',' || c == '(' {
			end = i
			break
		}
	}
	name := tail[:end]
	for _, suffix := range []string{"File", "Buffer", "Source", "Target"} {
		name = strings.TrimSuffix(name, suffix)
	}
	return strings.ToLower(name)
}

// expandFormatAliases 把 vips 类名解析出来的格式名拓展成内部使用的标识集合。
// 例如 `heif` 在 vips 里实际覆盖 heic/heif/avif 三者，这里统一展开以便上层 AutoEngine
// 和诊断日志能给出直观的"支持哪些格式"视图。
func expandFormatAliases(name string) []string {
	switch name {
	case "":
		return nil
	case "jpeg":
		// vips 类名是 Jpeg；我们内部同时使用 jpeg/jpg 两个别名。
		return []string{"jpeg", "jpg"}
	case "heif":
		// libheif 既能处理 heic/heif 也能处理 avif（若编译时包含 av1 支持）。
		return []string{"heif", "heic", "avif"}
	case "nsgif":
		return []string{"gif"}
	case "jp2k":
		return []string{"jp2k", "jp2"}
	default:
		return []string{name}
	}
}
