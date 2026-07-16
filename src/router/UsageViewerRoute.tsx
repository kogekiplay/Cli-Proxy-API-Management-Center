import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { MainLayout } from '@/components/layout/MainLayout';
import { PublicUsageLayout } from '@/components/layout/PublicUsageLayout';
import { publicUsageViewerApi } from '@/services/api/usageAnalytics';
import { useAuthStore } from '@/stores';
import { detectApiBaseFromLocation } from '@/utils/connection';
import type { UsageAnalyticsView } from '@/pages/UsageAnalyticsPage';

const STARTUP_FEEDBACK_DELAY_MS = 600;

type ViewerState = 'checking' | 'authenticated' | 'public' | 'denied';

export function UsageViewerRoute({ view }: { view: UsageAnalyticsView }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const managementKey = useAuthStore((state) => state.managementKey);
  const storedApiBase = useAuthStore((state) => state.apiBase);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const [viewerState, setViewerState] = useState<ViewerState>(() =>
    isAuthenticated ? 'authenticated' : 'checking'
  );
  const [showCheckingFeedback, setShowCheckingFeedback] = useState(false);
  const [publicApiBase, setPublicApiBase] = useState(
    () => storedApiBase || detectApiBaseFromLocation()
  );

  useEffect(() => {
    if (viewerState !== 'checking') {
      setShowCheckingFeedback(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowCheckingFeedback(true), STARTUP_FEEDBACK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [viewerState]);

  useEffect(() => {
    let cancelled = false;

    const resolveViewer = async () => {
      if (isAuthenticated) {
        setViewerState('authenticated');
        return;
      }

      setViewerState('checking');
      if (managementKey && storedApiBase && (await checkAuth())) {
        if (!cancelled) setViewerState('authenticated');
        return;
      }

      const detectedBase = storedApiBase || detectApiBaseFromLocation();
      try {
        const status = await publicUsageViewerApi.status(detectedBase);
        if (!cancelled) {
          setPublicApiBase(detectedBase);
          setViewerState(status.enabled ? 'public' : 'denied');
        }
      } catch {
        if (!cancelled) setViewerState('denied');
      }
    };

    void resolveViewer();
    return () => {
      cancelled = true;
    };
  }, [checkAuth, isAuthenticated, managementKey, storedApiBase]);

  if (viewerState === 'authenticated') return <MainLayout />;
  if (viewerState === 'public') {
    return <PublicUsageLayout view={view} apiBase={publicApiBase} />;
  }
  if (viewerState === 'denied') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return showCheckingFeedback ? (
    <div className="main-content" aria-busy="true">
      <LoadingSpinner />
    </div>
  ) : null;
}
