import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconChartLine, IconShield, IconSidebarLogs } from '@/components/ui/icons';
import { UsageAnalyticsPage, type UsageAnalyticsView } from '@/pages/UsageAnalyticsPage';
import logoImage from '@/assets/logo.jpg';
import styles from './PublicUsageLayout.module.scss';

export function PublicUsageLayout({
  view,
  apiBase,
}: {
  view: UsageAnalyticsView;
  apiBase: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <img src={logoImage} alt="CPA" />
            <div>
              <strong>CLI Proxy API</strong>
              <span>{t('public_usage_viewer.title')}</span>
            </div>
          </div>

          <nav className={styles.nav} aria-label={t('public_usage_viewer.title')}>
            <NavLink
              to="/monitoring"
              className={({ isActive }) => (isActive ? styles.active : undefined)}
            >
              <IconSidebarLogs size={16} />
              {t('nav.request_monitoring')}
            </NavLink>
            <NavLink
              to="/usage-analytics"
              className={({ isActive }) => (isActive ? styles.active : undefined)}
            >
              <IconChartLine size={16} />
              {t('nav.usage_analytics')}
            </NavLink>
          </nav>

          <div className={styles.headerActions}>
            <span className={styles.readonlyBadge}>
              <IconShield size={14} />
              {t('public_usage_viewer.readonly')}
            </span>
            <Link className={styles.loginLink} to="/login">
              {t('public_usage_viewer.admin_login')}
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.content}>
        <p className={styles.notice}>{t('public_usage_viewer.notice')}</p>
        <UsageAnalyticsPage view={view} publicMode publicApiBase={apiBase} />
      </main>
    </div>
  );
}
