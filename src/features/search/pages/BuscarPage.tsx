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
import { H1, P, Small } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
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

  const submit = () => {
    const next = input.trim();
    if (!next) {
      toast.info(t('Escribe algo para buscar', 'Type something to search'));
      return;
    }
    clearSelection();
    if (next === query) {
      void search.refetch();
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
      if (r.isError)
        toast.error(t('No se pudieron cargar más', 'Could not load more'), { description: String(r.error) });
    });
  };

  return (
    <Stack gap="none" className="mx-auto w-full max-w-255 px-7.5 pt-6.5 pb-15">
      <Stack gap="none" className="mb-5.5">
        <H1>{t('Buscar', 'Search')}</H1>
        <P color="muted" className="mt-1.25 text-[13.5px]">
          {t(
            'Encuentra videos en YouTube y descárgalos sin salir de la app.',
            'Find videos on YouTube and download them without leaving the app.',
          )}
        </P>
      </Stack>

      <Box className="mb-3.5">
        <SearchBar value={input} onChange={setInput} onSubmit={submit} />
      </Box>

      <Box className="mr-auto mb-4.5 w-fit">
        <ChipGroup options={searchChipOptions()} value={chip} onChange={pickChip} />
      </Box>

      {/* min-height keeps the grid from jumping when the selection buttons appear */}
      <Stack direction="row" gap="sm" align="center" className="mb-3.5 min-h-8.5">
        <Small color="muted" className="text-xs font-normal">
          {!searching && videos.length > 0
            ? `${videos.length} ${videos.length === 1 ? t('resultado', 'result') : t('resultados', 'results')}`
            : ''}
        </Small>
        <Box className="flex-1" />
        {chosen.length > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8.5 rounded-[9px] px-3.75 text-[12.5px]"
              onClick={() => actions.customizeSelected(chosen)}
            >
              {t('Personalizar', 'Customize')}
            </Button>
            <Button
              size="sm"
              className="h-8.5 rounded-[9px] px-3.75 text-[12.5px]"
              onClick={() => actions.downloadSelected(chosen)}
            >
              {`${t('Descargar', 'Download')} ${chosen.length}`}
            </Button>
          </>
        )}
      </Stack>

      <MediaGrid>
        {query === '' && (
          <GridStateCard
            title={t('Busca algo en YouTube', 'Search for something on YouTube')}
            message={t(
              'Escribe arriba lo que quieras encontrar y descárgalo desde aquí.',
              "Type what you're looking for above and download it from here.",
            )}
          />
        )}
        {query !== '' && searching && <GridStateCard loading title={`${t('Buscando', 'Searching')} “${query}”…`} />}
        {query !== '' && !searching && search.isError && !search.data && (
          <GridStateCard title={t('No se pudo buscar', 'Search failed')} message={String(search.error)} />
        )}
        {query !== '' && !searching && search.isSuccess && videos.length === 0 && !search.hasNextPage && (
          <GridStateCard
            title={t('Sin resultados', 'No results')}
            message={t(
              `No se encontró nada para “${query}” con el filtro ${searchChipLabel(chip)}.`,
              `Nothing found for “${query}” with the ${searchChipLabel(chip)} filter.`,
            )}
          />
        )}
        {query !== '' && !searching && search.isSuccess && videos.length === 0 && search.hasNextPage && (
          <GridStateCard
            title={t('Sin resultados en esta página', 'No results on this page')}
            message={t(
              'El filtro descartó estos resultados; prueba “Ver más”.',
              'The filter dropped these results; try “Show more”.',
            )}
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
            className="h-9.5 rounded-[10px] px-5.5 text-[13px]"
            disabled={search.isFetchingNextPage}
            onClick={loadMore}
          >
            {search.isFetchingNextPage && <Loader2Icon className="size-4 animate-spin" />}
            {search.isFetchingNextPage ? t('Cargando…', 'Loading…') : t('Ver más', 'Show more')}
          </Button>
        </Stack>
      )}
    </Stack>
  );
};
