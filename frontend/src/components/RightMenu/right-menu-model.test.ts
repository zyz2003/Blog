import { describe, expect, it } from "vitest";
import {
  RIGHT_MENU_RANDOM_PATH,
  getRightMenuSections,
  resolveImageContext,
  type RightMenuContext,
  type RightMenuItem,
} from "./right-menu-model";

const baseContext: RightMenuContext = {
  textSelected: false,
  textInPostDetail: false,
  image: null,
  clickOnMusicPlayer: false,
  musicIsPlaying: false,
  hasCommentSection: false,
  commentBarrageVisible: true,
  darkMode: false,
};

function flattenItems(context: RightMenuContext): RightMenuItem[] {
  return getRightMenuSections(context).flatMap(section => section.items);
}

function itemIds(context: RightMenuContext): string[] {
  return flattenItems(context).map(item => item.id);
}

describe("right menu model", () => {
  it("默认菜单包含旧版基础动作并跳转当前随机文章路由", () => {
    expect(RIGHT_MENU_RANDOM_PATH).toBe("/random-post");

    expect(itemIds(baseContext)).toEqual(
      expect.arrayContaining([
        "history-back",
        "history-forward",
        "refresh-page",
        "scroll-top",
        "random-post",
        "categories",
        "tags",
        "copy-url",
        "toggle-theme",
      ])
    );
  });

  it("选中文字时展示文字菜单，文章正文中额外展示引用到评论", () => {
    const ids = itemIds({
      ...baseContext,
      textSelected: true,
      textInPostDetail: true,
    });

    expect(ids).toEqual(expect.arrayContaining(["copy-selected-text", "quote-to-comment", "search-local", "search-baidu"]));
    expect(ids).not.toContain("random-post");
  });

  it("右键图片时展示图片菜单并隐藏默认浏览菜单", () => {
    const ids = itemIds({
      ...baseContext,
      image: {
        src: "https://static.example.com/photo.webp",
        filename: "photo.webp",
      },
    });

    expect(ids).toEqual(expect.arrayContaining(["open-image", "copy-image-url", "download-image"]));
    expect(ids).not.toContain("random-post");
  });

  it("右键音乐播放器时展示播放控制菜单", () => {
    const items = flattenItems({
      ...baseContext,
      clickOnMusicPlayer: true,
      musicIsPlaying: true,
    });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "toggle-play-pause", label: "暂停" }),
        expect.objectContaining({ id: "previous-song", label: "上一首" }),
        expect.objectContaining({ id: "next-song", label: "下一首" }),
        expect.objectContaining({ id: "copy-song-name", label: "复制歌名" }),
      ])
    );
  });

  it("所有菜单图标都使用 FontAwesome6 solid", () => {
    const allItems = [
      ...flattenItems(baseContext),
      ...flattenItems({ ...baseContext, textSelected: true, textInPostDetail: true }),
      ...flattenItems({ ...baseContext, image: { src: "https://static.example.com/photo.webp" } }),
      ...flattenItems({ ...baseContext, clickOnMusicPlayer: true, musicIsPlaying: false, hasCommentSection: true }),
    ];

    expect(allItems.length).toBeGreaterThan(0);
    for (const item of allItems) {
      expect(item.icon).toMatch(/^fa6-solid:/);
      expect(item.icon).not.toContain("anzhiyu");
      expect(item.icon).not.toMatch(/^ri:/);
    }
  });

  it("从图片元素和图片链接解析图片上下文", () => {
    const image = document.createElement("img");
    image.src = "https://static.example.com/photo.jpg";
    image.alt = "Photo Title";
    expect(resolveImageContext(image)).toEqual({
      src: "https://static.example.com/photo.jpg",
      filename: "Photo Title.jpg",
    });

    const link = document.createElement("a");
    link.href = "https://static.example.com/original.png";
    const span = document.createElement("span");
    link.appendChild(span);
    expect(resolveImageContext(span)).toEqual({
      src: "https://static.example.com/original.png",
      filename: "original.png",
    });
  });
});
