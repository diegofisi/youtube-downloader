import { PlayIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Text } from '@/shared/components/ui/typography';
import type { AnalyzedVideo } from '../../models/analyzed.model';
import { fmtDuration, gradFor } from '../../helpers/format';

interface VideoThumbProps {
  video: AnalyzedVideo;
  width: number;
  height: number;
}

export const VideoThumb = ({ video, width, height }: VideoThumbProps) => (
  <Box
    className="relative flex-none overflow-hidden rounded-[9px]"
    style={{ width, height, background: gradFor(video.id || video.url) }}
  >
    {video.thumbnail ? (
      <img src={video.thumbnail} loading="lazy" alt="" className="h-full w-full object-cover" />
    ) : (
      <Box className="absolute inset-0 flex items-center justify-center opacity-90 text-white">
        <PlayIcon className="size-5 fill-current" />
      </Box>
    )}
    {video.duration ? (
      <Text variant="micro" className="absolute right-1.25 bottom-1.25 rounded-[5px] bg-black/80 px-1.25 py-[1.5px] font-mono font-semibold text-white">
        {fmtDuration(video.duration)}
      </Text>
    ) : null}
  </Box>
);
