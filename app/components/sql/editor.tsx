"use client";
import CodeMirror from "@uiw/react-codemirror";
import { sql, SQLite } from "@codemirror/lang-sql";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { useMemo } from "react";
import { sqlSchema } from "@/app/lib/sql/schema";

const theme = EditorView.theme(
  {
    "&": { backgroundColor: "#17251f", color: "#e0ebe3", fontSize: "13px" },
    ".cm-content": {
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
      padding: "20px 0",
      caretColor: "#d4eda4",
    },
    ".cm-line": { padding: "0 20px 0 10px", lineHeight: "1.9" },
    ".cm-gutters": {
      backgroundColor: "#17251f",
      color: "#60756a",
      border: "none",
      minWidth: "48px",
    },
    ".cm-gutterElement": { padding: "0 10px", lineHeight: "1.9" },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "#b9cebf",
    },
    ".cm-activeLine": { backgroundColor: "#ffffff05" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { overflow: "auto", minHeight: "260px" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "#385645",
    },
    ".cm-cursor": { borderLeftColor: "#d7f2ae" },
    ".cm-tooltip": {
      backgroundColor: "#24372c",
      borderColor: "#47614f",
      color: "#e0ebe3",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "#416344",
      color: "#f2f9e8",
    },
  },
  { dark: true },
);
const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#b8db8d" },
  { tag: [tags.string, tags.special(tags.string)], color: "#e5c27d" },
  { tag: tags.number, color: "#dca68e" },
  { tag: tags.comment, color: "#778d7e", fontStyle: "italic" },
  { tag: [tags.name, tags.propertyName], color: "#e0ebe3" },
  { tag: tags.operator, color: "#a9cbb7" },
]);
export default function SqlEditor({
  value,
  onChange,
  onRun,
  onCheck,
}: {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onCheck: () => void;
}) {
  const extensions = useMemo(
    () => [
      sql({ dialect: SQLite, schema: sqlSchema, upperCaseKeywords: true }),
      syntaxHighlighting(highlight),
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            onRun();
            return true;
          },
        },
        {
          key: "Mod-Shift-Enter",
          run: () => {
            onCheck();
            return true;
          },
        },
        indentWithTab,
      ]),
      EditorView.contentAttributes.of({
        "aria-label": "SQL-запрос",
        "data-testid": "sql-editor",
        spellcheck: "false",
      }),
    ],
    [onRun, onCheck],
  );
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      height="290px"
      maxHeight="430px"
      theme={theme}
      basicSetup={{
        foldGutter: false,
        highlightActiveLine: true,
        lineNumbers: true,
        autocompletion: true,
        bracketMatching: true,
        highlightSelectionMatches: true,
      }}
      aria-label="Редактор SQL"
    />
  );
}
