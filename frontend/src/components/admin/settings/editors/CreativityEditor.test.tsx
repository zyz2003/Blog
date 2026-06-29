import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreativityEditor } from "./CreativityEditor";

const MOTION_PROPS = new Set([
  "animate",
  "as",
  "axis",
  "dragControls",
  "dragListener",
  "exit",
  "initial",
  "layout",
  "onReorder",
  "transition",
  "value",
  "values",
  "whileDrag",
]);

function stripMotionProps(props: React.PropsWithChildren<Record<string, unknown>>) {
  const { children, ...rest } = props;
  const cleanProps = Object.fromEntries(Object.entries(rest).filter(([key]) => !MOTION_PROPS.has(key)));
  return { children, cleanProps };
}

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height, className }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={String(src)}
      alt={String(alt ?? "")}
      width={width as number | undefined}
      height={height as number | undefined}
      className={className as string | undefined}
    />
  ),
}));

vi.mock("@iconify/react", () => ({
  Icon: ({ icon, ...props }: { icon: string } & Record<string, unknown>) => <span data-icon={icon} {...props} />,
}));

vi.mock("@heroui/react", () => ({
  Input: ({ value }: Record<string, unknown>) => <input value={(value as string) ?? ""} readOnly />,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: (props: React.PropsWithChildren<Record<string, unknown>>) => {
      const { children, cleanProps } = stripMotionProps(props);
      return <div {...cleanProps}>{children}</div>;
    },
  },
  Reorder: {
    Group: (props: React.PropsWithChildren<Record<string, unknown>>) => {
      const { children, cleanProps } = stripMotionProps(props);
      return <div {...cleanProps}>{children}</div>;
    },
    Item: (props: React.PropsWithChildren<Record<string, unknown>>) => {
      const { children, cleanProps } = stripMotionProps(props);
      return <div {...cleanProps}>{children}</div>;
    },
  },
  useDragControls: () => ({ start: vi.fn() }),
}));

describe("CreativityEditor", () => {
  it("renders selected Iconify icons in row previews without image requests", async () => {
    const value = JSON.stringify({
      creativity_list: [{ name: "时间", icon: "ri:24-hours-fill", color: "#14b8a6" }],
    });

    const { container } = render(<CreativityEditor value={value} onValueChange={() => {}} />);

    await waitFor(() => {
      expect(container.querySelectorAll('[data-icon="ri:24-hours-fill"]')).toHaveLength(1);
    });
    expect(container.querySelectorAll('img[src="ri:24-hours-fill"]')).toHaveLength(0);
  });
});
