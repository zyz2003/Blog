// anheyu-app/pkg/service/utility/color.go
package utility

import (
	"bytes"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/EdlinOrg/prominentcolor"
	_ "golang.org/x/image/webp"
)

type ColorService struct {
	vipsAvailable bool
}

func NewColorService() *ColorService {
	vipsAvailable := checkVipsAvailability()
	if vipsAvailable {
		log.Println("[ColorService] 初始化颜色服务：检测到VIPS，支持AVIF等现代图像格式。使用 'prominentcolor' (K-Means算法) 来查找主色调。")
	} else {
		log.Println("[ColorService] 初始化颜色服务：未检测到VIPS，使用标准图像库。使用 'prominentcolor' (K-Means算法) 来查找主色调。")
	}
	return &ColorService{
		vipsAvailable: vipsAvailable,
	}
}

// checkVipsAvailability 检查系统中是否可用VIPS
func checkVipsAvailability() bool {
	_, err := exec.LookPath("vips")
	return err == nil
}

func (s *ColorService) GetPrimaryColor(reader io.Reader) (string, error) {
	imgData, err := io.ReadAll(reader)
	if err != nil {
		return "", fmt.Errorf("读取图片数据失败: %w", err)
	}

	// 尝试使用标准库解码
	img, format, err := image.Decode(bytes.NewReader(imgData))

	// 如果标准库解码失败且VIPS可用，尝试使用VIPS解码
	if err != nil && s.vipsAvailable {
		log.Printf("[ColorService] 标准库解码失败 (%v)，尝试使用VIPS解码", err)
		img, err = s.decodeWithVips(imgData)
		if err != nil {
			return "", fmt.Errorf("VIPS解码也失败: %w", err)
		}
		log.Printf("[ColorService] VIPS解码成功")
	} else if err != nil {
		return "", fmt.Errorf("解码图片失败: %w", err)
	} else {
		log.Printf("[ColorService] 标准库解码成功，格式: %s", format)
	}

	colors, err := prominentcolor.KmeansWithArgs(
		1,
		img,
	)
	if err != nil {
		return "", fmt.Errorf("使用 prominentcolor (K-Means) 提取主色调失败: %w", err)
	}

	if len(colors) == 0 {
		return "", fmt.Errorf("prominentcolor (K-Means) 未能找到任何主色调")
	}

	dominantColor := colors[0].Color

	return fmt.Sprintf("#%02x%02x%02x", dominantColor.R, dominantColor.G, dominantColor.B), nil
}

// decodeWithVips 使用VIPS将图像转换为标准格式然后解码
func (s *ColorService) decodeWithVips(imgData []byte) (image.Image, error) {
	if !s.vipsAvailable {
		return nil, fmt.Errorf("VIPS不可用")
	}

	// 创建临时文件
	tmpDir := os.TempDir()
	inputFile := filepath.Join(tmpDir, fmt.Sprintf("color_input_%d", os.Getpid()))
	outputFile := filepath.Join(tmpDir, fmt.Sprintf("color_output_%d.jpg", os.Getpid()))

	// 确保清理临时文件
	defer func() {
		os.Remove(inputFile)
		os.Remove(outputFile)
	}()

	// 写入输入文件
	if err := os.WriteFile(inputFile, imgData, 0644); err != nil {
		return nil, fmt.Errorf("写入临时文件失败: %w", err)
	}

	// 使用VIPS转换为JPEG格式
	cmd := exec.Command("vips", "copy", inputFile, outputFile+"[Q=95]")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("VIPS转换失败: %w, stderr: %s", err, stderr.String())
	}

	// 读取转换后的文件
	convertedData, err := os.ReadFile(outputFile)
	if err != nil {
		return nil, fmt.Errorf("读取转换后文件失败: %w", err)
	}

	// 使用标准库解码转换后的JPEG
	img, _, err := image.Decode(bytes.NewReader(convertedData))
	if err != nil {
		return nil, fmt.Errorf("解码转换后图片失败: %w", err)
	}

	return img, nil
}
