import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Server,
  ShieldCheck,
  Sun,
  Terminal,
  Users,
} from 'lucide-react';
import type { UserRole } from 'shared';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/',
    icon: LayoutDashboard,
    roles: ['super_admin', 'admin', 'operator', 'audit'],
  },
  {
    label: 'VPS & Containers',
    to: '/vms',
    icon: Terminal,
    roles: ['super_admin', 'admin', 'operator', 'audit'],
  },
  {
    label: 'Proxmox Nodes',
    to: '/nodes',
    icon: Server,
    roles: ['super_admin', 'admin'],
  },
  {
    label: 'Users & Roles',
    to: '/users',
    icon: Users,
    roles: ['super_admin', 'admin'],
  },
  {
    label: 'Operator Access',
    to: '/access',
    icon: ShieldCheck,
    roles: ['super_admin', 'admin'],
  },
  {
    label: 'Statistics (RRD)',
    to: '/stats',
    icon: Activity,
    roles: ['super_admin', 'admin', 'operator', 'audit'],
  },
  {
    label: 'Reports',
    to: '/reports',
    icon: FileBarChart,
    roles: ['super_admin', 'admin', 'audit'],
  },
  {
    label: 'Activity Logs',
    to: '/logs',
    icon: Activity,
    roles: ['super_admin', 'admin', 'operator', 'audit'],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const visibleNav = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#09090B] text-[#0F172A] dark:text-[#FAFAFA]">
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-64'
        } transition-all duration-200 border-r border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] flex flex-col`}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#E2E8F0] dark:border-[#27272A]">
          {!collapsed && (
            <span className="font-semibold text-sm tracking-tight text-[#2563EB] dark:text-[#3B82F6]">
              TP Cloud Manager
            </span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800"
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-[#2563EB] dark:bg-blue-950/50 dark:text-[#3B82F6]'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#E2E8F0] dark:border-[#27272A]">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] px-6 flex items-center justify-between">
          <div className="text-sm font-medium text-slate-500 dark:text-zinc-400">
            Proxmox VE Multi-Node Cloud Console
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md border border-[#E2E8F0] dark:border-[#27272A] hover:bg-slate-100 dark:hover:bg-zinc-800"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {user && (
              <div className="flex items-center gap-2.5">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-medium">{user.email}</div>
                  <div className="text-[11px] font-mono uppercase text-[#2563EB] dark:text-[#3B82F6]">
                    {user.role}
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
