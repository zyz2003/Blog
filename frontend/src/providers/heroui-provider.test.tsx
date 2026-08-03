import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { HeroUIProviderWrapper } from "./heroui-provider";

const toastProviderProps = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@heroui/react", () => ({
  HeroUIProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToastProvider: (props: { regionProps?: { className?: string } }) => {
    toastProviderProps(props);
    return <div data-testid="toast-region" className={props.regionProps?.className} />;
  },
}));

function extractZIndex(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*z-index:\\s*(\\d+)`, "s"));

  if (!match) return null;

  return Number(match[1]);
}

describe("HeroUIProviderWrapper", () => {
  it("为 toast region 配置全局层级 class", () => {
    render(
      <HeroUIProviderWrapper>
        <span />
      </HeroUIProviderWrapper>
    );

    expect(toastProviderProps).toHaveBeenCalledWith(
      expect.objectContaining({
        regionProps: expect.objectContaining({ className: "anheyu-toast-region" }),
      })
    );
  });

  it("toast region 层级高于文件移动弹窗遮罩", () => {
    const srcDir = path.resolve(__dirname, "..");
    const globalsCss = readFileSync(path.join(srcDir, "app/globals.css"), "utf8");
    const moveModalCss = readFileSync(
      path.join(srcDir, "components/admin/file-manager/modals/MoveModal.module.css"),
      "utf8"
    );

    const toastZIndex = extractZIndex(globalsCss, ".anheyu-toast-region");
    const modalOverlayZIndex = extractZIndex(moveModalCss, ".overlay");

    expect(toastZIndex).not.toBeNull();
    expect(modalOverlayZIndex).not.toBeNull();
    expect(toastZIndex).toBeGreaterThan(modalOverlayZIndex as number);
  });
});
