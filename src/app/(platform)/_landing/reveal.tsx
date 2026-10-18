"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Fades and lifts its children in the first time they scroll into view. Visible by default without JS. */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");
  useEffect(() => {
    const el = ref.current!;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    const hide = setTimeout(() => setState("hidden"), 0);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setState("shown");
        io.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => {
      clearTimeout(hide);
      io.disconnect();
    };
  }, []);
  return (
    <div ref={ref} className={cn("lp-reveal", state === "hidden" && "is-hidden", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
