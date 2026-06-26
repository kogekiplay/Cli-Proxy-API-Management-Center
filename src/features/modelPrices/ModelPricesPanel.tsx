import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconPlus, IconRefreshCw, IconTrash2 } from '@/components/ui/icons';
import { modelPricesApi } from '@/services/api/modelPrices';
import { useNotificationStore } from '@/stores';
import type { ModelPrice } from '@/types/usage';
import styles from './ModelPricesPanel.module.scss';

type DraftPrice = {
  model: string;
  input_per_1m: string;
  output_per_1m: string;
  cache_read_per_1m: string;
  cache_creation_per_1m: string;
};

const emptyDraft = (): DraftPrice => ({
  model: '',
  input_per_1m: '',
  output_per_1m: '',
  cache_read_per_1m: '',
  cache_creation_per_1m: '',
});

const priceToDraft = (price: ModelPrice): DraftPrice => ({
  model: price.model,
  input_per_1m: String(price.input_per_1m ?? 0),
  output_per_1m: String(price.output_per_1m ?? 0),
  cache_read_per_1m: String(price.cache_read_per_1m ?? 0),
  cache_creation_per_1m: String(price.cache_creation_per_1m ?? 0),
});

const parseDraft = (draft: DraftPrice): ModelPrice | null => {
  const model = draft.model.trim();
  if (!model) return null;
  const input = Number(draft.input_per_1m);
  const output = Number(draft.output_per_1m);
  const cacheRead = Number(draft.cache_read_per_1m);
  const cacheCreation = Number(draft.cache_creation_per_1m);
  if (![input, output, cacheRead, cacheCreation].every((value) => Number.isFinite(value) && value >= 0)) {
    return null;
  }
  return {
    model,
    input_per_1m: input,
    output_per_1m: output,
    cache_read_per_1m: cacheRead,
    cache_creation_per_1m: cacheCreation,
    source: 'manual',
  };
};

export function ModelPricesPanel({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [drafts, setDrafts] = useState<Record<string, DraftPrice>>({});
  const [newDraft, setNewDraft] = useState<DraftPrice>(() => emptyDraft());
  const [loading, setLoading] = useState(false);
  const [savingModel, setSavingModel] = useState<string | null>(null);
  const [error, setError] = useState('');

  const rows = useMemo(
    () => Object.values(drafts).sort((left, right) => left.model.localeCompare(right.model)),
    [drafts]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const prices = await modelPricesApi.list();
      setDrafts(
        Object.fromEntries(prices.map((price) => [price.model, priceToDraft(price)]))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('model_prices.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = (model: string, patch: Partial<DraftPrice>) => {
    setDrafts((current) => ({
      ...current,
      [model]: {
        ...current[model],
        ...patch,
      },
    }));
  };

  const saveDraft = async (draft: DraftPrice) => {
    const price = parseDraft(draft);
    if (!price) {
      showNotification(t('model_prices.invalid_price'), 'error');
      return;
    }
    setSavingModel(price.model);
    try {
      await modelPricesApi.upsert(price.model, price);
      showNotification(t('model_prices.save_success'), 'success');
      await load();
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : t('model_prices.save_failed'),
        'error'
      );
    } finally {
      setSavingModel(null);
    }
  };

  const addNew = async () => {
    await saveDraft(newDraft);
    if (parseDraft(newDraft)) {
      setNewDraft(emptyDraft());
    }
  };

  const deletePrice = async (model: string) => {
    setSavingModel(model);
    try {
      await modelPricesApi.delete(model);
      showNotification(t('model_prices.delete_success'), 'success');
      setDrafts((current) => {
        const next = { ...current };
        delete next[model];
        return next;
      });
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : t('model_prices.delete_failed'),
        'error'
      );
    } finally {
      setSavingModel(null);
    }
  };

  const renderDraftRow = (draft: DraftPrice, key: string, isNew = false) => (
    <tr key={key}>
      <td className={styles.modelCell}>
        <input
          className={styles.input}
          value={draft.model}
          onChange={(event) =>
            isNew
              ? setNewDraft((current) => ({ ...current, model: event.target.value }))
              : updateDraft(key, { model: key })
          }
          disabled={disabled || loading || !isNew || savingModel === key}
          placeholder="gpt-5*"
        />
      </td>
      {(['input_per_1m', 'output_per_1m', 'cache_read_per_1m', 'cache_creation_per_1m'] as const).map(
        (field) => (
          <td className={styles.numberCell} key={field}>
            <input
              className={styles.input}
              type="number"
              min={0}
              step="0.000001"
              value={draft[field]}
              onChange={(event) =>
                isNew
                  ? setNewDraft((current) => ({ ...current, [field]: event.target.value }))
                  : updateDraft(key, { [field]: event.target.value })
              }
              disabled={disabled || loading || (!isNew && savingModel === key)}
            />
          </td>
        )
      )}
      <td className={styles.actionsCell}>
        <div className={styles.actions}>
          <Button
            size="sm"
            variant={isNew ? 'primary' : 'secondary'}
            onClick={() => (isNew ? addNew() : saveDraft(draft))}
            disabled={disabled || loading || Boolean(savingModel)}
            loading={savingModel === draft.model}
          >
            {isNew ? <IconPlus size={14} /> : t('common.save')}
          </Button>
          {!isNew && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => deletePrice(key)}
              disabled={disabled || loading || Boolean(savingModel)}
              loading={savingModel === key}
              title={t('common.delete')}
            >
              <IconTrash2 size={14} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <Card
      className={styles.panel}
      title={t('model_prices.title')}
      extra={
        <div className={styles.toolbar}>
          <Button variant="secondary" size="sm" onClick={load} disabled={disabled || loading}>
            <IconRefreshCw size={14} />
            {t('common.refresh')}
          </Button>
        </div>
      }
    >
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('model_prices.model')}</th>
              <th>{t('model_prices.input')}</th>
              <th>{t('model_prices.output')}</th>
              <th>{t('model_prices.cache_read')}</th>
              <th>{t('model_prices.cache_write')}</th>
              <th>{t('common.action')}</th>
            </tr>
          </thead>
          <tbody>
            {renderDraftRow(newDraft, '__new__', true)}
            {rows.map((draft) => renderDraftRow(draft, draft.model))}
            {rows.length === 0 && !loading && (
              <tr>
                <td className={styles.empty} colSpan={6}>
                  {t('model_prices.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
