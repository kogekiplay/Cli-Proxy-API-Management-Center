import { lazy, Suspense, useEffect } from 'react';
import { Outlet, RouterProvider, createHashRouter } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { NotificationContainer } from '@/components/common/NotificationContainer';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useLanguageStore, useThemeStore } from '@/stores';

const UsageViewerRoute = lazy(() =>
  import('@/router/UsageViewerRoute').then((module) => ({ default: module.UsageViewerRoute }))
);

const renderUsageViewerRoute = (view: 'analytics' | 'monitoring') => (
  <Suspense
    fallback={
      <div className="main-content" aria-busy="true">
        <LoadingSpinner size={24} />
      </div>
    }
  >
    <UsageViewerRoute view={view} />
  </Suspense>
);

function RootShell() {
  return (
    <>
      <NotificationContainer />
      <ConfirmationModal />
      <Outlet />
    </>
  );
}

const router = createHashRouter([
  {
    element: <RootShell />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/usage-analytics', element: renderUsageViewerRoute('analytics') },
      { path: '/monitoring', element: renderUsageViewerRoute('monitoring') },
      {
        path: '/*',
        element: (
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

function App() {
  const initializeTheme = useThemeStore((state) => state.initializeTheme);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  useEffect(() => {
    const cleanupTheme = initializeTheme();
    return cleanupTheme;
  }, [initializeTheme]);

  useEffect(() => {
    setLanguage(language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅用于首屏同步 i18n 语言

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <RouterProvider router={router} />;
}

export default App;
