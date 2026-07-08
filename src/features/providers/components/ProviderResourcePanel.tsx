import { useTranslation } from 'react-i18next';
import { IconLoader2, IconPlus, IconRefreshCw, IconSearch } from '@/components/ui/icons';
import type { ProviderRecentUsageMap } from '@/components/providers/utils';
import type { ProviderGroup, ProviderResource } from '../types';
import { ProviderResourceTable } from './ProviderResourceTable';
import { ProviderResourceToolbar } from './ProviderResourceToolbar';
import type { ProviderSortBy, SortDir } from '../types';
import styles from './ProviderResourcePanel.module.scss';

export interface ProviderPanelControls {
  sortBy: ProviderSortBy;
  sortDir: SortDir;
  onSortBy: (value: ProviderSortBy) => void;
  onSortDir: (value: SortDir) => void;
  availableModels: ReadonlyArray<string>;
  selectedModels: ReadonlySet<string>;
  onSelectedModelsChange: (next: Set<string>) => void;
}

export interface ProviderHeaderProps {
  totalActive: number;
  totalResources: number;
  providerFamilies: number;
  updatedAtLabel: string;
  isFetching?: boolean;
  isNewDisabled?: boolean;
  newLabel?: string;
  onRefresh: () => void;
  onNew: () => void;
}

interface ProviderResourcePanelProps {
  group: ProviderGroup | null;
  filter: string;
  onFilterChange: (value: string) => void;
  filteredResources: ProviderResource[];
  selectedId: string | null;
  disableMutations?: boolean;
  usageByProvider?: ProviderRecentUsageMap;
  toolbarControls?: ProviderPanelControls;
  onView: (resource: ProviderResource) => void;
  onEdit: (resource: ProviderResource) => void;
  onDelete: (resource: ProviderResource) => void;
  onToggleDisabled?: (resource: ProviderResource, disabled: boolean) => void;
  onCreate: () => void;
  headerProps: ProviderHeaderProps;
}

export function ProviderResourcePanel({
  group,
  filter,
  onFilterChange,
  filteredResources,
  selectedId,
  disableMutations,
  usageByProvider,
  toolbarControls,
  onView,
  onEdit,
  onDelete,
  onToggleDisabled,
  onCreate,
  headerProps,
}: ProviderResourcePanelProps) {
  const { t } = useTranslation();

  const realResources = filteredResources.filter((r) => !r.flags.isPlaceholder);

  return (
    <section className={styles.panel}>
      {/* 合并后的紧凑头部：标题 + 统计chips + 操作按钮 */}
      <div className={styles.compactHeader}>
        <div className={styles.compactHeaderLeft}>
          <h1 className={styles.compactTitle}>{t('providersPage.header.title')}</h1>
          <div className={styles.chips}>
            <span className={`${styles.chip} ${styles.chipPrimary}`}>
              {t('providersPage.header.activeResources', {
                active: headerProps.totalActive,
                total: headerProps.totalResources,
              })}
            </span>
            <span className={styles.chip}>
              {t('providersPage.header.providerFamilies', { count: headerProps.providerFamilies })}
            </span>
            <span className={styles.chip}>
              {t('providersPage.header.updatedAt', { time: headerProps.updatedAtLabel })}
            </span>
          </div>
        </div>
        <div className={styles.compactActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnOutline}`}
            onClick={headerProps.onRefresh}
            disabled={headerProps.isFetching}
            aria-label={
              headerProps.isFetching ? t('providersPage.actions.syncing') : t('providersPage.actions.refresh')
            }
          >
            <span className={`${styles.btnIcon} ${headerProps.isFetching ? styles.spin : ''}`.trim()}>
              {headerProps.isFetching ? <IconLoader2 size={16} /> : <IconRefreshCw size={16} />}
            </span>
            <span>
              {headerProps.isFetching ? t('providersPage.actions.syncing') : t('providersPage.actions.refresh')}
            </span>
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={headerProps.onNew}
            disabled={headerProps.isNewDisabled}
          >
            <IconPlus size={16} />
            <span>{headerProps.newLabel ?? t('providersPage.actions.new')}</span>
          </button>
        </div>
      </div>

      {/* 统一筛选栏：搜索 + Toolbar 合并一行 */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <IconSearch size={16} />
          </span>
          <input
            type="search"
            className={styles.searchInput}
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder={t('providersPage.table.filterPlaceholder')}
          />
        </div>
        {toolbarControls ? (
          <ProviderResourceToolbar
            key={group?.id ?? 'none'}
            sortBy={toolbarControls.sortBy}
            sortDir={toolbarControls.sortDir}
            onSortBy={toolbarControls.onSortBy}
            onSortDir={toolbarControls.onSortDir}
            availableModels={toolbarControls.availableModels}
            selectedModels={toolbarControls.selectedModels}
            onSelectedModelsChange={toolbarControls.onSelectedModelsChange}
          />
        ) : null}
      </div>

      {realResources.length === 0 ? (
        <div className={styles.empty}>
          <div>{t('providersPage.table.empty')}</div>
          <div className={styles.emptyAction}>
            <button
              type="button"
              className={styles.emptyActionButton}
              onClick={onCreate}
            >
              <IconPlus size={16} />
              <span>{t('providersPage.actions.new')}</span>
            </button>
          </div>
        </div>
      ) : (
        <ProviderResourceTable
          resources={filteredResources}
          selectedId={selectedId}
          disableMutations={disableMutations}
          usageByProvider={usageByProvider}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleDisabled={onToggleDisabled}
        />
      )}
    </section>
  );
}
