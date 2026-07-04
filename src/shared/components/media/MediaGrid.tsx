import type { ReactNode } from 'react';
import { Box } from '@/shared/components/layout/Box';

interface MediaGridProps {
  children: ReactNode;
}

/** Responsive card grid shared by the media views (216px min column, 13px gap). */
export const MediaGrid = ({ children }: MediaGridProps) => (
  <Box className="grid grid-cols-[repeat(auto-fill,minmax(216px,1fr))] gap-[13px]">{children}</Box>
);
