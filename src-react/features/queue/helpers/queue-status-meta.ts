import { t } from '@/shared/lib/i18n';
import { QueueStatus } from '../models/queue-item.model';

export interface QueueStatusMeta {
  label: string;
  /** CSS var reference — the palette lives in globals.css, light/dark aware. */
  color: string;
}

/** Status pill label + color (vanilla queue-view QMAP). Function, not a constant:
 * labels must re-evaluate t() on every render (live language switch). */
export function getQueueStatusMeta(status: QueueStatus): QueueStatusMeta {
  const map: Record<QueueStatus, QueueStatusMeta> = {
    [QueueStatus.Downloading]: { label: t('Descargando', 'Downloading'), color: 'var(--accent)' },
    [QueueStatus.Merging]: { label: t('Procesando', 'Processing'), color: 'var(--info)' },
    [QueueStatus.Queued]: { label: t('En cola', 'Queued'), color: 'var(--text2)' },
    [QueueStatus.Paused]: { label: t('Pausado', 'Paused'), color: 'var(--warn)' },
    [QueueStatus.Done]: { label: t('Completado', 'Completed'), color: 'var(--success)' },
    [QueueStatus.Error]: { label: t('Error', 'Error'), color: 'var(--danger)' },
    [QueueStatus.Canceled]: { label: t('Cancelado', 'Canceled'), color: 'var(--text3)' },
  };
  return map[status];
}
