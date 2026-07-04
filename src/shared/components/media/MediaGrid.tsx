import type { ReactNode } from 'react';
import { Box } from '@/shared/components/layout/Box';

interface MediaGridProps {
  children: ReactNode;
}

export const MediaGrid = ({ children }: MediaGridProps) => (
  <Box className="grid grid-cols-[repeat(auto-fill,minmax(216px,1fr))] gap-3.25">{children}</Box>
);
