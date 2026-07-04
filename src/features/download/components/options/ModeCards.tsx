import { FilmIcon, MusicIcon, VideoIcon, type LucideIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';
import { cn } from '@/shared/lib/utils';
import type { DownloadOpts } from '../../models/download-opts.model';

interface ModeCardsProps {
  mode: DownloadOpts['mode'];
  onChange: (mode: DownloadOpts['mode']) => void;
}

interface ModeDef {
  id: DownloadOpts['mode'];
  title: string;
  sub: string;
  Icon: LucideIcon;
  iconClass: string;
}

const modeDefs = (): ModeDef[] => [
  {
    id: 'av',
    title: t.common.videoAndAudio(),
    sub: t.download.videoAudioHint(),
    Icon: FilmIcon,
    iconClass: 'bg-info/15 text-info',
  },
  {
    id: 'video',
    title: t.download.videoOnly(),
    sub: t.download.videoOnlyHint(),
    Icon: VideoIcon,
    iconClass: 'bg-primary-soft text-primary',
  },
  {
    id: 'audio',
    title: t.common.audioOnly(),
    sub: t.download.audioOnlyHint(),
    Icon: MusicIcon,
    iconClass: 'bg-success/15 text-success',
  },
];

export const ModeCards = ({ mode, onChange }: ModeCardsProps) => (
  <Stack gap="sm">
    {modeDefs().map((m) => {
      const on = mode === m.id;
      return (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={cn(
            'flex w-full items-center gap-2.75 rounded-xl border-[1.5px] p-2.5 text-left transition-colors',
            on ? 'border-primary bg-primary-soft' : 'border-border bg-transparent hover:bg-accent',
          )}
        >
          <Text variant="inline" className={cn('flex size-8.5 flex-none items-center justify-center rounded-[9px]', m.iconClass)}>
            <m.Icon className="size-4" />
          </Text>
          <Stack gap="none" className="flex-1">
            <Text variant="body-sm" className="block font-semibold text-foreground">{m.title}</Text>
            <Text variant="caption" className="mt-px block text-muted-foreground">{m.sub}</Text>
          </Stack>
          <Text variant="inline"
            className={cn(
              'flex size-4.5 flex-none items-center justify-center rounded-full border-2',
              on ? 'border-primary' : 'border-border2',
            )}
          >
            {on && <Box className="size-2.25 rounded-full bg-primary" />}
          </Text>
        </button>
      );
    })}
  </Stack>
);
