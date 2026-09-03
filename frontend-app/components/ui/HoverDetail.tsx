"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 8;
const MAX_WIDTH = 320;

// Thay cho title="" thô của trình duyệt, render qua Portal để không bị card cha overflow:hidden cắt mất.
export function HoverDetail({
  children,
  content,
  openDelay = 200,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  openDelay?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleEnter() {
    timerRef.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceBelow = window.innerHeight - rect.bottom;
      const up = spaceBelow < 160 && rect.top > 160;
      setPos({
        top: up ? rect.top - GAP : rect.bottom + GAP,
        left: Math.min(rect.left, window.innerWidth - MAX_WIDTH - GAP),
        up,
      });
      setOpen(true);
    }, openDelay);
  }

  function handleLeave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return (
    <span ref={triggerRef} onMouseEnter={handleEnter} onMouseLeave={handleLeave} className="inline-flex">
      {children}
      {open &&
        pos &&
        createPortal(
          <div
            style={{ position: "fixed", top: pos.top, left: pos.left, maxWidth: MAX_WIDTH, transform: pos.up ? "translateY(-100%)" : undefined }}
            className="z-[110] rounded-lg border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-700 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  );
}
