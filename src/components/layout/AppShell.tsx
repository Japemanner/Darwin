import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth, useIsPlatformAdmin } from '@/hooks/useAuth'
import { useAnalysisNotifications } from '@/hooks/useAnalysisNotifications'
import { PushNotificationControl } from '@/components/layout/PushNotificationControl'
import { roleLabel } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  Gauge,
  Bot,
  BookOpen,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  History,
  Map,
} from 'lucide-react'

const navItems = [
  { href: '/command-center', label: 'Overzicht', icon: Gauge },
  { href: '/assistants', label: 'Assistenten', icon: Bot },
  { href: '/knowledge', label: 'Kennisbronnen', icon: BookOpen },
  { href: '/history', label: 'Geschiedenis', icon: History },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/settings', label: 'Instellingen', icon: Settings },
]

// Finished-unseen analyses badge next to the "Assistenten" label (feature 014).
// The count is text — never a color-only signal (constitution IV).
function AnalysisBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
      <span className="sr-only">analyses klaar of mislukt sinds uw laatste bezoek:</span>
      {count}
    </span>
  )
}

function AppShell() {
  const location = useLocation()
  const { profile, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const analysisCount = useAnalysisNotifications(profile?.id)
  // Base page title measured at mount; restored when the count drops to 0
  // (constitution III: the title never contains client content).
  const baseTitleRef = useRef(document.title)

  useEffect(() => {
    const baseTitle = baseTitleRef.current
    document.title = analysisCount > 0 ? `(${analysisCount}) Darwin` : baseTitle
    return () => {
      document.title = baseTitle
    }
  }, [analysisCount])

  const isAdmin = profile?.role === 'admin'
  // Instellingen is platform-admin-only (feature 019); Team stays org-admin-only.
  const { data: isPlatformAdmin = false } = useIsPlatformAdmin()

  return (
    <div className="min-h-screen bg-muted/20">
      <button
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="h-6 w-6" />
      </button>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-background border-r p-4 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-xl font-bold">Darwin</h1>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 flex flex-col gap-1">
              {navItems
                .filter((item) => {
                  if (item.href === '/team') return isAdmin
                  if (item.href === '/settings') return isPlatformAdmin
                  return true
                })
                .map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  location.pathname.startsWith(item.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.href === '/assistants' && <AnalysisBadge count={analysisCount} />}
              </Link>
                ))}
            </nav>
            <div className="border-t pt-4">
              <Link
                to="/roadmap"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Map className="h-4 w-4" aria-hidden="true" />
                <span>Ideeën en wensen</span>
              </Link>
              <PushNotificationControl userId={profile?.id} />
              <div className="mt-2 flex items-center gap-3">
                <Avatar fallback={profile?.full_name || 'Gebruiker'} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{profile?.full_name || 'Onbekende gebruiker'}</p>
                  <p className="text-xs text-muted-foreground truncate">{roleLabel(profile?.role)}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={signOut} aria-label="Uitloggen" title="Uitloggen">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 w-64 bg-background border-r p-4 flex-col hidden lg:flex">
        <h1 className="text-xl font-bold mb-8">Darwin</h1>
        <nav className="flex-1 flex flex-col gap-1">
          {navItems
            .filter((item) => {
              if (item.href === '/team') return isAdmin
              if (item.href === '/settings') return isPlatformAdmin
              return true
            })
            .map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  location.pathname.startsWith(item.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.href === '/assistants' && <AnalysisBadge count={analysisCount} />}
              </Link>
            ))}
        </nav>
        <div className="border-t pt-4">
          <Link
            to="/roadmap"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Map className="h-4 w-4" aria-hidden="true" />
            <span>Ideeën en wensen</span>
          </Link>
          <PushNotificationControl userId={profile?.id} />
          <div className="mt-2 flex items-center gap-3">
            <Avatar fallback={profile?.full_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{roleLabel(profile?.role)}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Uitloggen" title="Uitloggen">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="lg:pl-64 min-h-screen">
        <div className="p-4 lg:p-8 pt-16 lg:pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default AppShell
