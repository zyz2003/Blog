/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2025-06-25 16:11:37
 * @LastEditTime: 2025-06-25 16:13:47
 * @LastEditors: 安知鱼
 */
package uri

import (
	"errors"
	"net/url"
	"strings"
)

// ParsedURI 用于存放从字符串中解析出的结构化信息
type ParsedURI struct {
	FSType   string // 文件系统类型, e.g., "my", "trash"
	FSID     string // 文件系统ID, e.g., 用户ID, 分享ID
	Password string // 访问密码
	Path     string // 文件路径
	Query    url.Values
}

// Parse 将一个符合 anzhiyu 规范的 URI 字符串解析为结构体
func Parse(uriStr string) (*ParsedURI, error) {
	parsed, err := url.Parse(uriStr)
	if err != nil {
		return nil, errors.New("无效的 URI 格式")
	}

	if parsed.Scheme != "anzhiyu" {
		return nil, errors.New("只支持 'anzhiyu' 协议")
	}

	password, _ := parsed.User.Password()

	// 路径需要进行标准化，确保以 "/" 开头，并移除尾部的 "/" (如果存在)
	path := parsed.Path
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if len(path) > 1 {
		path = strings.TrimRight(path, "/")
	}

	return &ParsedURI{
		FSType:   parsed.Host,
		FSID:     parsed.User.Username(),
		Password: password,
		Path:     path,
		Query:    parsed.Query(),
	}, nil
}
