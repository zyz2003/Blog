import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApplyLink } from "@/app/(frontend)/link/_components/ApplyLink";

const mutateAsyncMock = vi.hoisted(() => vi.fn());
const checkLinkExistsMock = vi.hoisted(() => vi.fn());

vi.mock("@heroui/react", () => ({
  addToast: vi.fn(),
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Checkbox: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
  Dropdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/auth/CaptchaWidget", () => {
  const MockCaptchaWidget = React.forwardRef(function MockCaptchaWidget(_props, ref) {
    React.useImperativeHandle(ref, () => ({
      verify: vi.fn(),
      refresh: vi.fn(),
    }));
    return <div data-testid="captcha-widget" />;
  });
  return { CaptchaWidget: MockCaptchaWidget };
});

vi.mock("@/hooks/queries/use-friends", () => ({
  useApplyLink: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
  useApplications: () => ({ data: { list: [], total: 0 }, isPending: false }),
}));

vi.mock("@/lib/api/friends", () => ({
  friendsApi: {
    checkLinkExists: checkLinkExistsMock,
  },
}));

vi.mock("@/store/site-config-store", () => ({
  useSiteConfigStore: (selector: (state: { siteConfig: Record<string, unknown> }) => unknown) =>
    selector({ siteConfig: {} }),
}));

vi.mock("@/hooks/use-code-block-enhancer", () => ({
  useCodeBlockEnhancer: vi.fn(),
}));

describe("ApplyLink custom RSS", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    checkLinkExistsMock.mockReset();
    checkLinkExistsMock.mockResolvedValue({ exists: false, url: "https://site.example" });
    mutateAsyncMock.mockResolvedValue(undefined);
  });

  it("提交友链申请时包含可选 rss_url", async () => {
    render(<ApplyLink />);

    fireEvent.change(screen.getByLabelText("网站名称"), { target: { value: "示例站点" } });
    fireEvent.change(screen.getByLabelText("网站链接"), { target: { value: "https://site.example" } });
    fireEvent.change(screen.getByLabelText("Logo 链接"), { target: { value: "https://site.example/logo.png" } });
    fireEvent.change(screen.getByLabelText("网站简介"), { target: { value: "一个示例站点" } });
    fireEvent.change(screen.getByLabelText("网站截图（可选）"), { target: { value: "https://site.example/shot.png" } });
    fireEvent.change(screen.getByLabelText("联系邮箱"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByLabelText("RSS 地址（可选）"), {
      target: { value: "https://site.example/custom-feed.xml" },
    });

    fireEvent.click(screen.getByRole("button", { name: /提交申请/ }));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rss_url: "https://site.example/custom-feed.xml",
      })
    );
  });
});
