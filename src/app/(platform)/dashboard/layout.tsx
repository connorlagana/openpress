import Link from "next/link";
import { config } from "@/lib/config";
import { requireUser } from "@/server/auth/session";
import { logoutAction } from "../(auth)/actions";
import { NavLink } from "./nav-link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            {config.appName}
          </Link>
          <nav className="flex items-center gap-1 text-sm" aria-label="Primary">
            <NavLink href="/dashboard" exact>
              Sites
            </NavLink>
            <NavLink href="/dashboard/agents">Agents</NavLink>
            <NavLink href="/dashboard/account">Account</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <form action={logoutAction}>
              <button type="submit" className="text-muted-foreground hover:text-foreground">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
