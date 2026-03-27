import type { ProgressData } from '../types';

const barEl = document.getElementById('progress-bar')!;
const statusEl = document.getElementById('status-text')!;
const percentEl = document.getElementById('progress-percent')!;

export function updateProgress(data: ProgressData): void {
  barEl.style.width = `${data.percent}%`;
  percentEl.textContent = `${data.percent.toFixed(1)}%`;

  switch (data.status) {
    case 'downloading': {
      const parts: string[] = [];
      if (data.speed) parts.push(data.speed);
      if (data.eta) parts.push(`ETA: ${data.eta}`);
      statusEl.textContent = parts.length
        ? `Descargando... ${parts.join(' | ')}`
        : 'Descargando...';
      break;
    }
    case 'processing':
      statusEl.textContent = 'Procesando video...';
      break;
    case 'finished':
      statusEl.textContent = 'Descarga completada';
      percentEl.textContent = '100%';
      barEl.style.width = '100%';
      break;
    case 'error':
      statusEl.textContent = 'Error en la descarga';
      percentEl.textContent = '';
      break;
  }
}

export function resetProgress(): void {
  barEl.style.width = '0%';
  statusEl.textContent = 'Iniciando descarga...';
  percentEl.textContent = '';
}

export function setStatus(text: string): void {
  statusEl.textContent = text;
}
