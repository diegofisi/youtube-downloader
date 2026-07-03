import { ConstructionIcon } from 'lucide-react';
import { Stack } from '@/shared/components/layout/Stack';
import { H1, P } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';

interface PlaceholderPageProps {
  es: string;
  en: string;
}

/** Temporary page while the section migrates from the vanilla app. */
export const PlaceholderPage = ({ es, en }: PlaceholderPageProps) => (
  <Stack gap="lg" className="mx-auto w-full max-w-[1180px] px-8 py-7">
    <H1>{t(es, en)}</H1>
    <Stack gap="sm" align="center" justify="center" className="py-16">
      <ConstructionIcon className="size-6 text-faint" />
      <P color="muted">
        {t('Esta sección aún vive en la app vanilla. Migración en curso.', 'This section still lives in the vanilla app. Migration in progress.')}
      </P>
    </Stack>
  </Stack>
);
