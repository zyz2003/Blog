/*
 * @Description: 音乐处理器 - 提供音乐相关的RESTful API端点
 * @Author: 安知鱼
 * @Date: 2025-09-22 15:30:00
 */
package music_handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/anzhiyu-c/anheyu-app/pkg/response"
	"github.com/anzhiyu-c/anheyu-app/pkg/service/music"
)

// MusicHandler 音乐处理器
type MusicHandler struct {
	musicSvc music.MusicService
}

// NewMusicHandler 创建新的音乐处理器
func NewMusicHandler(musicSvc music.MusicService) *MusicHandler {
	return &MusicHandler{
		musicSvc: musicSvc,
	}
}

// GetPlaylist 获取播放列表
// @Summary      获取音乐播放列表
// @Description  获取配置的音乐播放列表，支持缓存参数防止缓存
// @Tags         音乐播放
// @Produce      json
// @Param        r  query  string  false  "随机参数，用于防止缓存"
// @Success      200  {object}  response.Response{data=object{songs=[]music.Song,total=int}}  "获取成功"
// @Failure      500  {object}  response.Response  "服务器错误"
// @Router       /public/music/playlist [get]
func (h *MusicHandler) GetPlaylist(c *gin.Context) {
	// 获取播放列表
	songs, err := h.musicSvc.FetchPlaylist(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取播放列表失败: "+err.Error())
		return
	}

	// 返回成功响应
	response.Success(c, gin.H{
		"songs": songs,
		"total": len(songs),
	}, "获取播放列表成功")
}

// GetSongResources 获取歌曲资源（音频和歌词）
// @Summary      获取歌曲资源
// @Description  根据网易云歌曲ID获取音频URL和歌词内容，自动尝试高质量资源
// @Tags         音乐播放
// @Accept       json
// @Produce      json
// @Param        body  body  GetSongResourcesRequest  true  "网易云歌曲ID"
// @Success      200  {object}  response.Response{data=music.SongResourceResponse}  "获取成功"
// @Failure      400  {object}  response.Response  "请求参数错误"
// @Failure      500  {object}  response.Response  "服务器错误"
// @Router       /public/music/song-resources [post]
func (h *MusicHandler) GetSongResources(c *gin.Context) {
	var req GetSongResourcesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, "请求参数错误: "+err.Error())
		return
	}

	// 构建歌曲对象，只需要NeteaseID
	song := music.Song{
		NeteaseID: req.NeteaseID,
	}

	// 获取歌曲资源
	resources, err := h.musicSvc.FetchSongResources(c.Request.Context(), song)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, "获取歌曲资源失败: "+err.Error())
		return
	}

	// 返回成功响应
	response.Success(c, resources, "获取歌曲资源成功")
}

// GetSongResourcesRequest 获取歌曲资源的请求结构
type GetSongResourcesRequest struct {
	NeteaseID string `json:"neteaseId" binding:"required"`
}
