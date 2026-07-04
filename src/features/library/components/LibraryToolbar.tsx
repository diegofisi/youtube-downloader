import { SearchIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';

interface LibraryToolbarProps {
  search: string;
  countText: string;
  onSearchChange: (value: string) => void;
  onClearAll: () => void;
}

export const LibraryToolbar = ({ search, countText, onSearchChange, onClearAll }: LibraryToolbarProps) => (
  <Stack direction="row" align="center" gap="none" className="gap-2.75" wrap>
    <Box className="relative min-w-55 flex-1">
      <SearchIcon className="absolute left-3.25 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <Input
        value={search}
        placeholder={t.library.searchPlaceholder()}
        className="h-9.5 rounded-[10px] bg-panel pl-9 text-body-sm"
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </Box>
    <Button variant="outline" className="h-9.5 rounded-[10px] px-3.5 text-small" onClick={onClearAll}>
      {t.library.clear()}
    </Button>
    <Text variant="small" color="muted" className="font-mono text-xs font-normal">
      {countText}
    </Text>
  </Stack>
);
