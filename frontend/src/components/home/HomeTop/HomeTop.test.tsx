import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSiteConfigStore } from "@/store/site-config-store";
import { HomeTop } from "./HomeTop";
import styles from "./HomeTop.module.css";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height, className, title }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={String(src)}
      alt={String(alt ?? "")}
      width={width as number | undefined}
      height={height as number | undefined}
      className={className as string | undefined}
      title={title as string | undefined}
    />
  ),
}));

vi.mock("@iconify/react", () => ({
  Icon: ({ icon, ...props }: { icon: string } & Record<string, unknown>) => <span data-icon={icon} {...props} />,
}));

vi.mock("@heroui/react", () => ({
  addToast: vi.fn(),
}));

vi.mock("@/lib/api/article", () => ({
  articleApi: {
    getRandomArticle: vi.fn(),
  },
}));

describe("HomeTop creativity icons", () => {
  beforeEach(() => {
    useSiteConfigStore.setState({
      siteConfig: {
        HOME_TOP: {
          title: "生活明朗",
          subTitle: "万物可爱",
          siteText: "ANHEYU.COM",
          category: [],
          banner: { tips: "", title: "", image: "", link: "" },
        },
        CREATIVITY: {
          creativity_list: [
            { name: "时间", icon: "ri:24-hours-fill", color: "#14b8a6" },
            { name: "图片", icon: "https://example.com/icon.png", color: "#6366f1" },
          ],
        },
      },
    });
  });

  it("renders Iconify creativity icons without requesting them as image URLs", () => {
    const { container } = render(<HomeTop />);

    expect(container.querySelectorAll('[data-icon="ri:24-hours-fill"]')).toHaveLength(2);
    expect(container.querySelectorAll('img[src="ri:24-hours-fill"]')).toHaveLength(0);
    expect(container.querySelectorAll('img[src="https://example.com/icon.png"]')).toHaveLength(2);
  });

  it("expands the banner area when categories are not configured", () => {
    const { container } = render(<HomeTop />);

    expect(container.querySelector(`.${styles.noCategories}`)).toBeTruthy();
    expect(container.querySelector(`.${styles.categoryGroup}`)).toBeNull();
  });

  it("keeps configured categories visible when backgrounds are image URLs or empty", () => {
    useSiteConfigStore.setState({
      siteConfig: {
        HOME_TOP: {
          title: "生活明朗",
          subTitle: "万物可爱",
          siteText: "ANHEYU.COM",
          category: [
            { name: "建模", path: "/categories/jian-mo/", icon: "devicon:blender", background: "", isExternal: false },
            {
              name: "AI",
              path: "/categories/AI",
              icon: "material-symbols:robot",
              background: "https://avatar.oss.recode88.cn/Snipaste.png",
              isExternal: false,
            },
          ],
          banner: { tips: "", title: "", image: "", link: "" },
        },
        CREATIVITY: {
          creativity_list: [
            { name: "时间", icon: "ri:24-hours-fill", color: "#14b8a6" },
            { name: "图片", icon: "https://example.com/icon.png", color: "#6366f1" },
          ],
        },
      },
    });

    const { container } = render(<HomeTop />);
    const buttons = Array.from(container.querySelectorAll<HTMLAnchorElement>(`.${styles.categoryButton}`));
    const modelingButton = buttons.find(button => button.textContent?.includes("建模"));
    const aiButton = buttons.find(button => button.textContent?.includes("AI"));

    expect(modelingButton?.style.background).not.toBe("");
    expect(aiButton?.style.background).toContain("url(");
  });
});
