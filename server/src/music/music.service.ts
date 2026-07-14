import { Inject, Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { MemoryCache } from '../common/cache/memory-cache.util';
import { ErrorCodes } from '../common/constants/error-codes';
import * as https from 'https';
import * as http from 'http';

// ── Types ──────────────────────────────────────────────────────────────

export interface Song {
  id: string;
  neteaseId: string;
  name: string;
  artist: string;
  url: string;
  pic: string;
  lrc: string;
}

export interface SongResourceResponse {
  audioUrl: string;
  lyricsText: string;
}

/** Nested structure matching metings Playlist API response */
interface PlaylistApiResponse {
  data: {
    playlist: {
      coverImgUrl: string;
      creator: string;
      description: string;
      id: number;
      name: string;
      trackCount: number;
      tracks: {
        album: string;
        artists: string;
        id: number;
        name: string;
        picUrl: string;
      }[];
    };
  };
}

/** Song_V1 API response structure */
interface SongV1ApiResponse {
  status: number;
  success: boolean;
  message: string;
  data: {
    id: string;
    name: string;
    ar_name: string;
    al_name: string;
    pic: string;
    url: string;
    lyric: string;
    tlyric: string;
    level: string;
    size: string;
  };
}

// ── Service ────────────────────────────────────────────────────────────

@Injectable()
export class MusicService {
  private readonly logger = new Logger(MusicService.name);

  /** Reusable HTTPS agent with SSL verification disabled (per D-210) */
  private readonly insecureAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  /** 15-second timeout matching Go's http.Client timeout */
  private readonly requestTimeout = 15_000;

  constructor(
    private readonly settingsService: SettingsService,
    @Inject(MemoryCache) private readonly cache: MemoryCache,
  ) {}

  // ── Public Methods ─────────────────────────────────────────────────

  /**
   * Fetch playlist from metings API with 5-minute cache (per D-211).
   * Cache key: `music:playlist`, TTL: 300000ms.
   */
  async fetchPlaylist(): Promise<Song[]> {
    const cacheKey = 'music:playlist';
    const cached = this.cache.get<Song[]>(cacheKey);
    if (cached) {
      this.logger.debug('Playlist served from cache');
      return cached;
    }

    const apiBaseURL = this.getApiBaseURL();
    const playlistId = this.getPlaylistId();
    const playlistURL = `${apiBaseURL}/Playlist?id=${playlistId}`;

    this.logger.log('开始获取播放列表 - 播放列表ID: ' + playlistId);
    this.logRequest('GET', playlistURL, null);

    const startTime = Date.now();

    try {
      const responseBody = await this.httpGet(playlistURL);
      const duration = Date.now() - startTime;
      this.logResponse(playlistURL, 200, responseBody, duration);

      const apiResponse: PlaylistApiResponse = JSON.parse(responseBody);
      const tracks = apiResponse.data.playlist.tracks;

      if (!tracks || tracks.length === 0) {
        this.logger.log('播放列表为空');
        const empty: Song[] = [];
        this.cache.set(cacheKey, empty, 300_000);
        return empty;
      }

      const songs: Song[] = [];
      let validCount = 0;

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (!track.name || !track.artists || track.id === 0) {
          this.logger.debug(`跳过无效歌曲数据，索引: ${i}`);
          continue;
        }

        const songId = String(track.id);
        songs.push({
          id: songId,
          neteaseId: songId,
          name: track.name,
          artist: track.artists,
          url: '',
          pic: track.picUrl || '',
          lrc: '',
        });
        validCount++;
      }

      this.logger.log(
        `播放列表解析完成 - 播放列表: ${apiResponse.data.playlist.name}, 总数: ${tracks.length}, 有效: ${validCount}`,
      );

      // Cache for 5 minutes (per D-211)
      this.cache.set(cacheKey, songs, 300_000);
      return songs;
    } catch (error) {
      this.logError('获取播放列表', playlistURL, error);
      throw new InternalServerErrorException(
        ErrorCodes.MUSIC_PLAYLIST_FETCH_FAILED,
      );
    }
  }

  /**
   * Fetch song resources (audio URL + lyrics) with quality fallback.
   * Per D-209: validate NeteaseID, try exhigh first, fallback to standard.
   */
  async fetchSongResources(neteaseId: string): Promise<SongResourceResponse> {
    this.logger.log(`开始获取歌曲资源 - 网易云ID: ${neteaseId}`);

    // Validate NeteaseID (per D-209)
    if (!this.isValidNeteaseID(neteaseId)) {
      throw new BadRequestException(ErrorCodes.MUSIC_INVALID_NETEASE_ID);
    }

    // Try exhigh quality first
    this.logger.log(`尝试获取 exhigh 音质 - 网易云ID: ${neteaseId}`);
    let response: SongResourceResponse;
    try {
      response = await this.fetchSongV1(neteaseId, 'exhigh');
    } catch (err) {
      this.logger.log(
        `exhigh 音质获取失败，尝试 standard 音质 - 网易云ID: ${neteaseId}`,
      );
      // Fallback to standard quality
      try {
        response = await this.fetchSongV1(neteaseId, 'standard');
      } catch (err2) {
        this.logger.error(
          `standard 音质获取失败 - 网易云ID: ${neteaseId}`,
        );
        throw new InternalServerErrorException(
          ErrorCodes.MUSIC_SONG_RESOURCE_FAILED,
        );
      }
    }

    // If exhigh returned empty audioUrl, try standard
    if (response.audioUrl === '') {
      this.logger.log(
        `exhigh 音质返回空，尝试 standard 音质 - 网易云ID: ${neteaseId}`,
      );
      try {
        const fallback = await this.fetchSongV1(neteaseId, 'standard');
        if (fallback.audioUrl !== '') {
          response = fallback;
        }
      } catch (err) {
        this.logger.error(
          `standard 音质获取失败 - 网易云ID: ${neteaseId}`,
        );
        throw new InternalServerErrorException(
          ErrorCodes.MUSIC_SONG_RESOURCE_FAILED,
        );
      }
    }

    if (response.audioUrl === '') {
      this.logger.log(`所有音质都返回空URL - 网易云ID: ${neteaseId}`);
    } else {
      this.logger.log(
        `成功获取歌曲资源 - 网易云ID: ${neteaseId}, 有歌词: ${response.lyricsText !== ''}`,
      );
    }

    return response;
  }

  // ── Validation Helpers (per D-209) ────────────────────────────────

  /** Validate NeteaseID with regex ^\d{6,12}$ */
  isValidNeteaseID(neteaseId: string): boolean {
    if (!neteaseId) return false;
    return /^\d{6,12}$/.test(neteaseId);
  }

  /** Validate song has non-empty name/artist/url */
  isValidSong(song: Record<string, any>): boolean {
    const name = song['name'];
    const artist = song['artist'];
    const url = song['url'];
    return (
      typeof name === 'string' && name !== '' &&
      typeof artist === 'string' && artist !== '' &&
      typeof url === 'string' && url !== ''
    );
  }

  /** Validate LRC format has [mm:ss.ms] time tags */
  isValidLRCFormat(lrcText: string): boolean {
    if (!lrcText) return false;
    return /\[\d{1,2}:\d{2}[\.:]?\d{0,3}\]/.test(lrcText);
  }

  // ── Image URL Optimization (per D-209, NOT called from fetchPlaylist) ─

  /**
   * Upgrade pic size parameter: replace param=\d+y\d+ with param=150y150.
   * Matches Go upgradePicSize.
   */
  upgradePicSize(picURL: string): string {
    const paramPattern = /(\?|&)param=\d+y\d+/;
    if (paramPattern.test(picURL)) {
      return picURL.replace(paramPattern, '$1param=150y150');
    }
    // If no param exists, add one
    if (picURL.includes('?')) {
      return picURL + '&param=150y150';
    }
    return picURL + '?param=150y150';
  }

  /**
   * Construct high-quality URL for 126.net / 163.com domains.
   * Matches Go constructHighQualityURL.
   */
  constructHighQualityURL(originalURL: string): string {
    if (!originalURL) return '';
    if (
      originalURL.includes('p3.music.126.net') ||
      originalURL.includes('music.163.com')
    ) {
      return this.upgradePicSize(originalURL);
    }
    return '';
  }

  // ── Private Methods ───────────────────────────────────────────────

  /**
   * Call Song_V1 API with form-urlencoded body (per Go fetchSongV1).
   * POST to {apiBaseURL}/Song_V1 with url={neteaseId}&level={level}&type=json
   */
  private async fetchSongV1(
    neteaseId: string,
    level: string,
  ): Promise<SongResourceResponse> {
    const apiBaseURL = this.getApiBaseURL();
    const songApi = `${apiBaseURL}/Song_V1`;

    this.logger.log(`调用 Song_V1 API - 网易云ID: ${neteaseId}, 音质: ${level}`);

    const formData = `url=${neteaseId}&level=${level}&type=json`;
    this.logRequest('POST', songApi, formData);

    const headers: Record<string, string> = {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: 'https://metings.qjqq.cn',
      Pragma: 'no-cache',
      Referer: 'https://metings.qjqq.cn/',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      'X-Requested-With': 'XMLHttpRequest',
    };

    const startTime = Date.now();

    try {
      const responseBody = await this.httpPost(songApi, formData, headers);
      const duration = Date.now() - startTime;
      this.logResponse(songApi, 200, responseBody, duration);

      const apiResponse: SongV1ApiResponse = JSON.parse(responseBody);

      if (apiResponse.status !== 200 || !apiResponse.success) {
        this.logger.error(
          `Song_V1 API返回错误 - 状态码: ${apiResponse.status}, 成功: ${apiResponse.success}, 消息: ${apiResponse.message}`,
        );
        throw new Error(`Song_V1 API返回错误: ${apiResponse.message}`);
      }

      const result: SongResourceResponse = {
        audioUrl: apiResponse.data.url,
        lyricsText: apiResponse.data.lyric,
      };

      this.logger.log(
        `Song_V1 API调用成功 - 网易云ID: ${neteaseId}, 音质: ${level} (大小: ${apiResponse.data.size}), 有URL: ${result.audioUrl !== ''}, 有歌词: ${result.lyricsText !== ''}`,
      );

      return result;
    } catch (error) {
      this.logError('获取 Song_V1 数据', songApi, error);
      throw error;
    }
  }

  /** Read API base URL from settings, default https://metings.qjqq.cn */
  private getApiBaseURL(): string {
    return this.settingsService.get('music.api.base_url') || 'https://metings.qjqq.cn';
  }

  /** Read playlist ID from settings, default 8152976493 */
  private getPlaylistId(): string {
    return (
      this.settingsService.get('music.player.playlist_id') ||
      this.settingsService.get('MUSIC_PLAYER_PLAYLIST_ID') ||
      '8152976493'
    );
  }

  // ── HTTP Client (Node.js built-in https with rejectUnauthorized:false) ─

  /**
   * HTTP GET request with SSL verification disabled (per D-210).
   * 15-second timeout matching Go's http.Client timeout.
   */
  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';

      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        timeout: this.requestTimeout,
        agent: isHttps ? this.insecureAgent : undefined,
      };

      const req = (isHttps ? https : http).request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode && res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          } else {
            resolve(body);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * HTTP POST request with form-urlencoded body and custom headers.
   * SSL verification disabled (per D-210). 15-second timeout.
   */
  private httpPost(
    url: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';

      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        timeout: this.requestTimeout,
        agent: isHttps ? this.insecureAgent : undefined,
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = (isHttps ? https : http).request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode && res.statusCode >= 300) {
            reject(
              new Error(`HTTP ${res.statusCode}: ${responseBody.slice(0, 200)}`),
            );
          } else {
            resolve(responseBody);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(body);
      req.end();
    });
  }

  // ── Structured Logging (per D-212) ────────────────────────────────

  private logRequest(method: string, url: string, body: string | null): void {
    this.logger.debug('==================== API 请求开始 ====================');
    this.logger.debug(`请求方法: ${method}`);
    this.logger.debug(`请求URL: ${url}`);
    this.logger.debug(`请求时间: ${new Date().toISOString()}`);

    // Log URL info
    this.logURLInfo(url);

    if (body) {
      this.logger.debug(`请求体长度: ${Buffer.byteLength(body)} bytes`);
      this.logger.debug(`请求体内容: ${body}`);
    } else {
      this.logger.debug('请求体: 无');
    }
  }

  private logResponse(
    url: string,
    statusCode: number,
    responseBody: string,
    durationMs: number,
  ): void {
    this.logger.debug('==================== API 响应完成 ====================');
    this.logger.debug(`响应URL: ${url}`);
    this.logger.debug(`响应状态码: ${statusCode}`);
    this.logger.debug(`响应耗时: ${durationMs}ms`);

    this.logPerformanceMetrics(durationMs, Buffer.byteLength(responseBody));

    if (!responseBody) {
      this.logger.debug('响应体: 空');
      return;
    }

    const size = Buffer.byteLength(responseBody);
    this.logger.debug(`响应体长度: ${size} bytes`);

    if (size <= 2048) {
      this.logger.debug(`完整响应体: ${responseBody}`);
    } else {
      this.logger.debug(
        `响应体摘要(前500字符): ${responseBody.slice(0, 500)}`,
      );
      this.logger.debug(
        `响应体摘要(后200字符): ${responseBody.slice(-200)}`,
      );
      this.logJSONStructure(responseBody);
    }

    this.logger.debug('==================== API 调用结束 ====================');
  }

  private logError(operation: string, url: string, error: any): void {
    this.logger.error('==================== API 错误 ====================');
    this.logger.error(`失败操作: ${operation}`);
    this.logger.error(`请求URL: ${url}`);

    const errMsg = error instanceof Error ? error.message : String(error);
    let errorType = 'unknown';
    if (errMsg.includes('timeout')) {
      errorType = 'timeout';
    } else if (errMsg.includes('connection') || errMsg.includes('ECONNREFUSED')) {
      errorType = 'connection';
    } else if (errMsg.includes('JSON') || errMsg.includes('json')) {
      errorType = 'json-parse';
    } else if (errMsg.includes('parse') || errMsg.includes('unmarshal')) {
      errorType = 'data-parse';
    } else if (errMsg.includes('context deadline exceeded')) {
      errorType = 'context-timeout';
    }

    this.logger.error(`错误分类: ${errorType}`);
    this.logger.error(`错误详情: ${errMsg}`);
    this.logger.error('==================== 错误记录结束 ====================');
  }

  private logURLInfo(url: string): void {
    let apiType = 'unknown';
    if (url.includes('metings.qjqq.cn')) {
      apiType = 'metings-api';
      if (url.includes('/Playlist')) {
        apiType = 'metings-playlist';
      } else if (url.includes('/Song_V1')) {
        apiType = 'metings-song';
      }
    }
    this.logger.debug(`API类型: ${apiType}`);

    const qIndex = url.indexOf('?');
    if (qIndex !== -1) {
      this.logger.debug(`URL参数: ${url.slice(qIndex + 1)}`);
    }
  }

  private logPerformanceMetrics(durationMs: number, responseSize: number): void {
    let performanceLevel = 'excellent';
    if (durationMs > 2000) {
      performanceLevel = 'slow';
    } else if (durationMs > 1000) {
      performanceLevel = 'normal';
    } else if (durationMs > 500) {
      performanceLevel = 'good';
    }

    this.logger.debug(`性能评级: ${performanceLevel}`);

    if (responseSize > 0 && durationMs > 0) {
      const speed = (responseSize / (durationMs / 1000)) / 1024; // KB/s
      this.logger.debug(`传输速度: ${speed.toFixed(2)} KB/s`);
    }

    let sizeCategory = 'small';
    if (responseSize > 100 * 1024) {
      sizeCategory = 'large';
    } else if (responseSize > 10 * 1024) {
      sizeCategory = 'medium';
    }
    this.logger.debug(`响应大小分类: ${sizeCategory} (${responseSize} bytes)`);
  }

  private logJSONStructure(jsonStr: string): void {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        this.logger.debug(`JSON结构: 数组, 元素数量: ${parsed.length}`);
        if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
          this.logger.debug(`数组元素字段: ${Object.keys(parsed[0])}`);
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        const summary: Record<string, any> = {};
        if ('code' in parsed) summary.code = parsed.code;
        if ('msg' in parsed) summary.msg = parsed.msg;
        if ('message' in parsed) summary.message = parsed.message;
        if ('timestamp' in parsed) summary.timestamp = parsed.timestamp;

        if ('data' in parsed) {
          if (Array.isArray(parsed.data)) {
            summary.data = `数组(${parsed.data.length}个元素)`;
            if (parsed.data.length > 0 && typeof parsed.data[0] === 'object') {
              summary.dataFields = Object.keys(parsed.data[0]);
            }
          } else if (typeof parsed.data === 'object' && parsed.data !== null) {
            summary.data = `对象(字段: ${Object.keys(parsed.data)})`;
          } else if (parsed.data === null) {
            summary.data = 'null';
          }
        }

        summary.allFields = Object.keys(parsed);
        this.logger.debug(`JSON结构摘要: ${JSON.stringify(summary)}`);
      }
    } catch {
      this.logger.debug('JSON解析失败，可能不是有效的JSON格式');
    }
  }
}
