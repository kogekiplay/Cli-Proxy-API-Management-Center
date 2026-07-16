import { lazy, Suspense, useMemo } from 'react';
import { Navigate, useRoutes, type Location } from 'react-router-dom';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuthStore } from '@/stores';

const ProvidersWorkbenchPage = lazy(() =>
  import('@/features/providers/ProvidersWorkbenchPage').then((module) => ({
    default: module.ProvidersWorkbenchPage,
  }))
);
const AuthFilesPage = lazy(() =>
  import('@/pages/AuthFilesPage').then((module) => ({ default: module.AuthFilesPage }))
);
const AuthFilesOAuthExcludedEditPage = lazy(() =>
  import('@/pages/AuthFilesOAuthExcludedEditPage').then((module) => ({
    default: module.AuthFilesOAuthExcludedEditPage,
  }))
);
const AuthFilesOAuthModelAliasEditPage = lazy(() =>
  import('@/pages/AuthFilesOAuthModelAliasEditPage').then((module) => ({
    default: module.AuthFilesOAuthModelAliasEditPage,
  }))
);
const OAuthPage = lazy(() =>
  import('@/pages/OAuthPage').then((module) => ({ default: module.OAuthPage }))
);
const QuotaPage = lazy(() =>
  import('@/pages/QuotaPage').then((module) => ({ default: module.QuotaPage }))
);
const RequestMonitoringPage = lazy(() =>
  import('@/pages/RequestMonitoringPage').then((module) => ({
    default: module.RequestMonitoringPage,
  }))
);
const UsageAnalyticsPage = lazy(() =>
  import('@/pages/UsageAnalyticsPage').then((module) => ({ default: module.UsageAnalyticsPage }))
);
const PluginResourcePage = lazy(() =>
  import('@/features/plugins/PluginResourcePage').then((module) => ({
    default: module.PluginResourcePage,
  }))
);
const PluginsPage = lazy(() =>
  import('@/features/plugins/PluginsPage').then((module) => ({ default: module.PluginsPage }))
);
const PluginStorePage = lazy(() =>
  import('@/features/plugins/PluginStorePage').then((module) => ({
    default: module.PluginStorePage,
  }))
);
const ConfigPage = lazy(() =>
  import('@/pages/ConfigPage').then((module) => ({ default: module.ConfigPage }))
);
const LogsPage = lazy(() =>
  import('@/pages/LogsPage').then((module) => ({ default: module.LogsPage }))
);
const SystemPage = lazy(() =>
  import('@/pages/SystemPage').then((module) => ({ default: module.SystemPage }))
);

const createMainRoutes = (supportsPlugin: boolean) => [
  { path: '/', element: <DashboardPage /> },
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/settings', element: <Navigate to="/config" replace /> },
  { path: '/api-keys', element: <Navigate to="/config" replace /> },
  { path: '/ai-providers', element: <ProvidersWorkbenchPage /> },
  { path: '/ai-providers/*', element: <Navigate to="/ai-providers" replace /> },
  { path: '/auth-files', element: <AuthFilesPage /> },
  { path: '/auth-files/oauth-excluded', element: <AuthFilesOAuthExcludedEditPage /> },
  { path: '/auth-files/oauth-model-alias', element: <AuthFilesOAuthModelAliasEditPage /> },
  { path: '/oauth', element: <OAuthPage /> },
  { path: '/quota', element: <QuotaPage /> },
  { path: '/usage-analytics', element: <UsageAnalyticsPage /> },
  { path: '/monitoring', element: <RequestMonitoringPage /> },
  ...(supportsPlugin
    ? [
        { path: '/plugin-pages/:pluginId/:menuIndex', element: <PluginResourcePage /> },
        { path: '/plugins', element: <PluginsPage /> },
        { path: '/plugin-store', element: <PluginStorePage /> },
        { path: '/plugins/*', element: <Navigate to="/plugins" replace /> },
      ]
    : [
        { path: '/plugin-pages/*', element: <Navigate to="/" replace /> },
        { path: '/plugins/*', element: <Navigate to="/" replace /> },
        { path: '/plugin-store', element: <Navigate to="/" replace /> },
      ]),
  { path: '/config', element: <ConfigPage /> },
  { path: '/logs', element: <LogsPage /> },
  { path: '/system', element: <SystemPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
];

export function MainRoutes({ location }: { location?: Location }) {
  const supportsPlugin = useAuthStore((state) => state.supportsPlugin);
  const routes = useMemo(() => createMainRoutes(supportsPlugin), [supportsPlugin]);
  const routeElement = useRoutes(routes, location);

  return (
    <Suspense
      fallback={
        <div className="route-loading" aria-busy="true">
          <LoadingSpinner size={24} />
        </div>
      }
    >
      {routeElement}
    </Suspense>
  );
}
