import { t } from '@/shared/lib/messages/t';

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
    { value: FeedTab.WatchLater, label: t.youtube.watchLater() },
    { value: FeedTab.Liked, label: t.youtube.liked() },
    { value: FeedTab.Subs, label: t.youtube.subscriptions() },
    { value: FeedTab.History, label: t.youtube.history() },
    { value: FeedTab.Playlists, label: t.youtube.playlists() },
  ];
}

export function feedTabLabel(tab: FeedTab): string {
  return feedTabOptions().find((o) => o.value === tab)?.label ?? tab;
}
