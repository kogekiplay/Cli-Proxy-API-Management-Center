import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { opencodeGoApi } from '@/services/api/opencodeGo';
import { useAuthStore, useNotificationStore } from '@/stores';
import { copyToClipboard } from '@/utils/clipboard';
import { resolveOpenCodeGoManagementBase } from './helpers';
import styles from './OpenCodeGoImportCard.module.scss';

interface OpenCodeGoImportCardProps {
  disabled?: boolean;
}

export function OpenCodeGoImportCard({ disabled = false }: OpenCodeGoImportCardProps) {
  const { t } = useTranslation();
  const apiBase = useAuthStore((state) => state.apiBase);
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [copyingConfig, setCopyingConfig] = useState(false);

  const copyConfig = async () => {
    setCopyingConfig(true);
    try {
      const config = await opencodeGoApi.userscriptConfig();
      const configText = JSON.stringify(
        {
          scriptName: config.name,
          match: config.match,
          cpaManagementBase: resolveOpenCodeGoManagementBase(apiBase, config.managementBase),
          managementKey: '<填写你的 CPA 管理密钥>',
          endpoints: config.endpoints,
        },
        null,
        2
      );
      const ok = await copyToClipboard(configText);
      showNotification(
        ok ? t('opencode_go.config_copied') : t('notification.copy_failed'),
        ok ? 'success' : 'error'
      );
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : t('opencode_go.config_copy_failed'),
        'error'
      );
    } finally {
      setCopyingConfig(false);
    }
  };

  return (
    <Card
      title={t('opencode_go.import_title')}
      extra={
        <Button
          variant="secondary"
          size="sm"
          onClick={copyConfig}
          disabled={disabled || copyingConfig}
          loading={copyingConfig}
        >
          {t('opencode_go.copy_config')}
        </Button>
      }
      className={styles.card}
    >
      <div className={styles.body}>
        <p>{t('opencode_go.import_desc')}</p>
        <div className={styles.steps}>
          <span>{t('opencode_go.import_step_install')}</span>
          <span>{t('opencode_go.import_step_login')}</span>
          <span>{t('opencode_go.import_step_sync')}</span>
        </div>
      </div>
    </Card>
  );
}
