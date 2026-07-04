import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSessionStatus } from '@/features/session';
import { useAccountFeed } from '../api/get-account-feed/useAccountFeed';
import { FEED_TAB_URLS, FeedTab, feedTabLabel } from '../helpers/feed-tabs';
import type { FeedVideo } from '../models/feed-video.model';

interface OpenPlaylist {
  url: string;
  title: string;
}

/** Matches the backend messages yt-dlp emits when the session is rejected. */
export function isAuthError(e: unknown): boolean {
  return /login|account|cookies|autenticaci/i.test(String(e));
}

/** Tab/playlist/selection state + feed query for My YouTube (guideline §4.18 hook). */
export function useYoutubeFeed() {
  const [tab, setTab] = useState<FeedTab>(FeedTab.WatchLater);
  const [openPlaylist, setOpenPlaylist] = useState<OpenPlaylist | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const queryClient = useQueryClient();

  const session = useSessionStatus();
  const status = session.data;
  const logged = status === 'connected' || status === 'expired';

  // Current source: the active tab, or the playlist opened inside "Playlists".
  const drilled = tab === FeedTab.Playlists && openPlaylist !== null;
  const sourceUrl = drilled ? openPlaylist.url : FEED_TAB_URLS[tab];
  const sourceLabel = drilled ? openPlaylist.title : feedTabLabel(tab);
  const keyDetail = drilled ? [FeedTab.Playlists, openPlaylist.url] : [tab];
  const isPlaylistGrid = tab === FeedTab.Playlists && !openPlaylist;

  const feed = useAccountFeed(sourceUrl, keyDetail, logged);
  const videos = feed.data ?? [];

  const clearSelection = () => setSelected(new Set());

  // session:changed equivalent: on login/reconnect drop every cached feed so the
  // grids reload from scratch; on logout clear the local view state too.
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === status || status === undefined) return;
    prevStatus.current = status;
    if (status === 'connected' || status === 'none') {
      setSelected(new Set());
      setOpenPlaylist(null);
      void queryClient.removeQueries({ queryKey: ['youtube'] });
    }
  }, [status, queryClient]);

  // Empty feed or auth-shaped error: re-check the session (it may have expired
  // silently) so the empty state can offer "Sign in again" (ports refreshSession()).
  const refetchSession = session.refetch;
  const isEmpty = feed.isSuccess && videos.length === 0;
  const authFailed = feed.isError && isAuthError(feed.error);
  useEffect(() => {
    if (isEmpty || authFailed) void refetchSession();
  }, [isEmpty, authFailed, refetchSession]);

  const pickTab = (next: FeedTab) => {
    if (next === tab && !openPlaylist) return; // same-tab click ignored
    setTab(next);
    setOpenPlaylist(null);
    clearSelection();
  };

  const openPlaylistItem = (v: FeedVideo) => {
    setOpenPlaylist({ url: v.url, title: v.title });
    clearSelection();
  };

  const backToPlaylists = () => {
    setOpenPlaylist(null);
    clearSelection();
  };

  const toggle = (url: string) => {
    setSelected((prev) => {
      const nextSel = new Set(prev);
      if (nextSel.has(url)) nextSel.delete(url);
      else nextSel.add(url);
      return nextSel;
    });
  };

  return {
    tab,
    openPlaylist,
    isPlaylistGrid,
    sourceLabel,
    selected,
    videos,
    feed,
    session,
    logged,
    pickTab,
    openPlaylistItem,
    backToPlaylists,
    toggle,
    clearSelection,
  };
}
