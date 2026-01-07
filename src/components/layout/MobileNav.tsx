import { NavLink, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  CalendarClock,
  FileText,
  Settings,
  Ban,
  ListChecks,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { path: "/", label: "Início", icon: LayoutDashboard },
  { path: "/schedules", label: "Automações", icon: CalendarClock },
  { path: "/reservations", label: "Reservas", icon: ListChecks },
  { path: "/auto-cancel", label: "Cancel", icon: Ban },
  { path: "/logs", label: "Histórico", icon: FileText },
  { path: "/settings", label: "Config", icon: Settings },
]

export function MobileNav() {
  const location = useLocation()

  return (
    <nav className="mobile-nav">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn("mobile-nav-item", isActive && "active")}
            >
              <div
                className={cn(
                  "relative p-2 rounded-xl transition-all duration-200",
                  isActive ? "bg-primary/15" : ""
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-all",
                    isActive && "text-primary"
                  )}
                />
                {isActive && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-secondary rounded-full" />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium transition-all",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
