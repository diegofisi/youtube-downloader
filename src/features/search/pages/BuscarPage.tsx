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
import { Text } from '@/shared/components/ui/typography';
import { errorText } from '@/shared/lib/error-text';
import { t } from '@/shared/lib/messages/t';
import { isSessionAuthError, openYouTubeLogin, SessionStatus, useSessionStatus } from '@/features/session';
import { useSearchVideos } from '../api/search-videos/useSearchVideos';
import { SearchBar } from '../components/SearchBar';
import { SearchChip, searchChipLabel, searchChipOptions } from '../helpers/search-chips';
import { useSearchActions } from '../hooks/useSearchActions';

// Pattern C-lite: one infinite query + local selection state; actions live in useSearchActions.
export const BuscarPage = () => {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<SearchChip>(SearchChip.Todo);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const clearSelection = () => setSelected(new Set());
  const actions = useSearchActions(clearSelection);
  const search = useSearchVideos(query, chip);

  const videos = search.data ?? [];
  const chosen = videos.filter((v) => selected.has(v.url));
  // First page in flight (initial or re-submitted search) — not "See more".
  const searching = search.isFetching && !search.isFetchingNextPage;
  const { data: sessionStatus } = useSessionStatus();
  // No results on screen: the failure gets a state card. With results kept by React
  // Query (re-submit / "See more"), it gets a toast instead so the grid stays usable.
  const failed = query !== '' && !searching && search.isError && !search.data;
  const sessionRejected = failed && isSessionAuthError(search.error);
  // Without a stored session there is nothing to renew: YouTube simply demands a login.
  const sessionBody =
    sessionStatus === SessionStatus.None ? t.search.sessionNeededBody() : t.search.sessionExpiredBody();

  const reconnect = () => {
    openYouTubeLogin().catch(() => toast.error(t.common.couldNotOpenLogin()));
  };

  const notifyError = (e: unknown) => {
    if (isSessionAuthError(e)) {
      toast.warning(t.search.sessionExpiredTitle(), {
        description: sessionBody,
        action: { label: t.common.reconnect(), onClick: reconnect },
      });
    } else {
      toast.error(t.search.searchError(), { description: errorText(e) });
    }
  };

  const submit = () => {
    const next = input.trim();
    if (!next) {
      toast.info(t.search.promptTitle());
      return;
    }
    clearSelection();
    if (next === query) {
      void search.refetch().then((r) => {
        if (r.isError && r.data) notifyError(r.error);
      });
      return;
    }
    setQuery(next);
  };

  const pickChip = (next: SearchChip) => {
    if (next === chip) return; // same-chip click ignored (vanilla pill bar behavior)
    setChip(next);
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

  const loadMore = () => {
    void search.fetchNextPage().then((r) => {
      // Keep the loaded grid: page errors surface as a toast, not a state card.
      if (r.isError) notifyError(r.error);
    });
  };

  return (
    <Stack gap="none" className="mx-auto w-full max-w-255 px-7.5 pt-6.5 pb-15">
      <Stack gap="none" className="mb-5.5">
        <Text variant="h1">{t.common.search()}</Text>
        <Text variant="body-sm" color="muted" className="mt-1.25">
          {t.search.promptSubtitle()}
        </Text>
      </Stack>

      <Box className="mb-3.5">
        <SearchBar value={input} onChange={setInput} onSubmit={submit} />
      </Box>

      <Box className="mr-auto mb-4.5 w-fit">
        <ChipGroup options={searchChipOptions()} value={chip} onChange={pickChip} />
      </Box>

      {/* min-height keeps the grid from jumping when the selection buttons appear */}
      <Stack direction="row" gap="sm" align="center" className="mb-3.5 min-h-8.5">
        <Text variant="small" color="muted" className="text-xs font-normal">
          {!searching && videos.length > 0
            ? `${videos.length} ${videos.length === 1 ? t.search.resultSingular() : t.search.resultPlural()}`
            : ''}
        </Text>
        <Box className="flex-1" />
        {chosen.length > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8.5 rounded-[9px] px-3.75 text-small"
              onClick={() => actions.customizeSelected(chosen)}
            >
              {t.common.customize()}
            </Button>
            <Button
              size="sm"
              className="h-8.5 rounded-[9px] px-3.75 text-small"
              onClick={() => actions.downloadSelected(chosen)}
            >
              {`${t.common.download()} ${chosen.length}`}
            </Button>
          </>
        )}
      </Stack>

      <MediaGrid>
        {query === '' && (
          <GridStateCard
            title={t.search.emptyTitle()}
            message={t.search.emptySubtitle()}
          />
        )}
        {query !== '' && searching && <GridStateCard loading title={`${t.search.searching()} “${query}”…`} />}
        {sessionRejected && (
          <GridStateCard
            title={t.search.sessionExpiredTitle()}
            message={`${sessionBody} ${t.search.errorDetail({ detail: errorText(search.error) })}`}
            action={
              <Button className="h-9.5 rounded-[10px] px-4.5 text-body-sm font-semibold" onClick={reconnect}>
                {t.common.reconnect()}
              </Button>
            }
          />
        )}
        {failed && !sessionRejected && (
          <GridStateCard title={t.search.searchError()} message={errorText(search.error)} />
        )}
        {query !== '' && !searching && search.isSuccess && videos.length === 0 && !search.hasNextPage && (
          <GridStateCard
            title={t.search.noResults()}
            message={t.search.noResultsFor({ query, filter: searchChipLabel(chip) })}
          />
        )}
        {query !== '' && !searching && search.isSuccess && videos.length === 0 && search.hasNextPage && (
          <GridStateCard
            title={t.search.noResultsPage()}
            message={t.search.filterHidAll()}
          />
        )}
        {!searching &&
          videos.map((v) => (
            <MediaCard
              key={v.id || v.url}
              item={v}
              selected={selected.has(v.url)}
              onToggleSelect={() => toggle(v.url)}
              onDownload={() => actions.downloadOne(v)}
              onCustomize={() => actions.customizeOne(v)}
            />
          ))}
      </MediaGrid>

      {/* "See more" stays reachable even with 0 kept items (page fully filtered client-side) */}
      {!searching && search.hasNextPage && (
        <Stack direction="row" justify="center" className="mt-4">
          <Button
            variant="outline"
            className="h-9.5 rounded-[10px] px-5.5 text-body-sm"
            disabled={search.isFetchingNextPage}
            onClick={loadMore}
          >
            {search.isFetchingNextPage && <Loader2Icon className="size-4 animate-spin" />}
            {search.isFetchingNextPage ? t.common.loadingEllipsis() : t.common.seeMore()}
          </Button>
        </Stack>
      )}
    </Stack>
  );
};
