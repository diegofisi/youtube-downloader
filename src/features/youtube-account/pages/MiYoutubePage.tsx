import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { GridStateCard } from '@/shared/components/media/GridStateCard';
import { MediaCard } from '@/shared/components/media/MediaCard';
import { MediaGrid } from '@/shared/components/media/MediaGrid';
import { Button } from '@/shared/components/ui/button';
import { ChipGroup } from '@/shared/components/ui/ChipGroup';
import { PageLoading } from '@/shared/components/ui/PageLoading';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';
import { openYouTubeLogin, useAccountInfo, useLogout } from '@/features/session';
import { AccountCard } from '../components/AccountCard';
import { LoggedOutHero } from '../components/LoggedOutHero';
import { LogoutDialog } from '../components/LogoutDialog';
import { PlaylistCard } from '../components/PlaylistCard';
import { feedTabOptions } from '../helpers/feed-tabs';
import { useFeedActions } from '../hooks/useFeedActions';
import { isAuthError, useYoutubeFeed } from '../hooks/useYoutubeFeed';

// Pattern C: heavy state lives in useYoutubeFeed/useFeedActions; the page composes.
export const MiYoutubePage = () => {
  const yt = useYoutubeFeed();
  const actions = useFeedActions(yt.clearSelection);
  const { data: account } = useAccountInfo();
  const logout = useLogout();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const chosen = yt.videos.filter((v) => yt.selected.has(v.url));
  const loading = yt.feed.isFetching && !yt.feed.isFetchingNextPage;

  const handleLogin = () => {
    openYouTubeLogin().catch(() => toast.error(t.common.couldNotOpenLogin()));
  };

  const confirmLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLogoutOpen(false);
        toast.success(t.youtube.loggedOutToast(), {
          description: t.youtube.loggedOutToastBody(),
        });
      },
      onError: (e) => toast.error(t.youtube.logoutError(), { description: String(e) }),
    });
  };

  const loadMore = () => {
    void yt.feed.fetchNextPage().then((r) => {
      // Keep the loaded grid: page errors surface as a toast, not a state card.
      if (r.isError)
        toast.error(t.common.couldNotLoadMore(), { description: String(r.error) });
    });
  };

  const reconnectAction = (
    <Button className="h-9.5 rounded-[10px] px-4.5 text-body-sm font-semibold" onClick={handleLogin}>
      {t.youtube.loginAgain()}
    </Button>
  );

  const sessionExpired = yt.session.data !== 'connected';
  const emptyNoun = yt.isPlaylistGrid ? t.youtube.playlistsNoun() : t.youtube.videosNoun();

  return (
    <Stack gap="none" className="mx-auto w-full max-w-255 px-7.5 pt-6.5 pb-15">
      <Stack gap="none" className="mb-5.5">
        <Text variant="h1">{t.common.myYoutube()}</Text>
        <Text variant="body-sm" color="muted" className="mt-1.25">
          {t.youtube.pageSubtitle()}
        </Text>
      </Stack>

      {yt.session.isPending && <PageLoading message={t.youtube.loadingSession()} />}
      {!yt.session.isPending && !yt.logged && <LoggedOutHero onLogin={handleLogin} />}

      {yt.logged && (
        <>
          <AccountCard
            name={account?.name ?? null}
            handle={account?.handle ?? null}
            avatarUrl={account?.avatarUrl ?? null}
            expired={yt.session.data === 'expired'}
            onReconnect={handleLogin}
            onLogout={() => setLogoutOpen(true)}
          />

          <Box className="mr-auto mb-4.5 w-fit">
            <ChipGroup options={feedTabOptions()} value={yt.tab} onChange={yt.pickTab} />
          </Box>

          {/* min-height keeps the grid from jumping when the selection buttons appear */}
          <Stack direction="row" gap="md" align="center" className="mb-3.5 min-h-8.5 gap-3">
            <Text variant="h4" className="text-base">{yt.sourceLabel}</Text>
            <Text variant="small" color="muted" className="text-xs font-normal">
              {!loading && yt.videos.length > 0 ? `${yt.videos.length} ${emptyNoun}` : ''}
            </Text>
            <Box className="flex-1" />
            {chosen.length > 0 && !yt.isPlaylistGrid && (
              <>
                <Button
                  size="sm"
                  className="h-8.5 rounded-[9px] px-3.75 text-small"
                  onClick={() => actions.downloadSelected(chosen)}
                >
                  {`${t.common.download()} ${chosen.length}`}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8.5 rounded-[9px] px-3.75 text-small"
                  onClick={() => actions.customizeSelected(chosen)}
                >
                  {t.common.customize()}
                </Button>
              </>
            )}
          </Stack>

          {yt.openPlaylist && (
            <Box className="mb-3">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-[9px] px-3.5 text-small"
                onClick={yt.backToPlaylists}
              >
                {t.youtube.backToPlaylists()}
              </Button>
            </Box>
          )}

          <MediaGrid>
            {loading && <GridStateCard loading title={`${t.youtube.loading()} ${yt.sourceLabel}…`} />}
            {!loading && yt.feed.isError && isAuthError(yt.feed.error) && (
              <GridStateCard
                title={t.youtube.notActiveTitle()}
                message={t.youtube.notActiveBody()}
                action={reconnectAction}
              />
            )}
            {!loading && yt.feed.isError && !isAuthError(yt.feed.error) && (
              <GridStateCard title={t.youtube.loadError()} message={String(yt.feed.error)} />
            )}
            {!loading && yt.feed.isSuccess && yt.videos.length === 0 && sessionExpired && (
              <GridStateCard
                title={t.youtube.notActiveTitle()}
                message={t.youtube.sessionRejected()}
                action={reconnectAction}
              />
            )}
            {!loading && yt.feed.isSuccess && yt.videos.length === 0 && !sessionExpired && (
              <GridStateCard
                title={t.youtube.emptyFeed()}
                message={t.youtube.emptyFeedFor({ noun: emptyNoun, source: yt.sourceLabel })}
              />
            )}
            {!loading &&
              yt.isPlaylistGrid &&
              yt.videos.map((v) => <PlaylistCard key={v.id || v.url} item={v} onOpen={yt.openPlaylistItem} />)}
            {!loading &&
              !yt.isPlaylistGrid &&
              yt.videos.map((v) => (
                <MediaCard
                  key={v.id || v.url}
                  item={v}
                  selected={yt.selected.has(v.url)}
                  onToggleSelect={() => yt.toggle(v.url)}
                  onDownload={() => actions.downloadOne(v)}
                  onCustomize={() => actions.customizeOne(v)}
                />
              ))}
          </MediaGrid>

          {!loading && yt.feed.hasNextPage && yt.videos.length > 0 && (
            <Stack direction="row" justify="center" className="mt-4">
              <Button
                variant="outline"
                className="h-9.5 rounded-[10px] px-5.5 text-body-sm"
                disabled={yt.feed.isFetchingNextPage}
                onClick={loadMore}
              >
                {yt.feed.isFetchingNextPage && <Loader2Icon className="size-4 animate-spin" />}
                {yt.feed.isFetchingNextPage ? t.common.loadingEllipsis() : t.common.seeMore()}
              </Button>
            </Stack>
          )}

          <LogoutDialog
            open={logoutOpen}
            onOpenChange={setLogoutOpen}
            onConfirm={confirmLogout}
            isPending={logout.isPending}
          />
        </>
      )}
    </Stack>
  );
};
