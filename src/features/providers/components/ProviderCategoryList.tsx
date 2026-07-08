import { useTranslation } from 'react-i18next';
import { PROVIDER_LOGOS } from '../brandLogos';
import type { ProviderBrand, ProviderGroup } from '../types';
import styles from './ProviderCategoryList.module.scss';

interface ProviderCategoryListProps {
  groups: ProviderGroup[];
  activeBrand: ProviderBrand;
  onSelect: (brand: ProviderBrand) => void;
}

export function ProviderCategoryList({ groups, activeBrand, onSelect }: ProviderCategoryListProps) {
  const { t } = useTranslation();

  const renderGroupItem = (group: ProviderGroup) => {
    const active = group.id === activeBrand;
    const realResources = group.resources.filter((r) => !r.flags.isPlaceholder);
    const total = realResources.length;
    const activeCount = realResources.filter((r) => !r.disabled).length;
    const logo = PROVIDER_LOGOS[group.id];
    const logoClassName = [
      styles.logo,
      logo?.transparent ? styles.logoTransparent : '',
      logo?.darkSrc ? styles.logoThemeLight : '',
      logo?.invertOnDark ? styles.logoInvertOnDark : '',
    ]
      .filter(Boolean)
      .join(' ');
    const darkLogoClassName = [
      styles.logo,
      logo?.transparent ? styles.logoTransparent : '',
      styles.logoThemeDark,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        key={group.id}
        type="button"
        className={`${styles.item} ${active ? styles.active : ''}`}
        onClick={() => onSelect(group.id)}
        aria-current={active ? 'page' : undefined}
      >
        <span className={styles.itemLeft}>
          {logo ? (
            <>
              <img src={logo.src} alt="" aria-hidden="true" className={logoClassName} />
              {logo.darkSrc ? (
                <img
                  src={logo.darkSrc}
                  alt=""
                  aria-hidden="true"
                  className={darkLogoClassName}
                />
              ) : null}
            </>
          ) : null}
          <span className={styles.itemText}>
            <span className={styles.itemTitle}>
              {t(`providersPage.providerNames.${group.id}`)}
            </span>
            <span className={styles.itemSubtitle}>
              {t('providersPage.categories.activeCount', {
                active: activeCount,
                total,
              })}
            </span>
          </span>
        </span>
        <span className={`${styles.badge} ${total === 0 ? styles.badgeAmber : ''}`}>
          {total}
        </span>
      </button>
    );
  };

  return (
    <div className={styles.stack}>
      {/* ≥1280px: 竖向侧栏 */}
      <aside className={styles.aside}>
        <p className={styles.eyebrow}>{t('providersPage.categories.title')}</p>
        <div className={styles.list}>
          {groups.map((group) => renderGroupItem(group))}
        </div>
      </aside>

      {/* <1280px: 水平滚动标签栏 */}
      <div className={styles.horizontalTabs}>
        {groups.map((group) => {
          const active = group.id === activeBrand;
          const realResources = group.resources.filter((r) => !r.flags.isPlaceholder);
          const total = realResources.length;
          const logo = PROVIDER_LOGOS[group.id];
          const tabLogoClassName = [
            styles.tabLogo,
            logo?.darkSrc ? styles.logoThemeLight : '',
            logo?.invertOnDark ? styles.logoInvertOnDark : '',
          ]
            .filter(Boolean)
            .join(' ');
          const tabDarkLogoClassName = [styles.tabLogo, styles.logoThemeDark]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={group.id}
              type="button"
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              onClick={() => onSelect(group.id)}
              aria-current={active ? 'page' : undefined}
            >
              {logo ? (
                <>
                  <img src={logo.src} alt="" aria-hidden="true" className={tabLogoClassName} />
                  {logo.darkSrc ? (
                    <img
                      src={logo.darkSrc}
                      alt=""
                      aria-hidden="true"
                      className={tabDarkLogoClassName}
                    />
                  ) : null}
                </>
              ) : null}
              <span className={styles.tabLabel}>
                {t(`providersPage.providerNames.${group.id}`)}
              </span>
              <span className={`${styles.tabBadge} ${total === 0 ? styles.badgeAmber : ''}`}>
                {total}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
