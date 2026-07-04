import type { ReactNode } from 'react';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';

interface SettingsRowProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

export const SettingsRow = ({ title, description, children }: SettingsRowProps) => (
  <Stack direction="row" gap="md" align="center" className="border-t border-border py-3.25">
    <Stack gap="xs" className="min-w-0 flex-1">
      <Text variant="body-sm">{title}</Text>
      {description !== undefined && (
        <Text variant="small" color="muted" className="text-xs font-normal">
          {description}
        </Text>
      )}
    </Stack>
    {children}
  </Stack>
);
