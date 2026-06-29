import { getMarkRange, type Range } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

interface LinkUpdateInput {
  url: string;
  target: string;
  text: string;
}

function getCurrentLinkRange(editor: Editor): Range | null {
  const linkType = editor.state.schema.marks.link;
  if (!linkType) return null;
  return getMarkRange(editor.state.selection.$from, linkType) ?? null;
}

function getCurrentSelectionRange(editor: Editor): Range | null {
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;
  return { from, to };
}

export function getCurrentLinkText(editor: Editor): string {
  const range = getCurrentLinkRange(editor) ?? getCurrentSelectionRange(editor);
  if (!range) return "";
  return editor.state.doc.textBetween(range.from, range.to, "");
}

export function applyLinkUpdate(editor: Editor, input: LinkUpdateInput): void {
  const url = input.url.trim();

  if (!url) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  const text = input.text.trim();
  const attrs = {
    href: url,
    target: input.target,
    rel: input.target === "_blank" ? "noopener noreferrer" : null,
  };

  if (!text) {
    editor.chain().focus().extendMarkRange("link").setLink(attrs).run();
    return;
  }

  const range = getCurrentLinkRange(editor) ?? getCurrentSelectionRange(editor);
  const currentText = range ? editor.state.doc.textBetween(range.from, range.to, "") : "";

  if (range && text === currentText) {
    editor.chain().focus().extendMarkRange("link").setLink(attrs).run();
    return;
  }

  if (!range) {
    const from = editor.state.selection.from;
    editor
      .chain()
      .focus()
      .insertContent({ type: "text", text, marks: [{ type: "link", attrs }] })
      .setTextSelection({ from, to: from + text.length })
      .run();
    return;
  }

  editor
    .chain()
    .focus()
    .insertContentAt(range, { type: "text", text, marks: [{ type: "link", attrs }] })
    .setTextSelection({ from: range.from, to: range.from + text.length })
    .run();
}
