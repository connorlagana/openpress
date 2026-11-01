"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href || (href === "/dashboard" && path.startsWith("/dashboard/sites")) : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("whitespace-nowrap rounded-lg px-2 py-1.5 transition-colors sm:px-2.5", active ? "bg-foreground/[.06] font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
    >
      {children}
    </Link>
  );
}

export function TabLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href || path.startsWith(href + "/posts") : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "-mb-px shrink-0 border-b-2 px-1 pb-2.5 text-sm transition-colors",
        active ? "border-signal font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
