import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { UsageAnalyticsView } from '@/pages/UsageAnalyticsPage';

export const USAGE_VIEWER_ROUTE_ID = 'usage-viewer-root';

const usageViewerPaths = ['/usage-analytics', '/monitoring'] as const;

export function createUsageViewerRoute(element: ReactNode): RouteObject {
  return {
    id: USAGE_VIEWER_ROUTE_ID,
    element,
    children: usageViewerPaths.map((path) => ({ path })),
  };
}

export function usageViewerViewForPathname(pathname: string): UsageAnalyticsView {
  return pathname === '/monitoring' ? 'monitoring' : 'analytics';
}
