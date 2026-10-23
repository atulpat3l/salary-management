import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { ChevronDownIcon, KeyRoundIcon, LogOutIcon, WalletIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { homePath, useAuth } from '@/auth/auth-context'
import { cn } from '@/lib/utils'
import type { Role } from '@/lib/types'

const NAV: Record<Role, { to: string; label: string }[]> = {
  HR: [
    { to: '/employees', label: 'Employees' },
    { to: '/payroll', label: 'Payroll' },
    { to: '/structures', label: 'Salary structures' },
    { to: '/insights', label: 'Insights' },
  ],
  EMPLOYEE: [
    { to: '/payslips', label: 'My payslips' },
    { to: '/disbursements', label: 'Disbursements' },
    { to: '/profile', label: 'My profile' },
  ],
}

/** The signed-in shell. Renders the matched child route, or `children` when used directly. */
export function AppLayout({ children }: { children?: ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  const displayName = user.employee?.fullName ?? 'HR Manager'

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background print:hidden">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link to={homePath(user.role)} className="flex items-center gap-2 font-semibold">
            <WalletIcon className="size-5" aria-hidden />
            <span className="hidden sm:inline">Salary Management</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto" aria-label="Main">
            {NAV[user.role].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
                    isActive && 'bg-muted font-medium text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <span className="max-w-40 truncate">{displayName}</span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span>{displayName}</span>
                <span className="text-xs font-normal text-muted-foreground">{user.loginId}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/change-password')}>
                <KeyRoundIcon />
                Change password
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOutIcon />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        {children ?? <Outlet />}
      </main>
    </div>
  )
}
