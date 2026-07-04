import type { ReactNode } from 'react';
import { Card } from '@/shared/components/ui/card';
import { Box } from '@/shared/components/layout/Box';
import { Text } from '@/shared/components/ui/typography';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

export const SettingsSection = ({ title, children }: SettingsSectionProps) => (
  <Card className="rounded-[15px] px-4.25 py-1.5">
    <Box className="pt-3.5 pb-1">
      <Text variant="inline" weight="bold" className="font-display text-sm">
        {title}
      </Text>
    </Box>
    {children}
  </Card>
);
