import { Editor } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { applyLinkUpdate, getCurrentLinkText } from "./editor-link-utils";

let editor: Editor | null = null;

function createEditor(content: string) {
  editor = new Editor({
    extensions: [
      StarterKit.configure({
        link: false,
      }),
      Link.configure({
        openOnClick: false,
      }),
    ],
    content,
  });
  return editor;
}

function findTextRange(target: string) {
  if (!editor) throw new Error("editor is not ready");
  let foundFrom = -1;
  let foundTo = -1;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    const index = node.text.indexOf(target);
    if (index < 0) return true;
    foundFrom = pos + index;
    foundTo = foundFrom + target.length;
    return false;
  });
  if (foundFrom < 0 || foundTo < 0) throw new Error(`Text not found: ${target}`);
  return { from: foundFrom, to: foundTo };
}

function getLinkMarkAttrs(target: string) {
  if (!editor) throw new Error("editor is not ready");
  const range = findTextRange(target);
  const node = editor.state.doc.nodeAt(range.from);
  return node?.marks.find(mark => mark.type.name === "link")?.attrs;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("editor link utilities", () => {
  it("读取光标所在链接的完整文本", () => {
    const instance = createEditor('<p>打开 <a href="https://old.example">旧链接</a> 查看</p>');
    const range = findTextRange("旧链接");

    instance.commands.setTextSelection(range.from + 1);

    expect(getCurrentLinkText(instance)).toBe("旧链接");
  });

  it("更新已有链接时同时替换文本和链接属性", () => {
    const instance = createEditor('<p>打开 <a href="https://old.example">旧链接</a> 查看</p>');
    const range = findTextRange("旧链接");
    instance.commands.setTextSelection(range.from + 1);

    applyLinkUpdate(instance, {
      text: "新链接",
      url: "https://new.example",
      target: "_blank",
    });

    expect(instance.getText()).toBe("打开 新链接 查看");
    expect(instance.getText()).not.toContain("旧链接");
    expect(getLinkMarkAttrs("新链接")).toMatchObject({
      href: "https://new.example",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("链接文本不变时只更新链接属性", () => {
    const instance = createEditor('<p>打开 <a href="https://old.example">旧链接</a> 查看</p>');
    const range = findTextRange("旧链接");
    instance.commands.setTextSelection(range.from + 1);

    applyLinkUpdate(instance, {
      text: "旧链接",
      url: "https://new.example",
      target: "_self",
    });

    expect(instance.getText()).toBe("打开 旧链接 查看");
    expect(getLinkMarkAttrs("旧链接")).toMatchObject({
      href: "https://new.example",
      target: "_self",
      rel: null,
    });
  });
});
