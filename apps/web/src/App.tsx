import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UserRole } from 'shared';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { PendingAccessPage } from './pages/PendingAccessPage';
import { DashboardPage } from './pages/DashboardPage';
import { VmsPage } from './pages/VmsPage';
import { NodesPage } from './pages/NodesPage';
import { UsersPage } from './pages/UsersPage';
import { AccessPage } from './pages/AccessPage';
import { StatsPage } from './pages/StatsPage';
import { ReportsPage } from './pages/ReportsPage';
import { LogsPage } from './pages/LogsPage';
import { AboutPage } from './pages/AboutPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RoleRoute({
  roles,
  children,
}: {
  roles: UserRole[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (user.role === 'no_access') {
    return <PendingAccessPage />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/vms" element={<VmsPage />} />
        <Route
          path="/nodes"
          element={
            <RoleRoute roles={['super_admin', 'admin']}>
              <NodesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/users"
          element={
            <RoleRoute roles={['super_admin', 'admin']}>
              <UsersPage />
            </RoleRoute>
          }
        />
        <Route
          path="/access"
          element={
            <RoleRoute roles={['super_admin', 'admin']}>
              <AccessPage />
            </RoleRoute>
          }
        />
        <Route path="/stats" element={<StatsPage />} />
        <Route
          path="/reports"
          element={
            <RoleRoute roles={['super_admin', 'admin', 'audit']}>
              <ReportsPage />
            </RoleRoute>
          }
        />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
