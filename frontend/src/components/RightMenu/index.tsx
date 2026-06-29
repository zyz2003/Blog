"use client";

/**
 * @Description: 右键菜单组件
 * @Author: 安知鱼
 * 1:1 移植自 anheyu-app layout/frontend/components/RightMenu/index.vue
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/react";
import { useUiStore } from "@/store/ui-store";
import { useSiteConfigStore } from "@/store/site-config-store";
import { useTheme } from "@/hooks/use-theme";
import { shouldUseSiteRightMenu } from "./right-menu-policy";
import {
  RIGHT_MENU_RANDOM_PATH,
  getRightMenuSections,
  resolveImageContext,
  type RightMenuImageContext,
  type RightMenuItem,
} from "./right-menu-model";
import styles from "./styles.module.css";

/**
 * 安全写入剪贴板（带错误处理）
 */
const safeClipboardWrite = (text: string, successMsg: string) => {
  navigator.clipboard.writeText(text).then(
    () => addToast({ title: successMsg, color: "success", timeout: 2000 }),
    () => addToast({ title: "复制失败，请重试", color: "danger", timeout: 2000 })
  );
};

export function RightMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { isDark, toggleTheme, mounted } = useTheme();

  const useCustomContextMenu = useUiStore(s => s.useCustomContextMenu);
  const isCommentBarrageVisible = useUiStore(s => s.isCommentBarrageVisible);
  const toggleCommentBarrage = useUiStore(s => s.toggleCommentBarrage);
  const siteConfig = useSiteConfigStore(s => s.siteConfig);
  const isRightMenuDisabled = useSiteConfigStore(s => s.isRightMenuDisabled());

  const [isVisible, setIsVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [transformOrigin, setTransformOrigin] = useState("top left");
  const [isTextSelected, setIsTextSelected] = useState(false);
  const [capturedText, setCapturedText] = useState("");
  const [isTextInPostDetail, setIsTextInPostDetail] = useState(false);
  const [imageContext, setImageContext] = useState<RightMenuImageContext | null>(null);
  const [hasCommentSection, setHasCommentSection] = useState(false);
  const [isClickOnMusicPlayer, setIsClickOnMusicPlayer] = useState(false);
  const [musicIsPlaying, setMusicIsPlaying] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisibleRef = useRef(false);
  const isDarkMode = mounted && isDark;

  // 使用 ref 稳定引用，避免事件监听器频繁重注册
  const stateRef = useRef({
    useCustomContextMenu,
    pathname,
    siteConfig,
    isRightMenuDisabled,
  });

  // 同步 ref（放在 useEffect 中避免 lint 警告）
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    stateRef.current = { useCustomContextMenu, pathname, siteConfig, isRightMenuDisabled };
  }, [useCustomContextMenu, pathname, siteConfig, isRightMenuDisabled]);

  // 隐藏菜单（用 ref 读取 isVisible，避免 stale closure）
  const hideMenu = useCallback(() => {
    if (!isVisibleRef.current) return;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setIsHiding(true);
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      setIsHiding(false);
      hideTimerRef.current = null;
    }, 100);
  }, []);

  // 检查评论区域（与 anheyu-app checkCommentSection 一致，同时检查配置 + DOM）
  const checkCommentSection = useCallback(() => {
    const config = stateRef.current.siteConfig;
    const commentEnabled = config?.comment?.enable === true || config?.comment?.enable === "true";
    const commentElementExists = !!document.getElementById("post-comment");
    setHasCommentSection(commentEnabled && commentElementExists);
  }, []);

  // 调整菜单位置，避免超出窗口边界
  const adjustMenuPosition = useCallback((x: number, y: number) => {
    const menu = menuRef.current;
    if (!menu) return { x, y, origin: "top left" };

    const menuWidth = menu.offsetWidth || 200;
    const menuHeight = menu.offsetHeight || 300;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let finalX = x;
    let finalY = y;
    let originX = "left";
    let originY = "top";

    if (x + menuWidth > windowWidth) {
      finalX = x - menuWidth;
      originX = "right";
    }

    if (y + menuHeight > windowHeight) {
      finalY = y - menuHeight;
      originY = "bottom";
    }

    finalX = Math.max(5, finalX);
    finalY = Math.max(5, finalY);

    return { x: finalX, y: finalY, origin: `${originY} ${originX}` };
  }, []);

  // 全局事件监听 - 注册一次，通过 ref 读取最新状态
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const { useCustomContextMenu: enabled, pathname: path, isRightMenuDisabled: disabled } = stateRef.current;
      if (
        !shouldUseSiteRightMenu({
          localEnabled: enabled,
          siteDisabled: disabled,
          pathname: path,
          viewportWidth: window.innerWidth,
        })
      ) {
        return;
      }

      event.preventDefault();

      // 检查文本选中
      const selection = window.getSelection();
      const textSelected = selection ? !selection.isCollapsed : false;
      setIsTextSelected(textSelected);

      // 检查是否右键点击了音乐播放器
      const target = event.target as HTMLElement;
      const musicPlayer = target.closest("#nav-music");
      setIsClickOnMusicPlayer(!!musicPlayer);
      setImageContext(resolveImageContext(target));

      if (musicPlayer) {
        window.dispatchEvent(new CustomEvent("music-player-get-play-status"));
      }

      // 检查评论区域
      checkCommentSection();

      // 捕获选中文本
      if (textSelected && selection) {
        setCapturedText(selection.toString());

        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (range) {
          const container = range.commonAncestorContainer;
          const targetElement =
            container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as HTMLElement);
          const postDetailContent = targetElement?.closest(".post-detail-content");
          setIsTextInPostDetail(!!postDetailContent);
        } else {
          setIsTextInPostDetail(false);
        }
      } else {
        setCapturedText("");
        setIsTextInPostDetail(false);
      }

      // 清除之前的隐藏动画
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      // 设置初始位置
      const clickX = event.clientX;
      const clickY = event.clientY;

      setPosition({ x: clickX, y: clickY });
      setIsVisible(true);
      setIsHiding(false);

      // 下一帧调整位置（确保 DOM 已渲染以获取实际尺寸）
      requestAnimationFrame(() => {
        const adjusted = adjustMenuPosition(clickX, clickY);
        setPosition({ x: adjusted.x, y: adjusted.y });
        setTransformOrigin(adjusted.origin);
      });
    };

    const handleClick = () => {
      if (isVisibleRef.current) hideMenu();
    };

    const handleScroll = () => {
      if (isVisibleRef.current) hideMenu();
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isVisibleRef.current) hideMenu();
    };

    const handlePlayStatus = (event: Event) => {
      const { isPlaying } = (event as CustomEvent).detail;
      setMusicIsPlaying(isPlaying);
    };

    const handleSongNameResponse = (event: Event) => {
      const { songName, artist } = (event as CustomEvent).detail;
      const fullName = artist ? `${artist} - ${songName}` : songName;
      safeClipboardWrite(fullName, "歌曲名称复制成功");
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", handleClick);
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("music-player-play-status-response", handlePlayStatus);
    window.addEventListener("music-player-song-name-response", handleSongNameResponse);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("music-player-play-status-response", handlePlayStatus);
      window.removeEventListener("music-player-song-name-response", handleSongNameResponse);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [hideMenu, checkCommentSection, adjustMenuPosition]);

  // 路由变化时重新检查评论区域（setTimeout 匹配 Vue nextTick，等 DOM 更新后再检查）
  useEffect(() => {
    const timer = setTimeout(checkCommentSection, 0);
    return () => clearTimeout(timer);
  }, [pathname, checkCommentSection]);

  // ===== 菜单项操作函数 =====
  const goBack = () => {
    window.history.back();
    hideMenu();
  };

  const goForward = () => {
    window.history.forward();
    hideMenu();
  };

  const refreshPage = () => {
    hideMenu();
    window.location.reload();
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    hideMenu();
  };

  const copySelectedText = () => {
    if (capturedText) {
      safeClipboardWrite(capturedText, "复制成功，复制和转载请标注本文地址");
    }
    hideMenu();
  };

  const quoteToComment = () => {
    if (capturedText) {
      window.dispatchEvent(new CustomEvent("quote-text-to-comment", { detail: { quoteText: capturedText } }));
      addToast({ title: "已引用到评论", color: "success", timeout: 2000 });
    }
    hideMenu();
  };

  const searchLocal = () => {
    if (capturedText) {
      window.dispatchEvent(new CustomEvent("frontend-open-search", { detail: { keyword: capturedText } }));
    }
    hideMenu();
  };

  const searchBaidu = () => {
    if (capturedText) {
      window.open(`https://www.baidu.com/s?wd=${encodeURIComponent(capturedText)}`, "_blank");
    }
    hideMenu();
  };

  const randomNavigate = () => {
    router.push(RIGHT_MENU_RANDOM_PATH);
    hideMenu();
  };

  const gotoCategories = () => {
    router.push("/categories");
    hideMenu();
  };

  const gotoTags = () => {
    router.push("/tags");
    hideMenu();
  };

  const copyUrl = () => {
    safeClipboardWrite(window.location.href, "复制本页链接地址成功");
    hideMenu();
  };

  const openImage = () => {
    if (imageContext?.src) {
      window.open(imageContext.src, "_blank", "noopener,noreferrer");
    }
    hideMenu();
  };

  const copyImageUrl = () => {
    if (imageContext?.src) {
      safeClipboardWrite(imageContext.src, "复制图片地址成功");
    }
    hideMenu();
  };

  const downloadImage = () => {
    if (imageContext?.src) {
      const link = document.createElement("a");
      link.href = imageContext.src;
      link.download = imageContext.filename || "";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    hideMenu();
  };

  const handleThemeToggle = () => {
    if (!mounted) return;
    toggleTheme();
    hideMenu();
  };

  const handleToggleCommentBarrage = () => {
    toggleCommentBarrage();
    hideMenu();
  };

  // 音乐播放器控制
  const togglePlayPause = () => {
    window.dispatchEvent(new CustomEvent("music-player-toggle-play"));
    hideMenu();
  };

  const previousSong = () => {
    window.dispatchEvent(new CustomEvent("music-player-previous"));
    hideMenu();
  };

  const nextSong = () => {
    window.dispatchEvent(new CustomEvent("music-player-next"));
    hideMenu();
  };

  const copySongName = () => {
    window.dispatchEvent(new CustomEvent("music-player-get-song-name"));
    hideMenu();
  };

  const handleMenuItemClick = (id: RightMenuItem["id"]) => {
    switch (id) {
      case "history-back":
        goBack();
        break;
      case "history-forward":
        goForward();
        break;
      case "refresh-page":
        refreshPage();
        break;
      case "scroll-top":
        scrollToTop();
        break;
      case "copy-selected-text":
        copySelectedText();
        break;
      case "quote-to-comment":
        quoteToComment();
        break;
      case "search-local":
        searchLocal();
        break;
      case "search-baidu":
        searchBaidu();
        break;
      case "open-image":
        openImage();
        break;
      case "copy-image-url":
        copyImageUrl();
        break;
      case "download-image":
        downloadImage();
        break;
      case "random-post":
        randomNavigate();
        break;
      case "categories":
        gotoCategories();
        break;
      case "tags":
        gotoTags();
        break;
      case "toggle-play-pause":
        togglePlayPause();
        break;
      case "previous-song":
        previousSong();
        break;
      case "next-song":
        nextSong();
        break;
      case "copy-song-name":
        copySongName();
        break;
      case "copy-url":
        copyUrl();
        break;
      case "toggle-theme":
        handleThemeToggle();
        break;
      case "toggle-comment-barrage":
        handleToggleCommentBarrage();
        break;
    }
  };

  // ===== 渲染 =====
  const menuClasses = [styles.rightMenu, isVisible ? styles.visible : "", isHiding ? styles.hiding : ""]
    .filter(Boolean)
    .join(" ");
  const menuSections = getRightMenuSections({
    textSelected: isTextSelected,
    textInPostDetail: isTextInPostDetail,
    image: imageContext,
    clickOnMusicPlayer: isClickOnMusicPlayer,
    musicIsPlaying,
    hasCommentSection,
    commentBarrageVisible: isCommentBarrageVisible,
    darkMode: isDarkMode,
  });

  return (
    <div
      ref={menuRef}
      id="rightMenu"
      className={menuClasses}
      onClick={e => e.stopPropagation()}
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        transformOrigin,
      }}
    >
      {menuSections.map(section => (
        <div
          key={section.id}
          className={[
            styles.menuGroup,
            section.compact ? styles.menuSmall : styles.menuGroupLine,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {section.items.map(item => (
            <div key={item.id} className={styles.menuItem} onClick={() => handleMenuItemClick(item.id)}>
              <Icon icon={item.icon} />
              {item.label && <span>{item.label}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
