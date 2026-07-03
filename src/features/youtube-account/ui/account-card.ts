// "My YouTube" account/session card: in-memory AccountInfo cache (single-flight), avatar/name/badge
// painting, logged-in/out panel toggling, logout. Slice-internal: only account-view consumes it.
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
  /** Active/expired session after updateConnection: the view decides whether to reload the grid. */
  onLoggedIn: () => void;
  /** Logout confirmed: the view clears its state (grid, selection, open playlist). */
  onLoggedOut: () => void;
}
let hooks: AccountCardHooks = { onLoggedIn: () => {}, onLoggedOut: () => {} };

/** Opens the YouTube login with an error toast (login/reconnect). */
export function openLogin(): void {
  openYouTubeLogin().catch(() => showToast(t('No se pudo abrir el login', 'Could not open login'), '', 'error'));
}

// ---------- real account info (name, handle, avatar) ----------
/** In-memory cache of the connected account (invalidated on logout/reconnect). */
let accountInfo: AccountInfo | null = null;
/** In-flight promise: avoids fetching the account more than once per session. */
let accountInfoPromise: Promise<AccountInfo | null> | null = null;

export function invalidateAccountInfo(): void {
  accountInfo = null;
  accountInfoPromise = null;
  applyAccountInfo(); // restores the generic UI ("A" + "YouTube account")
}

/** Calls getAccountInfo() only once and paints the result when it arrives. */
function ensureAccountInfo(): void {
  if (accountInfoPromise) return;
  const p = getAccountInfo().catch(() => null);
  accountInfoPromise = p;
  void p.then((info) => {
    if (p !== accountInfoPromise) return; // invalidated while loading
    accountInfo = info;
    applyAccountInfo();
  });
}

/** Paints (or restores) avatar and name on the account card.
 * The `acc-avatar`/`acc-name` ids are assigned dynamically in initAccountCard(). */
function applyAccountInfo(): void {
  const avatar = document.getElementById('acc-avatar');
  const nameEl = document.getElementById('acc-name');
  if (!avatar || !nameEl) return;

  if (accountInfo) {
    nameEl.textContent = accountInfo.name;
    const prev = avatar.querySelector('img');
    if (accountInfo.avatarUrl && prev?.getAttribute('src') !== accountInfo.avatarUrl) {
      // The div's gradient stays as background while loading and if the image fails.
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

  // The description depends on state (connected/expired): re-render.
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

/** Assigns the card's dynamic ids and wires login/reconnect/logout. */
export function initAccountCard(h: AccountCardHooks): void {
  hooks = h;
  // Dynamic ids (without touching index.html) for the avatar circle (div with
  // the "A", first child of the card) and the name ("YouTube account").
  const accCard = $('btn-yt-logout').parentElement as HTMLElement;
  const avatarDiv = accCard.firstElementChild as HTMLElement | null;
  if (avatarDiv) avatarDiv.id = 'acc-avatar';
  const nameSpan = accCard.querySelector<HTMLElement>('span[data-en="YouTube account"]');
  if (nameSpan) nameSpan.id = 'acc-name';

  $('btn-yt-login').addEventListener('click', openLogin);
  $('btn-yt-reconnect').addEventListener('click', openLogin);
  $('btn-yt-logout').addEventListener('click', () => void handleLogout());
}
