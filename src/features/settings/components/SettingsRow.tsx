import type { ReactNode } from 'react';
import { Stack } from '@/shared/components/layout/Stack';
import { Small } from '@/shared/components/ui/typography';

interface SettingsRowProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/** One setting row: label + optional description on the left, control on the right. */
export const SettingsRow = ({ title, description, children }: SettingsRowProps) => (
  <Stack direction="row" gap="md" align="center" className="border-t border-border py-3.25">
    <Stack gap="xs" className="min-w-0 flex-1">
      <Small className="text-[13.5px]">{title}</Small>
      {description !== undefined && (
        <Small color="muted" className="text-xs font-normal">
          {description}
        </Small>
      )}
    </Stack>
    {children}
  </Stack>
);
