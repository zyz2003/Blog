/*
 * @Description: IP地理位置查询服务，仅支持远程API查询。
 * @Author: 安知鱼
 * @Date: 2025-07-25 16:15:59
 * @LastEditTime: 2026-01-24 13:53:14
 * @LastEditors: 安知鱼
 */
package utility

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/anzhiyu-c/anheyu-app/pkg/constant"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/setting"
)

// GeoIPService 定义了 IP 地理位置查询服务的统一接口。
type GeoIPService interface {
	// Lookup 查询 IP 地址的地理位置
	// ipString: 要查询的 IP 地址
	// referer: 客户端请求的 Referer，用于 NSUUU API 白名单验证
	Lookup(ipString string, referer string) (location string, err error)
	// LookupFull 查询 IP 地址的完整地理位置信息（包含经纬度）
	LookupFull(ipString string, referer string) (*GeoIPResult, error)
	Close()
}

// GeoIPResult 完整的 IP 地理位置查询结果
// 与 NSUUU ipip API 响应结构一致
type GeoIPResult struct {
	IP        string `json:"ip"`
	Country   string `json:"country"`
	Province  string `json:"province"`
	City      string `json:"city"`
	ISP       string `json:"isp"`
	Latitude  string `json:"latitude"`
	Longitude string `json:"longitude"`
	Address   string `json:"address"` // API 原始返回的地址字段
}

// apiResponse 定义了远程 IP API 返回的 JSON 数据的结构。
// 适配 NSUUU ipip API（全球 IPv4/IPv6 信息查询）
// 注意：data 字段可能是对象（正常情况）或字符串（内网IP/无法识别的IP/错误信息），使用 json.RawMessage 处理
type apiResponse struct {
	Code      int             `json:"code"`
	Message   string          `json:"message"`
	Msg       string          `json:"msg"`  // 错误响应时使用 msg 字段
	Data      json.RawMessage `json:"data"` // 可能是对象或字符串
	RequestID string          `json:"request_id"`
}

// apiDataObject 定义了 data 字段为对象时的结构
type apiDataObject struct {
	IP        string `json:"ip"`
	Country   string `json:"country"`
	Province  string `json:"province"`
	City      string `json:"city"`
	ISP       string `json:"isp"`
	Latitude  string `json:"latitude"`
	Longitude string `json:"longitude"`
	Address   string `json:"address"`
}

// parseAPIData 解析 API 响应中的 data 字段
// 返回解析后的数据对象，如果 data 是字符串则返回错误
func parseAPIData(rawData json.RawMessage) (*apiDataObject, error) {
	if len(rawData) == 0 {
		return nil, fmt.Errorf("data 字段为空")
	}

	// 检查 data 是否是字符串（以引号开头）
	if rawData[0] == '"' {
		var dataStr string
		if err := json.Unmarshal(rawData, &dataStr); err == nil {
			// data 是字符串，说明是错误信息或无法识别的IP
			if dataStr == "" {
				return nil, fmt.Errorf("无效的IP地址或内网IP")
			}
			return nil, fmt.Errorf("API返回错误: %s", dataStr)
		}
	}

	// 尝试解析为对象
	var dataObj apiDataObject
	if err := json.Unmarshal(rawData, &dataObj); err != nil {
		return nil, fmt.Errorf("解析 data 字段失败: %w", err)
	}

	return &dataObj, nil
}

// smartGeoIPService 是现在唯一的服务实现，仅通过远程API查询。
type smartGeoIPService struct {
	settingSvc setting.SettingService
	httpClient *http.Client
}

// NewGeoIPService 是构造函数，注入了配置服务。
// 它不再需要数据库路径参数。
func NewGeoIPService(settingSvc setting.SettingService) (GeoIPService, error) {
	return &smartGeoIPService{
		settingSvc: settingSvc,
		httpClient: &http.Client{
			Timeout: 5 * time.Second, // 为 API 请求设置5秒超时
		},
	}, nil
}

// Lookup 是核心的查询方法，只通过 API 进行。
// referer 参数用于传递客户端请求的 Referer，以通过 NSUUU API 的白名单验证
func (s *smartGeoIPService) Lookup(ipStr string, referer string) (string, error) {
	log.Printf("[IP属地查询] 开始查询IP地址: %s, Referer: %s", ipStr, referer)

	apiURL := strings.TrimSpace(s.settingSvc.Get(constant.KeyIPAPI.String()))
	apiToken := strings.TrimSpace(s.settingSvc.Get(constant.KeyIPAPIToKen.String()))

	// 如果 API 和 Token 未配置，则直接返回错误
	if apiURL == "" || apiToken == "" {
		log.Printf("[IP属地查询] ❌ IP属地查询失败 - IP: %s, 原因: 远程API未配置 (apiURL: %s, apiToken长度: %d)",
			ipStr, apiURL, len(apiToken))
		return "未知", fmt.Errorf("IP 查询失败：远程 API 未配置")
	}

	log.Printf("[IP属地查询] API配置检查通过 - URL: %s, Token长度: %d, Token前4位: %s***", apiURL, len(apiToken), apiToken[:min(4, len(apiToken))])

	location, err := s.lookupViaAPI(apiURL, apiToken, ipStr, referer)
	if err != nil {
		// 记录错误，但返回统一的"未知"给上层调用者
		log.Printf("[IP属地查询] ❌ IP属地最终结果为'未知' - IP: %s, API调用失败: %v", ipStr, err)
		return "未知", err
	}

	log.Printf("[IP属地查询]IP属地查询成功 - IP: %s, 结果: %s", ipStr, location)
	return location, nil
}

// lookupViaAPI 封装了调用远程 API 的逻辑。
// 使用 NSUUU ipv1 API，支持 Bearer Token 认证方式
// referer 参数用于设置 Referer 请求头，以通过 NSUUU API 的白名单验证
func (s *smartGeoIPService) lookupViaAPI(apiURL, apiToken, ipStr, referer string) (string, error) {
	// 构建请求URL，只包含ip参数，key通过Header传递
	reqURL := fmt.Sprintf("%s?ip=%s", apiURL, ipStr)

	log.Printf("[IP属地查询] 准备调用第三方API - URL: %s", reqURL)

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		log.Printf("[IP属地查询] ❌ 创建HTTP请求失败 - IP: %s, 目标: %s", ipStr, reqURL)
		return "", fmt.Errorf("创建 API 请求失败: %w", err)
	}

	// 使用 Bearer Token 方式传递 API Key（推荐方式，更安全）
	req.Header.Set("Authorization", "Bearer "+apiToken)

	// 设置 Referer 请求头，用于 NSUUU API 的白名单验证
	if referer != "" {
		req.Header.Set("Referer", referer)
		log.Printf("[IP属地查询] 设置 Referer 请求头: %s", referer)
	}

	log.Printf("[IP属地查询] 发送HTTP请求到第三方API（使用Bearer Token认证）...")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[IP属地查询] ❌ HTTP请求失败 - IP: %s, 目标: %s, 错误类型: %T", ipStr, reqURL, err)
		return "", fmt.Errorf("API 请求网络错误: %w", err)
	}
	defer resp.Body.Close()

	log.Printf("[IP属地查询] 收到HTTP响应 - IP: %s, 状态码: %d", ipStr, resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		log.Printf("[IP属地查询] ❌ API返回非200状态码 - IP: %s, 状态: %s", ipStr, resp.Status)
		return "", fmt.Errorf("API 返回非 200 状态码: %s", resp.Status)
	}

	// 读取整个响应体
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应体失败: %w", err)
	}

	// 打印 API 原始返回内容，便于调试
	log.Printf("[IP属地查询] API原始返回内容 - IP: %s, 响应体: %s", ipStr, string(body))

	// 解析 API 响应
	var result apiResponse
	if err := json.Unmarshal(body, &result); err != nil {
		log.Printf("[IP属地查询] ❌ 解析API响应JSON失败 - IP: %s, 错误: %v", ipStr, err)
		return "", fmt.Errorf("解析API响应JSON失败: %w", err)
	}

	// 检查是否是错误响应（code 为负数表示错误）
	if result.Code < 0 {
		errMsg := result.Msg
		if errMsg == "" {
			errMsg = result.Message
		}
		log.Printf("[IP属地查询] ❌ API返回错误 - IP: %s, 错误码: %d, 错误信息: %s", ipStr, result.Code, errMsg)
		return "", fmt.Errorf("API错误: %s", errMsg)
	}

	if result.Code != 200 {
		log.Printf("[IP属地查询] ❌ API返回业务错误 - IP: %s, 错误码: %d, 错误信息: %s", ipStr, result.Code, result.Message)
		return "", fmt.Errorf("API 返回业务错误码: %d, 信息: %s", result.Code, result.Message)
	}

	// 解析 data 字段
	dataObj, err := parseAPIData(result.Data)
	if err != nil {
		log.Printf("[IP属地查询] ❌ 解析data字段失败 - IP: %s, 错误: %v", ipStr, err)
		return "", err
	}

	log.Printf("[IP属地查询] API响应解析成功 - IP: %s, 业务码: %d, 国家: %s, 省份: %s, 城市: %s",
		ipStr, result.Code, dataObj.Country, dataObj.Province, dataObj.City)

	province := dataObj.Province
	city := dataObj.City

	// 根据优先级组装位置信息
	var finalLocation string
	if province != "" && city != "" && province != city {
		finalLocation = fmt.Sprintf("%s %s", province, city)
		log.Printf("[IP属地查询] 使用省+市格式 - IP: %s, 结果: %s", ipStr, finalLocation)
	} else if city != "" {
		finalLocation = city
		log.Printf("[IP属地查询] 使用城市格式 - IP: %s, 结果: %s", ipStr, finalLocation)
	} else if province != "" {
		finalLocation = province
		log.Printf("[IP属地查询] 使用省份格式 - IP: %s, 结果: %s", ipStr, finalLocation)
	} else if dataObj.Country != "" {
		finalLocation = dataObj.Country
		log.Printf("[IP属地查询] 使用国家格式 - IP: %s, 结果: %s", ipStr, finalLocation)
	} else {
		log.Printf("[IP属地查询] ❌ API响应中无有效位置信息 - IP: %s, API返回的数据: 国家=%s, 省份=%s, 城市=%s",
			ipStr, dataObj.Country, dataObj.Province, dataObj.City)
		return "", fmt.Errorf("API 响应中未包含位置信息")
	}

	return finalLocation, nil
}

// LookupFull 查询 IP 地址的完整地理位置信息（包含经纬度）
// referer 参数用于传递客户端请求的 Referer，以通过 NSUUU API 的白名单验证
func (s *smartGeoIPService) LookupFull(ipStr string, referer string) (*GeoIPResult, error) {
	log.Printf("[IP属地查询-完整] 开始查询IP地址: %s, Referer: %s", ipStr, referer)

	apiURL := strings.TrimSpace(s.settingSvc.Get(constant.KeyIPAPI.String()))
	apiToken := strings.TrimSpace(s.settingSvc.Get(constant.KeyIPAPIToKen.String()))

	if apiURL == "" || apiToken == "" {
		log.Printf("[IP属地查询-完整] ❌ 远程API未配置 (apiURL: %s, apiToken长度: %d)", apiURL, len(apiToken))
		return nil, fmt.Errorf("IP 查询失败：远程 API 未配置")
	}

	log.Printf("[IP属地查询-完整] API配置 - URL: %s, Token长度: %d, Token前4位: %s***", apiURL, len(apiToken), apiToken[:min(4, len(apiToken))])

	// 构建请求URL
	reqURL := fmt.Sprintf("%s?ip=%s", apiURL, ipStr)

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建 API 请求失败: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiToken)
	if referer != "" {
		req.Header.Set("Referer", referer)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API 请求网络错误: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API 返回非 200 状态码: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应体失败: %w", err)
	}

	log.Printf("[IP属地查询-完整] API原始返回内容 - IP: %s, 响应体: %s", ipStr, string(body))

	// 解析 API 响应
	var result apiResponse
	if err := json.Unmarshal(body, &result); err != nil {
		log.Printf("[IP属地查询-完整] ❌ 解析API响应JSON失败 - IP: %s, 错误: %v, 响应体: %s", ipStr, err, string(body))
		return nil, fmt.Errorf("解析API响应JSON失败: %w", err)
	}

	// 检查是否是错误响应（code 为负数表示错误）
	if result.Code < 0 {
		errMsg := result.Msg
		if errMsg == "" {
			errMsg = result.Message
		}
		log.Printf("[IP属地查询-完整] ❌ API返回错误 - IP: %s, 错误码: %d, 错误信息: %s", ipStr, result.Code, errMsg)
		return nil, fmt.Errorf("API错误: %s", errMsg)
	}

	if result.Code != 200 {
		log.Printf("[IP属地查询-完整] ❌ API返回业务错误 - IP: %s, 错误码: %d, 错误信息: %s", ipStr, result.Code, result.Message)
		return nil, fmt.Errorf("API 返回业务错误码: %d, 信息: %s", result.Code, result.Message)
	}

	// 解析 data 字段
	dataObj, err := parseAPIData(result.Data)
	if err != nil {
		log.Printf("[IP属地查询-完整] ❌ 解析data字段失败 - IP: %s, 错误: %v", ipStr, err)
		return nil, err
	}

	log.Printf("[IP属地查询-完整] ✅ 查询成功 - IP: %s, 国家: %s, 省份: %s, 城市: %s",
		ipStr, dataObj.Country, dataObj.Province, dataObj.City)

	return &GeoIPResult{
		IP:        dataObj.IP,
		Country:   dataObj.Country,
		Province:  dataObj.Province,
		City:      dataObj.City,
		ISP:       dataObj.ISP,
		Latitude:  dataObj.Latitude,
		Longitude: dataObj.Longitude,
		Address:   dataObj.Address,
	}, nil
}

// Close 在这个实现中不需要做任何事，但为了满足接口要求而保留。
func (s *smartGeoIPService) Close() {
	// httpClient 不需要显式关闭
}
