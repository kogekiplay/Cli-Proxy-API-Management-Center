import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import styles from './PasteAuthFileModal.module.scss';

interface PasteAuthFileModalProps {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (name: string, text: string) => Promise<void>;
}

const validateJsonObject = (text: string): boolean => {
  const parsed = JSON.parse(text) as unknown;
  return Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
};

export function PasteAuthFileModal({ open, saving, onClose, onSubmit }: PasteAuthFileModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setText('');
    setError('');
  }, [open]);

  const submit = async () => {
    const fileName = name.trim();
    const rawText = text.trim();
    if (!fileName.endsWith('.json') || fileName.includes('/') || fileName.includes('\\')) {
      setError(t('auth_files.paste_invalid_name'));
      return;
    }
    if (!rawText) {
      setError(t('auth_files.paste_empty_json'));
      return;
    }
    try {
      if (!validateJsonObject(rawText)) {
        setError(t('auth_files.paste_invalid_json'));
        return;
      }
    } catch {
      setError(t('auth_files.paste_invalid_json'));
      return;
    }

    setError('');
    await onSubmit(fileName, rawText);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('auth_files.paste_title')}
      width={720}
      closeDisabled={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={saving}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {error && <div className={styles.error}>{error}</div>}
        <Input
          label={t('auth_files.paste_name_label')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="codex-user@example.com.json"
          disabled={saving}
        />
        <div className={styles.field}>
          <label htmlFor="auth-file-json-text">{t('auth_files.paste_json_label')}</label>
          <textarea
            id="auth-file-json-text"
            className={styles.textarea}
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={saving}
            spellCheck={false}
          />
        </div>
      </div>
    </Modal>
  );
}
