import { NavLink, useLocation } from "react-router-dom"
import {
  Home,
  Calendar,
  FileText,
  Settings,
  PlayCircle,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/schedules", label: "Agendamentos", icon: Calendar },
  { path: "/auto-cancel", label: "Cancel", icon: XCircle },
  { path: "/logs", label: "Logs", icon: FileText },
  { path: "/test-e2e", label: "Teste", icon: PlayCircle },
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
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
