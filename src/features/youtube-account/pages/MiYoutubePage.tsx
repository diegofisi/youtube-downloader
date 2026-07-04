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
import { H1, H4, P, Small } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
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
    openYouTubeLogin().catch(() => toast.error(t('No se pudo abrir el login', 'Could not open login')));
  };

  const confirmLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLogoutOpen(false);
        toast.success(t('Sesión cerrada', 'Signed out'), {
          description: t('Las cookies fueron eliminadas.', 'The cookies were deleted.'),
        });
      },
      onError: (e) => toast.error(t('No se pudo cerrar sesión', 'Could not sign out'), { description: String(e) }),
    });
  };

  const loadMore = () => {
    void yt.feed.fetchNextPage().then((r) => {
      // Keep the loaded grid: page errors surface as a toast, not a state card.
      if (r.isError)
        toast.error(t('No se pudieron cargar más', 'Could not load more'), { description: String(r.error) });
    });
  };

  const reconnectAction = (
    <Button className="h-9.5 rounded-[10px] px-4.5 text-[13px] font-semibold" onClick={handleLogin}>
      {t('Volver a iniciar sesión', 'Sign in again')}
    </Button>
  );

  const sessionExpired = yt.session.data !== 'connected';
  const emptyNoun = yt.isPlaylistGrid ? t('playlists', 'playlists') : t('videos', 'videos');

  return (
    <Stack gap="none" className="mx-auto w-full max-w-255 px-7.5 pt-6.5 pb-15">
      <Stack gap="none" className="mb-5.5">
        <H1>{t('Mi YouTube', 'My YouTube')}</H1>
        <P color="muted" className="mt-1.25 text-[13.5px]">
          {t(
            'Explora y descarga directamente desde tu propia cuenta.',
            'Browse and download straight from your own account.',
          )}
        </P>
      </Stack>

      {yt.session.isPending && <PageLoading message={t('Cargando sesión...', 'Loading session...')} />}
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
            <H4 className="text-base">{yt.sourceLabel}</H4>
            <Small color="muted" className="text-xs font-normal">
              {!loading && yt.videos.length > 0 ? `${yt.videos.length} ${emptyNoun}` : ''}
            </Small>
            <Box className="flex-1" />
            {chosen.length > 0 && !yt.isPlaylistGrid && (
              <>
                <Button
                  size="sm"
                  className="h-8.5 rounded-[9px] px-3.75 text-[12.5px]"
                  onClick={() => actions.downloadSelected(chosen)}
                >
                  {`${t('Descargar', 'Download')} ${chosen.length}`}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8.5 rounded-[9px] px-3.75 text-[12.5px]"
                  onClick={() => actions.customizeSelected(chosen)}
                >
                  {t('Personalizar', 'Customize')}
                </Button>
              </>
            )}
          </Stack>

          {yt.openPlaylist && (
            <Box className="mb-3">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-[9px] px-3.5 text-[12.5px]"
                onClick={yt.backToPlaylists}
              >
                {t('← Volver a Playlists', '← Back to Playlists')}
              </Button>
            </Box>
          )}

          <MediaGrid>
            {loading && <GridStateCard loading title={`${t('Cargando', 'Loading')} ${yt.sourceLabel}…`} />}
            {!loading && yt.feed.isError && isAuthError(yt.feed.error) && (
              <GridStateCard
                title={t('Tu sesión no está activa', 'Your session is not active')}
                message={t(
                  'YouTube pidió iniciar sesión de nuevo para ver este contenido.',
                  'YouTube asked to sign in again to view this content.',
                )}
                action={reconnectAction}
              />
            )}
            {!loading && yt.feed.isError && !isAuthError(yt.feed.error) && (
              <GridStateCard title={t('No se pudo cargar', 'Could not load')} message={String(yt.feed.error)} />
            )}
            {!loading && yt.feed.isSuccess && yt.videos.length === 0 && sessionExpired && (
              <GridStateCard
                title={t('Tu sesión no está activa', 'Your session is not active')}
                message={t(
                  'YouTube no reconoció la sesión. Vuelve a iniciar sesión para ver tu contenido.',
                  'YouTube did not recognize the session. Sign in again to see your content.',
                )}
                action={reconnectAction}
              />
            )}
            {!loading && yt.feed.isSuccess && yt.videos.length === 0 && !sessionExpired && (
              <GridStateCard
                title={t('Nada por aquí', 'Nothing here')}
                message={t(
                  `No se encontraron ${emptyNoun} en ${yt.sourceLabel}.`,
                  `No ${emptyNoun} found in ${yt.sourceLabel}.`,
                )}
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
                className="h-9.5 rounded-[10px] px-5.5 text-[13px]"
                disabled={yt.feed.isFetchingNextPage}
                onClick={loadMore}
              >
                {yt.feed.isFetchingNextPage && <Loader2Icon className="size-4 animate-spin" />}
                {yt.feed.isFetchingNextPage ? t('Cargando…', 'Loading…') : t('Ver más', 'Show more')}
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
