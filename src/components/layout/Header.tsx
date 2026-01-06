import { useLocation, NavLink } from "react-router-dom"
import {
  Home,
  Calendar,
  FileText,
  Settings,
  Menu,
  LogOut,
  User,
  PlayCircle,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"

const navItems = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/schedules", label: "Agendamentos", icon: Calendar },
  { path: "/auto-cancel", label: "Auto-Cancel", icon: XCircle },
  { path: "/logs", label: "Logs", icon: FileText },
  { path: "/test-e2e", label: "Teste E2E", icon: PlayCircle },
  { path: "/settings", label: "Configurações", icon: Settings },
]

export function Header() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, signOut } = useAuth()

  // Get current page title
  const currentPage = navItems.find((item) => item.path === location.pathname)
  const pageTitle = currentPage?.label || "Zerve"

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo / Title */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎾</span>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold">Zerve</h1>
              <p className="text-xs text-muted-foreground">
                Reservas automáticas
              </p>
            </div>
            <h1 className="text-lg font-semibold sm:hidden">{pageTitle}</h1>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <NavLink key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "gap-2",
                      isActive && "bg-primary/10 text-primary"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </NavLink>
              )
            })}

            {/* User menu */}
            <div className="ml-2 pl-2 border-l border-border flex items-center gap-2">
              <div className="flex items-center gap-2 px-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {user?.email?.split("@")[0]}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 animate-fade-in">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-2",
                        isActive && "bg-primary/10 text-primary"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </NavLink>
                )
              })}

              {/* User info + Logout mobile */}
              <div className="mt-2 pt-2 border-t border-border">
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {user?.email}
                </div>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                  onClick={() => {
                    signOut()
                    setMobileMenuOpen(false)
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
