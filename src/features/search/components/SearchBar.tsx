import { SearchIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Button } from '@/shared/components/ui/button';
import { t } from '@/shared/lib/i18n';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

/** Search input + button row (Enter submits). */
export const SearchBar = ({ value, onChange, onSubmit }: SearchBarProps) => (
  <Box
    as="form"
    className="flex gap-2.5"
    onSubmit={(e: React.FormEvent) => {
      e.preventDefault();
      onSubmit();
    }}
  >
    <Stack
      direction="row"
      gap="sm"
      align="center"
      className="h-11.5 min-w-0 flex-1 rounded-xl border border-border bg-panel px-3.75 text-faint"
    >
      <SearchIcon className="size-4.5" />
      {/* Raw input: the shared Input carries its own height/border chrome. */}
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('Buscar en YouTube…', 'Search YouTube…')}
        className="min-w-0 flex-1 border-none bg-transparent text-sm text-foreground outline-none placeholder:text-faint"
      />
    </Stack>
    <Button
      type="submit"
      className="h-11.5 rounded-xl px-6 text-sm font-bold shadow-[0_6px_18px_rgba(124,107,240,.3)]"
    >
      {t('Buscar', 'Search')}
    </Button>
  </Box>
);
