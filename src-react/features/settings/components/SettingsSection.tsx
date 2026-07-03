import type { ReactNode } from 'react';
import { Card } from '@/shared/components/ui/card';
import { Box } from '@/shared/components/layout/Box';
import { Span } from '@/shared/components/ui/typography';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

/** Settings card: bold header + stacked rows (ports the vanilla panel look). */
export const SettingsSection = ({ title, children }: SettingsSectionProps) => (
  <Card className="rounded-[15px] px-[17px] py-1.5">
    <Box className="pt-3.5 pb-1">
      <Span weight="bold" className="font-display text-sm">
        {title}
      </Span>
    </Box>
    {children}
  </Card>
);
