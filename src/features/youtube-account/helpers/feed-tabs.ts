import { t } from '@/shared/lib/i18n';

export const FeedTab = {
  WatchLater: 'wl',
  Liked: 'liked',
  Subs: 'subs',
  History: 'history',
  Playlists: 'playlists',
} as const;
export type FeedTab = (typeof FeedTab)[keyof typeof FeedTab];

export const FEED_TAB_URLS: Record<FeedTab, string> = {
  wl: 'https://www.youtube.com/playlist?list=WL',
  liked: 'https://www.youtube.com/playlist?list=LL',
  subs: 'https://www.youtube.com/feed/subscriptions',
  history: 'https://www.youtube.com/feed/history',
  playlists: 'https://www.youtube.com/feed/playlists',
};

/** Labels resolve at call time so language switches re-evaluate them. */
export function feedTabOptions(): { value: FeedTab; label: string }[] {
  return [
    { value: FeedTab.WatchLater, label: t('Ver más tarde', 'Watch later') },
    { value: FeedTab.Liked, label: t('Me gusta', 'Liked') },
    { value: FeedTab.Subs, label: t('Suscripciones', 'Subscriptions') },
    { value: FeedTab.History, label: t('Historial', 'History') },
    { value: FeedTab.Playlists, label: t('Playlists', 'Playlists') },
  ];
}

export function feedTabLabel(tab: FeedTab): string {
  return feedTabOptions().find((o) => o.value === tab)?.label ?? tab;
}
