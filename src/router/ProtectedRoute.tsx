import { useEffect, useState, type ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const STARTUP_SPLASH_DELAY_MS = 600;

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const managementKey = useAuthStore((state) => state.managementKey);
  const apiBase = useAuthStore((state) => state.apiBase);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const hasStoredCredentials = Boolean(managementKey && apiBase);
  const shouldRestoreSession = !isAuthenticated && hasStoredCredentials;
  const [checking, setChecking] = useState(() => shouldRestoreSession);
  const [restoreAttempted, setRestoreAttempted] = useState(() => !shouldRestoreSession);
  const [showCheckingFeedback, setShowCheckingFeedback] = useState(false);

  useEffect(() => {
    if (!checking) {
      setShowCheckingFeedback(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowCheckingFeedback(true);
    }, STARTUP_SPLASH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [checking]);

  useEffect(() => {
    let cancelled = false;

    const tryRestore = async () => {
      if (isAuthenticated || !hasStoredCredentials) {
        setChecking(false);
        setRestoreAttempted(true);
        return;
      }

      setChecking(true);
      setRestoreAttempted(false);
      try {
        await checkAuth();
      } finally {
        if (!cancelled) {
          setChecking(false);
          setRestoreAttempted(true);
        }
      }
    };

    tryRestore();
    return () => {
      cancelled = true;
    };
  }, [checkAuth, hasStoredCredentials, isAuthenticated]);

  if (!isAuthenticated && hasStoredCredentials && (checking || !restoreAttempted)) {
    return showCheckingFeedback ? (
      <div className="main-content">
        <LoadingSpinner />
      </div>
    ) : null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
