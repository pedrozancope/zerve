import { useLocation, NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  CalendarClock,
  FileText,
  Settings,
  Menu,
  LogOut,
  FlaskConical,
  Ban,
  ListChecks,
  ChevronDown,
  X,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"

// Itens principais da navegação
const mainNavItems = [
  {
    path: "/",
    label: "Início",
    icon: LayoutDashboard,
    description: "Visão geral",
  },
  {
    path: "/schedules",
    label: "Automações",
    icon: CalendarClock,
    description: "Agendamentos automáticos",
  },
  {
    path: "/reservations",
    label: "Reservas",
    icon: ListChecks,
    description: "Suas reservas ativas",
  },
]

// Itens de ferramentas/utilitários
const toolNavItems = [
  {
    path: "/auto-cancel",
    label: "Auto-Cancel",
    icon: Ban,
    description: "Cancelamento automático",
  },
  {
    path: "/logs",
    label: "Logs",
    icon: FileText,
    description: "Logs de execução",
  },
  {
    path: "/test-e2e",
    label: "Playground",
    icon: FlaskConical,
    description: "Testar reservas",
  },
]

export function Header() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { user, signOut } = useAuth()
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const userName = user?.email?.split("@")[0] || "Usuário"
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-secondary to-secondary/60 flex items-center justify-center shadow-lg shadow-secondary/20 group-hover:shadow-secondary/40 transition-all duration-300 group-hover:scale-105">
                <span className="text-lg font-bold text-primary-foreground drop-shadow-sm">
                  Z
                </span>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-secondary rounded-full animate-pulse" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Zerve
              </h1>
              <p className="text-[10px] text-muted-foreground font-medium tracking-wide">
                RESERVAS AUTOMÁTICAS
              </p>
            </div>
          </NavLink>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center">
            {/* Main Nav */}
            <div className="flex items-center bg-muted/50 rounded-2xl p-1.5">
              {mainNavItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className="relative group"
                  >
                    <div
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <item.icon
                        className={cn("h-4 w-4", isActive && "text-primary")}
                      />
                      <span>{item.label}</span>
                    </div>
                    {/* Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-foreground text-background text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      {item.description}
                    </div>
                  </NavLink>
                )
              })}
            </div>

            {/* Separator */}
            <div className="w-px h-8 bg-border mx-3" />

            {/* Tools Nav */}
            <div className="flex items-center gap-1">
              {toolNavItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className="relative group"
                  >
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                    {/* Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-foreground text-background text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      {item.description}
                    </div>
                  </NavLink>
                )
              })}
            </div>
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Settings Icon */}
            <NavLink to="/settings" className="hidden lg:flex">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "rounded-xl",
                  location.pathname === "/settings" &&
                    "bg-primary/10 text-primary"
                )}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </NavLink>

            {/* User Menu */}
            <div className="relative hidden md:block" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-2xl transition-all duration-200",
                  userMenuOpen ? "bg-muted" : "hover:bg-muted/50"
                )}
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-semibold text-sm shadow-sm">
                  {userInitial}
                </div>
                <span className="text-sm font-medium max-w-[100px] truncate hidden xl:block">
                  {userName}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform hidden xl:block",
                    userMenuOpen && "rotate-180"
                  )}
                />
              </button>

              {/* User Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-card rounded-2xl shadow-xl border border-border/50 overflow-hidden animate-fade-in">
                  <div className="p-4 border-b border-border/50 bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-lg shadow-sm">
                        {userInitial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{userName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <NavLink
                      to="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors"
                    >
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Configurações</span>
                    </NavLink>
                    <button
                      onClick={() => {
                        signOut()
                        setUserMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 transition-colors text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="text-sm font-medium">Sair da conta</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden rounded-xl"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-16 bg-background/95 backdrop-blur-sm z-50 animate-fade-in">
          <div className="container mx-auto px-4 py-6">
            {/* Mobile Nav Title */}
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Navegação
              </span>
            </div>

            {/* Main Nav Mobile */}
            <div className="space-y-1 mb-6">
              {mainNavItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <NavLink key={item.path} to={item.path}>
                    <div
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-2xl transition-all",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </NavLink>
                )
              })}
            </div>

            {/* Tools Section */}
            <div className="flex items-center gap-2 mb-4">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ferramentas
              </span>
            </div>

            <div className="space-y-1 mb-6">
              {toolNavItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <NavLink key={item.path} to={item.path}>
                    <div
                      className={cn(
                        "flex items-center gap-4 px-4 py-4 rounded-2xl transition-all",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </NavLink>
                )
              })}
            </div>

            {/* Settings Mobile */}
            <NavLink to="/settings">
              <div
                className={cn(
                  "flex items-center gap-4 px-4 py-4 rounded-2xl transition-all mb-6",
                  location.pathname === "/settings"
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    location.pathname === "/settings"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Configurações</p>
                  <p className="text-xs text-muted-foreground">
                    Preferências e tokens
                  </p>
                </div>
              </div>
            </NavLink>

            {/* User Section Mobile */}
            <div className="border-t border-border pt-6">
              <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 rounded-2xl mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-lg shadow-sm">
                  {userInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium"
              >
                <LogOut className="h-5 w-5" />
                Sair da conta
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
