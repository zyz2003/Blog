/*
 * @Description: 插件管理器 - 发现、加载、热重载和管理运行时插件进程
 * @Author: 安知鱼
 * @Date: 2026-04-09
 */
package plugin

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/domain/model"
	"github.com/fsnotify/fsnotify"
	goplugin "github.com/hashicorp/go-plugin"
)

// PluginStatus 描述插件运行状态
type PluginStatus string

const (
	StatusRunning  PluginStatus = "running"
	StatusStopped  PluginStatus = "stopped"
	StatusError    PluginStatus = "error"
	StatusDisabled PluginStatus = "disabled"
)

// PluginInfo 包含插件元信息和运行时状态
type PluginInfo struct {
	Metadata Metadata     `json:"metadata"`
	Status   PluginStatus `json:"status"`
	FileName string       `json:"file_name"`
	FilePath string       `json:"-"` // 内部使用，不序列化到 JSON（避免暴露服务器路径）
	Error    string       `json:"error,omitempty"`
	LoadedAt time.Time    `json:"loaded_at,omitempty"`
}

// Manager 管理所有运行时加载的插件
type Manager struct {
	mu        sync.RWMutex
	clients   map[string]*goplugin.Client
	searchers map[string]model.Searcher // 缓存已初始化的搜索器引用
	info      map[string]*PluginInfo
	disabled  map[string]bool
	pluginDir string
	watcher   *fsnotify.Watcher
	stopCh    chan struct{}
	stopped   bool

	onSearcherChange func(model.Searcher)
}

// NewManager 创建插件管理器
func NewManager(pluginDir string) *Manager {
	return &Manager{
		clients:   make(map[string]*goplugin.Client),
		searchers: make(map[string]model.Searcher),
		info:      make(map[string]*PluginInfo),
		disabled:  make(map[string]bool),
		pluginDir: pluginDir,
		stopCh:    make(chan struct{}),
	}
}

// SetSearcherChangeCallback 设置搜索引擎切换回调（插件加载/卸载时通知主程序）
func (m *Manager) SetSearcherChangeCallback(cb func(model.Searcher)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.onSearcherChange = cb
}

// DiscoverAndLoad 扫描插件目录，加载所有可执行插件
func (m *Manager) DiscoverAndLoad() error {
	if m.pluginDir == "" {
		log.Println("[Plugin] 未配置插件目录，跳过插件发现")
		return nil
	}

	if err := os.MkdirAll(m.pluginDir, 0755); err != nil {
		return fmt.Errorf("创建插件目录失败: %w", err)
	}

	entries, err := os.ReadDir(m.pluginDir)
	if err != nil {
		return fmt.Errorf("读取插件目录失败: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !isExecutable(entry.Name()) {
			continue
		}
		pluginPath := filepath.Join(m.pluginDir, entry.Name())
		if err := m.loadPlugin(pluginPath); err != nil {
			log.Printf("[Plugin] ⚠️ 加载插件 %s 失败: %v", entry.Name(), err)
		}
	}

	return nil
}

// StartWatcher 启动文件监听，实现插件热重载
func (m *Manager) StartWatcher() error {
	if m.pluginDir == "" {
		return nil
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("创建文件监听器失败: %w", err)
	}
	m.watcher = watcher

	if err := watcher.Add(m.pluginDir); err != nil {
		watcher.Close()
		return fmt.Errorf("监听插件目录失败: %w", err)
	}

	go m.watchLoop()
	log.Printf("[Plugin] 🔄 已启动插件目录热监听: %s", m.pluginDir)
	return nil
}

func (m *Manager) watchLoop() {
	const debounceInterval = 2 * time.Second
	const loadDelay = 500 * time.Millisecond

	debounce := make(map[string]time.Time)

	for {
		select {
		case event, ok := <-m.watcher.Events:
			if !ok {
				return
			}

			if !isExecutable(filepath.Base(event.Name)) {
				continue
			}

			now := time.Now()
			if last, exists := debounce[event.Name]; exists && now.Sub(last) < debounceInterval {
				continue
			}
			debounce[event.Name] = now

			// 定期清理 debounce map，避免内存泄漏
			if len(debounce) > 100 {
				for k, v := range debounce {
					if now.Sub(v) > 30*time.Second {
						delete(debounce, k)
					}
				}
			}

			// 使用异步 goroutine 处理加载，避免 sleep 阻塞事件循环
			switch {
			case event.Has(fsnotify.Create):
				log.Printf("[Plugin] 检测到新插件: %s", filepath.Base(event.Name))
				go m.delayedLoad(event.Name, loadDelay)

			case event.Has(fsnotify.Write):
				log.Printf("[Plugin] 检测到插件更新: %s", filepath.Base(event.Name))
				go m.delayedReload(event.Name, loadDelay)

			case event.Has(fsnotify.Remove), event.Has(fsnotify.Rename):
				log.Printf("[Plugin] 检测到插件移除: %s", filepath.Base(event.Name))
				m.unloadPluginByPath(event.Name)
				m.notifySearcherChange()
			}

		case err, ok := <-m.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("[Plugin] 文件监听错误: %v", err)

		case <-m.stopCh:
			return
		}
	}
}

// delayedLoad 延迟加载新插件（等待文件写入完成）
func (m *Manager) delayedLoad(path string, delay time.Duration) {
	time.Sleep(delay)
	if err := m.loadPlugin(path); err != nil {
		log.Printf("[Plugin] 加载新插件失败: %v", err)
	} else {
		m.notifySearcherChange()
	}
}

// delayedReload 延迟重载插件（等待文件写入完成）
func (m *Manager) delayedReload(path string, delay time.Duration) {
	time.Sleep(delay)
	m.reloadPlugin(path)
	m.notifySearcherChange()
}

func (m *Manager) notifySearcherChange() {
	m.mu.RLock()
	cb := m.onSearcherChange
	m.mu.RUnlock()

	if cb != nil {
		cb(m.BestSearcher())
	}
}

// loadPlugin 加载单个插件二进制
func (m *Manager) loadPlugin(path string) error {
	client := goplugin.NewClient(&goplugin.ClientConfig{
		HandshakeConfig:  Handshake,
		Plugins:          PluginMap,
		Cmd:              exec.Command(path),
		AllowedProtocols: []goplugin.Protocol{goplugin.ProtocolNetRPC},
	})

	rpcClient, err := client.Client()
	if err != nil {
		client.Kill()
		m.setPluginError(path, err)
		return fmt.Errorf("连接插件进程失败: %w", err)
	}

	raw, err := rpcClient.Dispense("searcher")
	if err != nil {
		client.Kill()
		m.setPluginError(path, err)
		return fmt.Errorf("获取插件接口失败: %w", err)
	}

	searcherClient, ok := raw.(*SearcherRPCClient)
	if !ok {
		client.Kill()
		return fmt.Errorf("插件未实现 Searcher 接口")
	}

	meta := searcherClient.GetMetadata()
	if meta.ID == "" {
		meta.ID = filepath.Base(path)
		meta.Name = meta.ID
	}

	m.mu.Lock()
	if old, exists := m.clients[meta.ID]; exists {
		old.Kill()
	}
	m.clients[meta.ID] = client
	m.searchers[meta.ID] = searcherClient
	m.info[meta.ID] = &PluginInfo{
		Metadata: meta,
		Status:   StatusRunning,
		FileName: filepath.Base(path),
		FilePath: path,
		LoadedAt: time.Now(),
	}
	m.mu.Unlock()

	log.Printf("[Plugin] ✅ 已加载: %s v%s - %s", meta.Name, meta.Version, meta.Description)
	return nil
}

func (m *Manager) setPluginError(path string, err error) {
	id := filepath.Base(path)
	m.mu.Lock()
	defer m.mu.Unlock()
	m.info[id] = &PluginInfo{
		Metadata: Metadata{ID: id, Name: id},
		Status:   StatusError,
		FileName: filepath.Base(path),
		FilePath: path,
		Error:    err.Error(),
	}
}

// reloadPlugin 重新加载指定路径的插件
// loadPlugin 内部会自动替换同 ID 的旧客户端（先启动新进程再 Kill 旧进程），
// 因此无需手动先卸载再加载
func (m *Manager) reloadPlugin(path string) {
	if err := m.loadPlugin(path); err != nil {
		log.Printf("[Plugin] 重新加载插件失败: %v", err)
	}
}

// unloadPluginByPath 按文件路径卸载插件
func (m *Manager) unloadPluginByPath(path string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, info := range m.info {
		if info.FilePath == path {
			if client, exists := m.clients[id]; exists {
				client.Kill()
				delete(m.clients, id)
			}
			delete(m.searchers, id)
			info.Status = StatusStopped
			log.Printf("[Plugin] 已卸载: %s", id)
			return
		}
	}
}

// ReloadByID 按 ID 重新加载插件（供管理 API 调用）
func (m *Manager) ReloadByID(id string) error {
	m.mu.RLock()
	info, exists := m.info[id]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("插件 %s 不存在", id)
	}

	m.reloadPlugin(info.FilePath)
	m.notifySearcherChange()
	return nil
}

// DisableByID 禁用插件（供管理 API 调用）
func (m *Manager) DisableByID(id string) error {
	m.mu.Lock()

	info, exists := m.info[id]
	if !exists {
		m.mu.Unlock()
		return fmt.Errorf("插件 %s 不存在", id)
	}

	if client, exists := m.clients[id]; exists {
		client.Kill()
		delete(m.clients, id)
	}
	delete(m.searchers, id)
	info.Status = StatusDisabled
	m.disabled[id] = true
	m.mu.Unlock()

	m.notifySearcherChange()
	return nil
}

// EnableByID 启用已禁用的插件
func (m *Manager) EnableByID(id string) error {
	m.mu.Lock()
	info, exists := m.info[id]
	disabled := m.disabled[id]
	delete(m.disabled, id)
	m.mu.Unlock()

	if !exists {
		return fmt.Errorf("插件 %s 不存在", id)
	}
	if !disabled {
		return fmt.Errorf("插件 %s 未被禁用", id)
	}

	if err := m.loadPlugin(info.FilePath); err != nil {
		return err
	}
	m.notifySearcherChange()
	return nil
}

// BestSearcher 返回最佳搜索引擎（使用缓存的引用，避免重复创建 RPC 连接）
func (m *Manager) BestSearcher() model.Searcher {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for id, searcher := range m.searchers {
		if m.disabled[id] {
			continue
		}
		if searcher != nil {
			return searcher
		}
	}
	return nil
}

// List 返回所有插件的信息
func (m *Manager) List() []PluginInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]PluginInfo, 0, len(m.info))
	for _, info := range m.info {
		result = append(result, *info)
	}
	return result
}

// Shutdown 关闭所有插件进程和文件监听（可安全多次调用）
func (m *Manager) Shutdown() {
	m.mu.Lock()
	if m.stopped {
		m.mu.Unlock()
		return
	}
	m.stopped = true
	m.mu.Unlock()

	close(m.stopCh)

	if m.watcher != nil {
		m.watcher.Close()
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	for id, client := range m.clients {
		log.Printf("[Plugin] 关闭插件: %s", id)
		client.Kill()
	}
	m.clients = make(map[string]*goplugin.Client)
	m.searchers = make(map[string]model.Searcher)
	log.Println("[Plugin] 所有插件已关闭")
}

var nonExecExts = map[string]bool{
	".md": true, ".txt": true, ".log": true, ".json": true,
	".yaml": true, ".yml": true, ".toml": true, ".ini": true,
	".conf": true, ".cfg": true, ".bak": true, ".tmp": true,
}

// isExecutable 判断文件是否可能是插件可执行文件（排除常见非可执行文件）
func isExecutable(name string) bool {
	if runtime.GOOS == "windows" {
		return filepath.Ext(name) == ".exe"
	}
	ext := filepath.Ext(name)
	if ext == ".so" {
		return true
	}
	if nonExecExts[ext] {
		return false
	}
	if name[0] == '.' {
		return false
	}
	return ext == ""
}

// StartHealthCheck 定期检查插件健康状态，自动重启崩溃的插件
func (m *Manager) StartHealthCheck(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				m.checkHealth()
			case <-m.stopCh:
				return
			}
		}
	}()
	log.Printf("[Plugin] 已启动健康检查（间隔 %v）", interval)
}

func (m *Manager) checkHealth() {
	m.mu.RLock()
	type checkTarget struct {
		id       string
		searcher model.Searcher
	}
	var targets []checkTarget
	for id, info := range m.info {
		if info.Status != StatusRunning || m.disabled[id] {
			continue
		}
		if s, exists := m.searchers[id]; exists && s != nil {
			targets = append(targets, checkTarget{id: id, searcher: s})
		}
	}
	m.mu.RUnlock()

	if len(targets) == 0 {
		return
	}

	// 并行执行健康检查
	type result struct {
		id  string
		err error
	}
	results := make(chan result, len(targets))
	for _, t := range targets {
		go func(t checkTarget) {
			results <- result{id: t.id, err: t.searcher.HealthCheck(context.Background())}
		}(t)
	}

	var toRestart []string
	for range targets {
		r := <-results
		if r.err != nil {
			log.Printf("[Plugin] 插件 %s 健康检查失败: %v，将尝试重启", r.id, r.err)
			toRestart = append(toRestart, r.id)
		}
	}

	for _, id := range toRestart {
		m.mu.RLock()
		info := m.info[id]
		m.mu.RUnlock()
		if info != nil {
			m.reloadPlugin(info.FilePath)
			m.notifySearcherChange()
		}
	}
}

// --- 全局管理器 ---

var defaultManager *Manager

// InitManager 初始化全局插件管理器
func InitManager(pluginDir string) (*Manager, error) {
	defaultManager = NewManager(pluginDir)
	if err := defaultManager.DiscoverAndLoad(); err != nil {
		return defaultManager, err
	}
	if err := defaultManager.StartWatcher(); err != nil {
		log.Printf("[Plugin] 启动文件监听失败: %v", err)
	}
	defaultManager.StartHealthCheck(60 * time.Second)
	return defaultManager, nil
}

// DefaultManager 返回全局默认管理器
func DefaultManager() *Manager {
	return defaultManager
}
