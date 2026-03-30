import { usePageContext } from "vike-react/usePageContext";
import { APP_LOGO, APP_NAME, APP_TAGLINE } from "@/lib/app-config";
import { useCurrentUser, useLogout } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/app/items", label: "Items", icon: "◫" },
  { href: "/app/team", label: "Team", icon: "◎" },
  { href: "/app/settings", label: "Settings", icon: "⚙" },
];

interface SidebarProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { urlPathname } = usePageContext();
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  const initials = user ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase() : "?";

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] text-[13px]">
              {APP_LOGO}
            </div>
            <div>
              <div className="text-sm font-extrabold text-sidebar-foreground">{APP_NAME}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{APP_TAGLINE}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground md:hidden"
            aria-label="Close sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = urlPathname === item.href || urlPathname.startsWith(item.href + "/");
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-2 border-l-2 px-4 py-[9px] text-xs transition-all ${
                  isActive
                    ? "border-sidebar-primary bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "border-transparent text-muted-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <span className={`text-xs ${isActive ? "opacity-100" : "opacity-45"}`}>{item.icon}</span>
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-sidebar-border px-4 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] text-[10px] font-extrabold text-white">
            {initials ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-sidebar-foreground">
              {user ? `${user.first_name} ${user.last_name}` : "Loading..."}
            </div>
            <button
              onClick={logout}
              className="text-[9px] text-muted-foreground hover:text-primary"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
