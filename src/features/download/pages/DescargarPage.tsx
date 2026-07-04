import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { H1, P } from '@/shared/components/ui/typography';
import { PageError } from '@/shared/components/ui/PageError';
import { PageLoading } from '@/shared/components/ui/PageLoading';
import { t } from '@/shared/lib/i18n';
import { AppPath } from '@/shared/routes/app-path';
import { useGetDownloadFolder } from '../api/get-download-folder/useGetDownloadFolder';
import { flattenVideos } from '../helpers/analysis';
import { useApplySettingsDefaults } from '../hooks/useApplySettingsDefaults';
import { useConsumePrefill } from '../hooks/useConsumePrefill';
import { useDescargarAnalysis } from '../hooks/useDescargarAnalysis';
import { usePreviewDerived } from '../hooks/usePreviewDerived';
import { useStartDownload } from '../hooks/useStartDownload';
import { useDownloadStore } from '../stores/useDownloadStore';
import { GlobalOptionsCard } from '../components/options/GlobalOptionsCard';
import { PlaylistGroup } from '../components/preview/PlaylistGroup';
import { PreviewToolbar } from '../components/preview/PreviewToolbar';
import { VideoCard } from '../components/preview/VideoCard';
import { SummaryCard } from '../components/summary/SummaryCard';
import { UrlInputCard } from '../components/url-input/UrlInputCard';
import { VideoOptsDialog } from '../components/video-opts/VideoOptsDialog';

// Pattern C (§4.17): one primary operation (analyze → select → enqueue) whose heavy
// logic lives in hooks; the page composes presentational blocks + the opts dialog state.
export const DescargarPage = () => {
  const navigate = useNavigate();

  const urlsText = useDownloadStore((s) => s.urlsText);
  const entries = useDownloadStore((s) => s.entries);
  const opts = useDownloadStore((s) => s.opts);
  const overrides = useDownloadStore((s) => s.overrides);
  const onlyDownloadable = useDownloadStore((s) => s.onlyDownloadable);
  const analyzeError = useDownloadStore((s) => s.analyzeError);
  const setUrlsText = useDownloadStore((s) => s.setUrlsText);
  const appendUrls = useDownloadStore((s) => s.appendUrls);
  const toggleSelected = useDownloadStore((s) => s.toggleSelected);
  const setSelected = useDownloadStore((s) => s.setSelected);
  const setOpts = useDownloadStore((s) => s.setOpts);
  const setOverride = useDownloadStore((s) => s.setOverride);
  const toggleOnlyDownloadable = useDownloadStore((s) => s.toggleOnlyDownloadable);
  const toggleCollapsed = useDownloadStore((s) => s.toggleCollapsed);

  const { analyze, isAnalyzing, progress } = useDescargarAnalysis();
  useApplySettingsDefaults();
  useConsumePrefill(analyze);
  const derived = usePreviewDerived();
  const { data: folder } = useGetDownloadFolder();
  const startDownload = useStartDownload();

  // Inter-block state: which video's options dialog is open.
  const [optsUrl, setOptsUrl] = useState<string | null>(null);
  const optsVideo = useMemo(
    () => (optsUrl ? (flattenVideos(entries).find((v) => v.url === optsUrl) ?? null) : null),
    [optsUrl, entries],
  );

  return (
    <Stack gap="lg" className="mx-auto w-full max-w-295 px-7.5 pt-6.5 pb-16">
      <Stack gap="xs">
        <H1>{t('Descargar', 'Download')}</H1>
        <P color="muted" className="text-[13.5px]">
          {t(
            'Pega enlaces de videos, playlists o canales — verás qué se va a descargar antes de empezar.',
            "Paste links to videos, playlists or channels — you'll see what will be downloaded before starting.",
          )}
        </P>
      </Stack>

      <Stack direction="row" gap="lg" align="start" wrap className="gap-5.5">
        {/* LEFT: paste card + preview */}
        <Stack gap="md" className="min-w-95 flex-1 gap-4.5">
          <UrlInputCard
            urlsText={urlsText}
            isAnalyzing={isAnalyzing}
            progress={progress}
            onUrlsTextChange={setUrlsText}
            onPickRecent={(url) => appendUrls([url])}
            onAnalyze={analyze}
            onGoYoutube={() => navigate(AppPath.YOUTUBE)}
          />

          <PreviewToolbar
            hasEntries={derived.hasEntries}
            totalCount={derived.totalCount}
            onlyDownloadable={onlyDownloadable}
            allSelected={derived.allOn}
            onToggleFilter={toggleOnlyDownloadable}
            onToggleSelectAll={() => setSelected(derived.selectableUrls, !derived.allOn)}
          />

          {isAnalyzing && (
            <PageLoading message={t('Resolviendo metadatos de los enlaces…', 'Resolving link metadata…')} />
          )}
          {!isAnalyzing && analyzeError !== null && <PageError message={`Error: ${analyzeError}`} />}
          {!isAnalyzing && analyzeError === null && !derived.hasEntries && (
            <Box className="rounded-2xl border-[1.5px] border-dashed border-border2 px-5 py-13 text-center">
              <P color="muted" className="text-sm font-semibold">
                {t('Pega enlaces para empezar', 'Paste links to get started')}
              </P>
              <P className="mt-1.25 text-[12.5px] text-faint">
                {t(
                  'Verás aquí qué se va a descargar, antes de bajar nada.',
                  "You'll see here what will be downloaded, before anything starts.",
                )}
              </P>
            </Box>
          )}
          {!isAnalyzing && analyzeError === null && derived.hasEntries && (
            <Stack gap="sm" className="gap-2.5">
              {derived.items.map((item, i) =>
                item.kind === 'video' ? (
                  <VideoCard
                    key={`${i}:${item.vm.video.url}`}
                    vm={item.vm}
                    onToggle={toggleSelected}
                    onOpenOpts={setOptsUrl}
                  />
                ) : (
                  <PlaylistGroup
                    key={`${i}:${item.playlist.id}`}
                    item={item}
                    onToggleGroup={() => setSelected(item.selectableUrls, !item.allSelected)}
                    onToggleExpanded={() => toggleCollapsed(item.playlist.id)}
                    onToggleVideo={toggleSelected}
                    onOpenOpts={setOptsUrl}
                  />
                ),
              )}
            </Stack>
          )}
        </Stack>

        {/* RIGHT: sticky options + summary */}
        <Stack gap="sm" className="sticky top-0 w-78 flex-none gap-3.5">
          <GlobalOptionsCard
            opts={opts}
            folder={folder}
            onOptsChange={setOpts}
            onOpenAjustes={() => navigate(AppPath.AJUSTES)}
          />
          <SummaryCard
            chosenCount={derived.chosenCount}
            customCount={derived.customCount}
            estMb={derived.estMb}
            opts={opts}
            onDownload={startDownload}
          />
        </Stack>
      </Stack>

      {optsVideo && (
        <VideoOptsDialog
          key={optsVideo.url}
          video={optsVideo}
          globalOpts={opts}
          initialOverride={overrides[optsVideo.url]}
          onCommit={(draft) => {
            setOverride(optsVideo.url, draft);
            setOptsUrl(null);
          }}
          onClear={() => {
            setOverride(optsVideo.url, null);
            setOptsUrl(null);
          }}
          onClose={() => setOptsUrl(null)}
        />
      )}
    </Stack>
  );
};
