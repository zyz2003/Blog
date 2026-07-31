/**
 * 天气时钟组件
 * 参考 anheyu-app CardClock.vue 实现
 * 显示实时时钟、日期、天气信息
 */
"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import styles from "./CardClock.module.css";

// ─── 类型定义 ─────────────────────────────────────────────────

interface WeatherConfig {
  loading: string;
  defaultRectangle: boolean;
  rectangle: string;
}

interface WeatherNow {
  icon: string;
  text: string;
  temp: string;
  feelsLike: string;
  windDir: string;
  wind360: string;
  windScale: string;
  windSpeed: string;
  humidity: string;
  precip: string;
  pressure: string;
  vis: string;
  cloud: string;
}

interface CardClockProps {
  config: WeatherConfig;
}

// ─── 天气图标 Unicode 映射 ────────────────────────────────────
// 与 qweather-icons 填充实心字形 `qi-{code}-fill` 一致（U+F1AC 起）；误用线框区段会导致图标空白。

const WEATHER_ICON_UNICODE: Record<string, string> = {
  "100": "\uf1ac",
  "101": "\uf1ad",
  "102": "\uf1ae",
  "103": "\uf1af",
  "104": "\uf1b0",
  "150": "\uf1b1",
  "151": "\uf1b2",
  "152": "\uf1b3",
  "153": "\uf1b4",
  "154": "\uf1b0",
  "300": "\uf1b5",
  "301": "\uf1b6",
  "302": "\uf1b7",
  "303": "\uf1b8",
  "304": "\uf1b9",
  "305": "\uf1ba",
  "306": "\uf1bb",
  "307": "\uf1bc",
  "308": "\uf1bd",
  "309": "\uf1be",
  "310": "\uf1bf",
  "311": "\uf1c0",
  "312": "\uf1c1",
  "313": "\uf1c2",
  "314": "\uf1c3",
  "315": "\uf1c4",
  "316": "\uf1c5",
  "317": "\uf1c6",
  "318": "\uf1c7",
  "350": "\uf1c8",
  "351": "\uf1c9",
  "399": "\uf1ca",
  "400": "\uf1cb",
  "401": "\uf1cc",
  "402": "\uf1cd",
  "403": "\uf1ce",
  "404": "\uf1cf",
  "405": "\uf1d0",
  "406": "\uf1d1",
  "407": "\uf1d2",
  "408": "\uf1d3",
  "409": "\uf1d4",
  "410": "\uf1d5",
  "456": "\uf1d6",
  "457": "\uf1d7",
  "499": "\uf1d8",
  "500": "\uf1d9",
  "501": "\uf1da",
  "502": "\uf1db",
  "503": "\uf1dc",
  "504": "\uf1dd",
  "507": "\uf1de",
  "508": "\uf1df",
  "509": "\uf1e0",
  "510": "\uf1e1",
  "511": "\uf1e2",
  "512": "\uf1e3",
  "513": "\uf1e4",
  "514": "\uf1e5",
  "515": "\uf1e6",
  "800": "\uf13c",
  "801": "\uf13d",
  "802": "\uf13e",
  "803": "\uf13f",
  "804": "\uf140",
  "805": "\uf141",
  "806": "\uf142",
  "807": "\uf143",
  "900": "\uf1e7",
  "901": "\uf1e8",
  "999": "\uf1e9",
};

// 风向图标
const WIND_ICON_UNICODE = "\uf18e";

// ─── 天气图标颜色映射 ────────────────────────────────────────

const WEATHER_COLOR_MAP: Record<string, string> = {
  "100": "#fdcc45", // 晴
  "101": "#fe6976",
  "102": "#fe7f5b",
  "103": "#fe7f5b",
  "104": "#2152d1", // 阴
  "150": "#2152d1",
  "151": "#2152d1",
  "152": "#2152d1",
  "153": "#2152d1",
  "154": "#2152d1",
  "300": "#49b1f5",
  "301": "#49b1f5",
  "302": "#fdcc46",
  "303": "#fdcc46",
  "304": "#fdcc46",
  "305": "#49b1f5",
  "306": "#49b1f5",
  "307": "#49b1f5",
  "308": "#49b1f5",
  "309": "#49b1f5",
  "310": "#49b1f5",
  "311": "#49b1f5",
  "312": "#49b1f5",
  "313": "#49b1f5",
  "314": "#49b1f5",
  "315": "#49b1f5",
  "316": "#49b1f5",
  "317": "#49b1f5",
  "318": "#49b1f5",
  "350": "#49b1f5",
  "351": "#49b1f5",
  "399": "#49b1f5",
  "400": "#a3c2dc",
  "401": "#a3c2dc",
  "402": "#a3c2dc",
  "403": "#a3c2dc",
  "404": "#a3c2dc",
  "405": "#a3c2dc",
  "406": "#a3c2dc",
  "407": "#a3c2dc",
  "408": "#a3c2dc",
  "409": "#a3c2dc",
  "410": "#a3c2dc",
  "456": "#a3c2dc",
  "457": "#a3c2dc",
  "499": "#a3c2dc",
  "500": "#97acba",
  "501": "#97acba",
  "502": "#97acba",
  "503": "#97acba",
  "504": "#97acba",
  "507": "#97acba",
  "508": "#97acba",
  "509": "#97acba",
  "510": "#97acba",
  "511": "#97acba",
  "512": "#97acba",
  "513": "#97acba",
  "514": "#97acba",
  "515": "#97acba",
  "800": "#2152d1",
  "801": "#2152d1",
  "802": "#2152d1",
  "803": "#2152d1",
  "804": "#2152d1",
  "805": "#2152d1",
  "806": "#2152d1",
  "807": "#2152d1",
  "900": "red",
  "999": "red",
  "901": "#179fff",
};

// ─── 工具函数 ────────────────────────────────────────────────

const zeroPadding = (num: number, digit: number): string => String(num).padStart(digit, "0");

const WEEK_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function formatTime(date: Date) {
  return `${zeroPadding(date.getHours(), 2)}:${zeroPadding(date.getMinutes(), 2)}:${zeroPadding(date.getSeconds(), 2)}`;
}

function formatDate(date: Date) {
  return `${zeroPadding(date.getFullYear(), 4)}-${zeroPadding(date.getMonth() + 1, 2)}-${zeroPadding(date.getDate(), 2)} ${WEEK_NAMES[date.getDay()]}`;
}

function getPeriod(date: Date) {
  return date.getHours() >= 12 ? " P M" : " A M";
}

// ─── 组件 ────────────────────────────────────────────────────

export const CardClock = memo(function CardClock({ config }: CardClockProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [currentPeriod, setCurrentPeriod] = useState("");
  const [weatherNow, setWeatherNow] = useState<WeatherNow | null>(null);
  const [weatherColor, setWeatherColor] = useState("#000");
  const [cityName, setCityName] = useState("定位中...");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 更新时间
  const updateTime = useCallback(() => {
    const now = new Date();
    setCurrentTime(formatTime(now));
    setCurrentDate(formatDate(now));
    setCurrentPeriod(getPeriod(now));
  }, []);

  // 获取天气信息（经后端代理，不暴露 qweather key）
  // 后端 /api/public/weather/now 合并返回城市名 + 实时天气
  const fetchWeather = useCallback(async (location: string) => {
    try {
      const res = await fetch(`/api/public/weather/now?location=${encodeURIComponent(location)}`);
      const result = await res.json();
      if (result.code === 200 && result.data) {
        setCityName(result.data.city || "未知");
        if (result.data.weather) {
          setWeatherNow(result.data.weather);
          setWeatherColor(WEATHER_COLOR_MAP[result.data.weather.icon] || "#000");
        }
      } else {
        setCityName("未知");
      }
    } catch {
      setCityName("未知");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 获取 IP 定位并加载天气
  const initWeather = useCallback(async () => {
    if (config.defaultRectangle) {
      // 使用固定坐标
      await fetchWeather(config.rectangle);
    } else {
      // 通过后端 API 获取 IP 定位（仅取经纬度，城市由 weather/now 返回）
      try {
        const res = await fetch("/api/public/weather/ip-location");
        const result = await res.json();

        let location = config.rectangle;
        if (result.code === 200 && result.data) {
          if (result.data.longitude && result.data.latitude) {
            location = `${result.data.longitude},${result.data.latitude}`;
          } else if (result.data.default_rectangle) {
            // 局域网或无经纬度时后端会带 default_rectangle，优先用其请求天气
            location = result.data.default_rectangle;
          }
        }
        await fetchWeather(location);
      } catch {
        // IP 定位失败，使用默认坐标
        await fetchWeather(config.rectangle);
      }
    }
  }, [config.defaultRectangle, config.rectangle, fetchWeather]);

  // 初始化
  useEffect(() => {
    updateTime();
    timerRef.current = setInterval(updateTime, 1000);
    initWeather();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [updateTime, initWeather]);

  return (
    <div className={styles.cardClock}>
      {isLoading ? (
        <div className={styles.loadingContainer}>
          {config.loading ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.loading} alt="Loading" className={styles.loadingImg} />
          ) : (
            <span className={styles.loadingText}>加载中...</span>
          )}
        </div>
      ) : (
        <div className={styles.cardBody}>
          {/* 背景水印 */}
          {weatherNow && (
            <span className={styles.weatherWatermark} style={{ color: weatherColor }}>
              {WEATHER_ICON_UNICODE[String(weatherNow.icon).trim()] || ""}
            </span>
          )}

          {/* 日期 — 放大显眼 */}
          <div className={styles.dateRow}>{currentDate}</div>

          {/* 城市名 */}
          <div className={styles.cityRow}>{cityName}</div>

          {/* 时间 */}
          <div className={styles.timeRow}>
            <span className={styles.timeMain}>{currentTime.slice(0, 5)}</span>
            <span className={styles.timeSec}>{currentTime.slice(5)}</span>
            <span className={styles.periodTag}>{currentPeriod}</span>
          </div>

          {/* 分隔线 */}
          <div
            className={styles.dividerLine}
            style={{ background: `linear-gradient(90deg, ${weatherColor}, ${weatherColor}66)` }}
          />

          {/* 风向 + 天气 一行 */}
          {weatherNow && (
            <div className={styles.weatherWindRow}>
              <span className={styles.windIcon} style={{ transform: `rotate(${weatherNow.wind360}deg)` }}>
                {WIND_ICON_UNICODE}
              </span>
              <span>{weatherNow.windDir}</span>
              <span className={styles.dot}>·</span>
              <span className={styles.weatherText}>{weatherNow.text}</span>
              <span className={styles.dot}>·</span>
              <span>{weatherNow.windScale}级</span>
            </div>
          )}

          {/* 温度 + 体感 */}
          <div className={styles.tempRow}>
            {weatherNow && (
              <>
                <span className={styles.tempBig}>{weatherNow.temp}</span>
                <span className={styles.tempUnit}>℃</span>
                <span className={styles.feelsLike}>体感 {weatherNow.feelsLike}℃</span>
              </>
            )}
          </div>

          {/* 更多气象数据 */}
          {weatherNow && (
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>湿度</span>
                <span className={styles.detailValue}>{weatherNow.humidity}%</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>气压</span>
                <span className={styles.detailValue}>{weatherNow.pressure}hPa</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>能见度</span>
                <span className={styles.detailValue}>{weatherNow.vis}km</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>云量</span>
                <span className={styles.detailValue}>{weatherNow.cloud}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

CardClock.displayName = "CardClock";

export default CardClock;
