"use client";
import { useEffect, useRef, useState } from "react";

// IntersectionObserver kích hoạt đúng 1 lần rồi tự ngắt, animation thật nằm ở CSS, component chỉ lo gắn/gỡ class.
export function Reveal({
  children,
  delay,
  className,
}: {
  children: React.ReactNode;
  delay?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px 60px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${seen ? "in-view" : ""} ${delay ? `reveal-delay-${delay}` : ""} ${className ?? ""}`}>
      {children}
    </div>
  );
}
