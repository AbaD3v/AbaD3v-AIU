"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import type { LineRange } from "../lib/workspace";
import s from "./learning.module.css";

function highlightLine(line: string) {
  const tokens = line.split(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*$|#.*$|\b(?:const|let|var|val|mut|for|foreach|in|of|if|else|return|int|void|public|static|class|fn|func|fun|package|import|range|print|println|echo|number|string)\b|\b\d+\b)/g,
  );
  return tokens.map((token, index) => {
    let className: string | undefined;
    if (/^(\/\/|#)/.test(token)) className = s.tokenComment;
    else if (/^["']/.test(token)) className = s.tokenString;
    else if (/^\d+$/.test(token)) className = s.tokenNumber;
    else if (/^[a-z]+$/.test(token)) className = s.tokenKeyword;
    return (
      <span key={index} className={className}>
        {token}
      </span>
    );
  });
}

export default function CodeEditor({
  code,
  onChange,
  highlight,
  onSelection,
}: {
  code: string;
  onChange: (code: string) => void;
  highlight: LineRange | null;
  onSelection: (range: LineRange | null) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const lines = code.split("\n");
  const longestLine = Math.max(54, ...lines.map((line) => line.length));

  useEffect(() => {
    if (!highlight || !scroller.current) return;
    const targetTop = (highlight.start - 1) * 25;
    const container = scroller.current;
    if (
      targetTop < container.scrollTop ||
      targetTop > container.scrollTop + container.clientHeight - 50
    )
      container.scrollTop = Math.max(0, targetTop - 50);
  }, [highlight]);

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab" || event.shiftKey || code.length > 19998) return;
    event.preventDefault();
    const input = event.currentTarget;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    onChange(code.slice(0, start) + "  " + code.slice(end));
    requestAnimationFrame(() =>
      textarea.current?.setSelectionRange(start + 2, start + 2),
    );
  }

  return (
    <div className={s.editorBody} ref={scroller}>
      <div
        className={s.codeSurface}
        style={{
          minHeight: `${Math.max(18, lines.length + 2) * 25 + 40}px`,
          minWidth: `max(100%, ${longestLine + 8}ch)`,
        }}
      >
        <pre className={s.codePaint} aria-hidden="true">
          {lines.map((line, index) => (
            <span
              className={`${s.codeLine} ${highlight && index + 1 >= highlight.start && index + 1 <= highlight.end ? s.highlightedLine : ""}`}
              key={index}
            >
              <span className={s.lineNumber}>{index + 1}</span>
              <code>
                {highlightLine(line) || " "}
                {line.length === 0 ? " " : ""}
              </code>
            </span>
          ))}
        </pre>
        <textarea
          ref={textarea}
          className={s.codeInput}
          aria-label="Редактор кода"
          aria-describedby="editor-help"
          value={code}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKey}
          onSelect={(event) => {
            const { selectionStart: start, selectionEnd: end } =
              event.currentTarget;
            onSelection(
              start === end
                ? null
                : {
                    start: code.slice(0, start).split("\n").length,
                    end: code.slice(0, Math.max(start, end - 1)).split("\n")
                      .length,
                  },
            );
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          maxLength={20000}
        />
        {!code && (
          <div className={s.editorPlaceholder} aria-hidden="true">
            Вставь свой код сюда…<small>или выбери учебный пример сверху</small>
          </div>
        )}
      </div>
    </div>
  );
}
