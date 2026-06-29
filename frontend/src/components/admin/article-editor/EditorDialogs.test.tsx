import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { LinkDialog } from "./EditorDialogs";

vi.mock("@heroui/react", () => {
  interface MockInputProps {
    label: string;
    value: string;
    placeholder?: string;
    onValueChange?: (value: string) => void;
    onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
    isInvalid?: boolean;
    errorMessage?: string;
  }

  interface MockButtonProps {
    children: React.ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
  }

  interface MockSwitchProps {
    children: React.ReactNode;
    isSelected: boolean;
    onValueChange?: (value: boolean) => void;
  }

  const Input = React.forwardRef<HTMLInputElement, MockInputProps>(({ label, value, placeholder, onValueChange, onKeyDown, isInvalid, errorMessage }, ref) => (
    <label>
      <span>{label}</span>
      <input
        ref={ref}
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={event => onValueChange?.(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {isInvalid && errorMessage ? <span role="alert">{errorMessage}</span> : null}
    </label>
  ));
  Input.displayName = "MockInput";

  return {
    Modal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => (isOpen ? <div>{children}</div> : null),
    ModalContent: ({ children }: { children: React.ReactNode | ((onClose: () => void) => React.ReactNode) }) => (
      <div>{typeof children === "function" ? children(vi.fn()) : children}</div>
    ),
    ModalHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ModalFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Button: ({ children, onPress, isDisabled }: MockButtonProps) => (
      <button type="button" disabled={isDisabled} onClick={onPress}>
        {children}
      </button>
    ),
    Input,
    Switch: ({ children, isSelected, onValueChange }: MockSwitchProps) => (
      <label>
        <span>{children}</span>
        <input
          aria-label={String(children)}
          type="checkbox"
          checked={isSelected}
          onChange={event => onValueChange?.(event.target.checked)}
        />
      </label>
    ),
  };
});

describe("LinkDialog", () => {
  it("编辑已有链接时允许同时提交链接文本", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <LinkDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        currentUrl="https://old.example"
        currentTarget="_blank"
        currentText="旧链接"
        onConfirm={onConfirm}
        onRemove={vi.fn()}
      />
    );

    const textInput = screen.getByLabelText("链接文本");
    expect(textInput).toHaveValue("旧链接");

    fireEvent.change(textInput, { target: { value: "新链接" } });
    await user.clear(screen.getByLabelText("链接地址"));
    await user.type(screen.getByLabelText("链接地址"), "https://new.example");
    await user.click(screen.getByRole("button", { name: "更新" }));

    expect(onConfirm).toHaveBeenCalledWith("https://new.example", "_blank", "新链接");
  });
});
