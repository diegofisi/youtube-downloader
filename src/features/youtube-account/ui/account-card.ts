/**
 * Tarjeta de cuenta/sesión de "Mi YouTube": caché en memoria de AccountInfo
 * (single-flight), pintado de avatar/nombre/badge, alternancia de los paneles
 * logged-in/logged-out y logout. Módulo interno del slice youtube-account:
 * NO se exporta por la fachada (solo lo consume account-view).
 */
import { $ } from '../../../shared/ui/dom';
import { showToast } from '../../../shared/ui/toast';
import { showModal } from '../../../shared/ui/modal';
import { t } from '../../../core/i18n';
import {
  isConnected,
  isExpired,
  refreshSession,
  doLogout,
  openYouTubeLogin,
  getAccountInfo,
  type AccountInfo,
} from '../../session';

interface AccountCardHooks {
  /** Sesión activa/caducada tras updateConnection: la vista decide si recargar el grid. */
  onLoggedIn: () => void;
  /** Logout confirmado: la vista limpia su estado (grid, selección, playlist abierta). */
  onLoggedOut: () => void;
}
let hooks: AccountCardHooks = { onLoggedIn: () => {}, onLoggedOut: () => {} };

/** Abre el login de YouTube con toast de error (login/reconexión). */
export function openLogin(): void {
  openYouTubeLogin().catch(() => showToast(t('No se pudo abrir el login', 'Could not open login'), '', 'error'));
}

// ---------- info real de la cuenta (nombre, handle y avatar) ----------
/** Caché en memoria de la cuenta conectada (se invalida al logout/reconectar). */
let accountInfo: AccountInfo | null = null;
/** Promesa en curso: evita pedir la cuenta más de una vez por sesión. */
let accountInfoPromise: Promise<AccountInfo | null> | null = null;

export function invalidateAccountInfo(): void {
  accountInfo = null;
  accountInfoPromise = null;
  applyAccountInfo(); // restaura la UI genérica ("A" + "Cuenta de YouTube")
}

/** Pide getAccountInfo() una sola vez y pinta el resultado al llegar. */
function ensureAccountInfo(): void {
  if (accountInfoPromise) return;
  const p = getAccountInfo().catch(() => null);
  accountInfoPromise = p;
  void p.then((info) => {
    if (p !== accountInfoPromise) return; // invalidada mientras cargaba
    accountInfo = info;
    applyAccountInfo();
  });
}

/**
 * Pinta (o restaura) avatar y nombre en la tarjeta de cuenta.
 * Los ids `acc-avatar`/`acc-name` se asignan dinámicamente en initAccountCard().
 */
function applyAccountInfo(): void {
  const avatar = document.getElementById('acc-avatar');
  const nameEl = document.getElementById('acc-name');
  if (!avatar || !nameEl) return;

  if (accountInfo) {
    nameEl.textContent = accountInfo.name;
    const prev = avatar.querySelector('img');
    if (accountInfo.avatarUrl && prev?.getAttribute('src') !== accountInfo.avatarUrl) {
      // El degradado del div queda de fondo mientras carga y si la imagen falla.
      avatar.textContent = '';
      const img = document.createElement('img');
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
      img.onerror = () => {
        img.remove();
        avatar.textContent = 'A';
      };
      img.src = accountInfo.avatarUrl;
      avatar.appendChild(img);
    }
  } else {
    avatar.querySelector('img')?.remove();
    avatar.textContent = 'A';
    nameEl.textContent = t('Cuenta de YouTube', 'YouTube account');
  }

  // La descripción depende del estado (conectada/caducada): re-renderizar.
  if (!$('yt-logged-in').hidden) renderAccountCard();
}

export function renderAccountCard(): void {
  const badge = $('acc-badge');
  const badgeText = $('acc-badge-text');
  const desc = $('acc-desc');
  const reconnect = $('btn-yt-reconnect');
  if (isConnected()) {
    badge.style.color = 'var(--success)';
    badge.style.background = 'var(--successSoft)';
    badgeText.textContent = t('Conectada', 'Connected');
    const active = t('Sesión activa con cookies', 'Active session with cookies');
    desc.textContent = accountInfo?.handle ? `${accountInfo.handle} · ${active}` : active;
    reconnect.hidden = true;
    ensureAccountInfo();
  } else {
    badge.style.color = 'var(--warn)';
    badge.style.background = 'var(--warnSoft)';
    badgeText.textContent = t('Caducada', 'Expired');
    desc.textContent = t(
      'La sesión venció o está incompleta — reconéctate para contenido de miembros',
      'The session expired or is incomplete — reconnect for members-only content',
    );
    reconnect.hidden = false;
  }
}

export async function updateConnection(): Promise<void> {
  await refreshSession();
  const logged = isConnected() || isExpired();
  $('yt-logged-out').hidden = logged;
  $('yt-logged-in').hidden = !logged;
  if (logged) {
    renderAccountCard();
    hooks.onLoggedIn();
  }
}

async function handleLogout(): Promise<void> {
  const ok = await showModal(
    t('Cerrar sesión', 'Sign out'),
    t(
      'Se borrarán las cookies guardadas en este equipo. Podrás volver a conectarte cuando quieras.\n\n¿Cerrar sesión de YouTube?',
      'The cookies stored on this device will be deleted. You can reconnect whenever you want.\n\nSign out of YouTube?',
    ),
    true,
  );
  if (!ok) return;
  try {
    await doLogout();
    hooks.onLoggedOut();
    $('yt-logged-out').hidden = false;
    $('yt-logged-in').hidden = true;
    showToast(
      t('Sesión cerrada', 'Signed out'),
      t('Las cookies fueron eliminadas.', 'The cookies were deleted.'),
      'done',
    );
  } catch (e) {
    showToast(t('No se pudo cerrar sesión', 'Could not sign out'), String(e), 'error');
  }
}

/** Asigna los ids dinámicos de la tarjeta y conecta login/reconexión/logout. */
export function initAccountCard(h: AccountCardHooks): void {
  hooks = h;
  // Ids dinámicos (sin tocar index.html) para el círculo del avatar (div con
  // la "A", primer hijo de la tarjeta) y el nombre ("Cuenta de YouTube").
  const accCard = $('btn-yt-logout').parentElement as HTMLElement;
  const avatarDiv = accCard.firstElementChild as HTMLElement | null;
  if (avatarDiv) avatarDiv.id = 'acc-avatar';
  const nameSpan = accCard.querySelector<HTMLElement>('span[data-en="YouTube account"]');
  if (nameSpan) nameSpan.id = 'acc-name';

  $('btn-yt-login').addEventListener('click', openLogin);
  $('btn-yt-reconnect').addEventListener('click', openLogin);
  $('btn-yt-logout').addEventListener('click', () => void handleLogout());
}
