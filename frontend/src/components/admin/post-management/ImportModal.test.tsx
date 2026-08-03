import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ImportModal } from "./ImportModal";

vi.mock("@heroui/react", () => ({
  addToast: vi.fn(),
  Modal: ({ children }: PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>,
  ModalContent: ({ children }: { children: ReactNode | ((onClose: () => void) => ReactNode) }) => (
    <section>{typeof children === "function" ? children(vi.fn()) : children}</section>
  ),
  ModalHeader: ({ children }: PropsWithChildren) => <header>{children}</header>,
  ModalBody: ({ children }: PropsWithChildren) => <main>{children}</main>,
  ModalFooter: ({ children }: PropsWithChildren) => <footer>{children}</footer>,
  Button: ({
    children,
    onPress,
    isDisabled,
  }: PropsWithChildren<{ onPress?: () => void; isDisabled?: boolean }>) => (
    <button type="button" onClick={onPress} disabled={isDisabled}>
      {children}
    </button>
  ),
}));

const importMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
} as unknown as ComponentProps<typeof ImportModal>["onImport"];

describe("ImportModal migration guide", () => {
  it("explains Hexo migration fields and the JSON import boundary", async () => {
    const user = userEvent.setup();

    render(<ImportModal isOpen onOpenChange={vi.fn()} onImport={importMutation} />);

    await user.click(screen.getByRole("button", { name: /查看导入格式与迁移指南/ }));

    expect(screen.getByText("推荐迁移流程")).toBeInTheDocument();
    expect(screen.getByText("Hexo Front Matter 字段映射")).toBeInTheDocument();
    expect(screen.getAllByText("content_md").length).toBeGreaterThan(0);
    expect(screen.getAllByText("content_html").length).toBeGreaterThan(0);
    expect(screen.getByText(/markdown\/ 目录用于人工核对/)).toBeInTheDocument();
    expect(screen.getAllByText(/hello-hexo/).length).toBeGreaterThan(0);
  });
});
