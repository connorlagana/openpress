import { Logo, navLinkClass } from "@/components/app/brand";
import { requireUser } from "@/server/auth/session";
import { logoutAction } from "../(auth)/actions";
import { NavLink } from "./nav-link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="op-canvas flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <Logo href="/dashboard" compact />
          <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm sm:gap-1" aria-label="Primary">
            <NavLink href="/dashboard" exact>
              Sites
            </NavLink>
            <NavLink href="/dashboard/agents">Agents</NavLink>
            <NavLink href="/dashboard/account">Account</NavLink>
            {user.isAdmin && <NavLink href="/dashboard/analytics">Analytics</NavLink>}
          </nav>
          <div className="ml-auto flex flex-none items-center gap-3 text-sm">
            <span className="hidden max-w-56 truncate text-muted-foreground md:inline">{user.email}</span>
            <form action={logoutAction}>
              <button type="submit" className={navLinkClass}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-20 sm:px-6">{children}</main>
    </div>
  );
}
