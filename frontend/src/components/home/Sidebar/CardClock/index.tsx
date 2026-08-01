/**
 * 天气时钟组件
 * 参考 anheyu-app CardClock.vue 实现
 * 显示实时时钟、日期、天气信息
 *
 * 视觉：玻璃拟态 + 沉浸渐变（昼夜 phase + 天气色高光），时间居中为视觉主角。
 */
"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
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

// ─── 昼夜 phase 与沉浸渐变 ─────────────────────────────────────

type Phase = "dawn" | "day" | "dusk" | "night";

const PHASE_TINTS: Record<Phase, string> = {
  dawn: "linear-gradient(135deg, rgba(255,200,160,0.35) 0%, rgba(255,170,200,0.28) 50%, rgba(200,210,235,0.22) 100%)",
  day: "linear-gradient(135deg, rgba(150,200,255,0.32) 0%, rgba(180,215,255,0.26) 50%, rgba(210,235,255,0.20) 100%)",
  dusk: "linear-gradient(135deg, rgba(255,180,140,0.32) 0%, rgba(255,150,180,0.28) 50%, rgba(200,210,235,0.22) 100%)",
  night: "linear-gradient(135deg, rgba(135,160,215,0.28) 0%, rgba(125,150,205,0.24) 50%, rgba(150,170,215,0.20) 100%)",
};

function getPhase(date: Date): Phase {
  const h = date.getHours();
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 19) return "dusk";
  return "night";
}

/** 沉浸背景 = 天气色径向高光 + 昼夜 phase 柔和色罩，叠加在卡片底色之上（浅/深站点模式自适配） */
function buildBackground(phase: Phase, weatherColor: string): string {
  return `radial-gradient(circle at 72% 12%, ${weatherColor}40 0%, transparent 55%), ${PHASE_TINTS[phase]}, var(--anzhiyu-card-bg)`;
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
  const [phase, setPhase] = useState<Phase>(() => getPhase(new Date()));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 更新时间
  const updateTime = useCallback(() => {
    const now = new Date();
    setCurrentTime(formatTime(now));
    setCurrentDate(formatDate(now));
    setCurrentPeriod(getPeriod(now));
    setPhase(getPhase(now));
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

  const gradient = useMemo(() => buildBackground(phase, weatherColor), [phase, weatherColor]);

  return (
    <div className={styles.cardClock} style={{ background: gradient }}>
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
          {/* 背景天气水印 - 居中超大 */}
          {weatherNow && (
            <span className={styles.weatherWatermark} style={{ color: weatherColor }} aria-hidden>
              {WEATHER_ICON_UNICODE[String(weatherNow.icon).trim()] || ""}
            </span>
          )}

          {/* 顶部：城市 + 日期 */}
          <div className={styles.topBar}>
            <span className={styles.chip}>{cityName}</span>
            <span className={styles.chip}>{currentDate}</span>
          </div>

          {/* 时间 hero 居中 */}
          <div className={styles.timeHero}>
            <span className={styles.timeMain}>{currentTime.slice(0, 5)}</span>
            <span className={styles.timeSec}>{currentTime.slice(5)}</span>
            <span className={styles.periodTag}>{currentPeriod}</span>
          </div>

          {/* 天气：图标 + 温度/天气 + 风力/体感 */}
          {weatherNow && (
            <div className={styles.weatherPanel}>
              <span className={styles.weatherIcon} style={{ color: weatherColor }} aria-hidden>
                {WEATHER_ICON_UNICODE[String(weatherNow.icon).trim()] || ""}
              </span>
              <div className={styles.weatherMain}>
                <div className={styles.tempLine}>
                  <span className={styles.tempBig}>{weatherNow.temp}</span>
                  <span className={styles.tempUnit}>°C</span>
                </div>
                <span className={styles.weatherText}>{weatherNow.text}</span>
              </div>
              <div className={styles.weatherMeta}>
                <span className={styles.metaItem}>
                  <span
                    className={styles.windIcon}
                    style={{ transform: `rotate(${weatherNow.wind360}deg)` }}
                    aria-hidden
                  >
                    {WIND_ICON_UNICODE}
                  </span>
                  {weatherNow.windDir} {weatherNow.windScale}级
                </span>
                <span className={styles.metaItem}>体感 {weatherNow.feelsLike}°</span>
              </div>
            </div>
          )}

          {/* 2×2 气象网格 */}
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
                <span className={styles.detailLabel}>能见</span>
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
