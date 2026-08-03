import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { useSiteConfigStore } from "@/store/site-config-store";
import { SkillsCard } from "./SkillsCard";

vi.mock("@iconify/react", () => ({
  Icon: ({ icon, ...props }: { icon: string } & Record<string, unknown>) => <span data-icon={icon} {...props} />,
}));

describe("SkillsCard", () => {
  const resetState = {
    siteConfig: {},
    isLoaded: false,
    loading: false,
    error: null,
  };

  beforeEach(() => {
    useSiteConfigStore.setState(resetState);
  });

  it("renders creativity Iconify icons without treating them as image URLs", () => {
    useSiteConfigStore.setState({
      siteConfig: {
        CREATIVITY: {
          creativity_list: [{ name: "设计", icon: "ri:paint-brush-line", color: "#1677ff" }],
        },
      },
    });

    const { container } = render(<SkillsCard skillsTips={{ tips: "技能", title: "创意模块" }} />);

    expect(screen.getByText("设计")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-icon="ri:paint-brush-line"]')).toHaveLength(3);
    expect(container.querySelectorAll('img[src="ri:paint-brush-line"]')).toHaveLength(0);
  });

  it("keeps rendering creativity image URLs as img elements", () => {
    useSiteConfigStore.setState({
      siteConfig: {
        CREATIVITY: {
          creativity_list: [{ name: "图片", icon: "https://example.com/icon.png", color: "#1677ff" }],
        },
      },
    });

    const { container } = render(<SkillsCard skillsTips={{ tips: "技能", title: "创意模块" }} />);

    expect(container.querySelectorAll('img[src="https://example.com/icon.png"]')).toHaveLength(3);
  });

  it("keeps rendering creativity data image URLs as img elements", () => {
    const dataIcon = "data:image/svg+xml;base64,PHN2Zy8+";

    useSiteConfigStore.setState({
      siteConfig: {
        CREATIVITY: {
          creativity_list: [{ name: "React", icon: dataIcon, color: "#222222" }],
        },
      },
    });

    const { container } = render(<SkillsCard skillsTips={{ tips: "技能", title: "创意模块" }} />);

    expect(container.querySelectorAll(`img[src="${dataIcon}"]`)).toHaveLength(3);
    expect(container.querySelectorAll(`[data-icon="${dataIcon}"]`)).toHaveLength(0);
  });
});
