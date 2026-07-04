import { PlayIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Span } from '@/shared/components/ui/typography';
import type { AnalyzedVideo } from '../../models/analyzed.model';
import { fmtDuration, gradFor } from '../../helpers/format';

interface VideoThumbProps {
  video: AnalyzedVideo;
  width: number;
  height: number;
}

/** Thumbnail with gradient fallback and duration badge. */
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
      <Span className="absolute right-[5px] bottom-[5px] rounded-[5px] bg-black/80 px-[5px] py-[1.5px] font-mono text-[10.5px] font-semibold text-white">
        {fmtDuration(video.duration)}
      </Span>
    ) : null}
  </Box>
);
