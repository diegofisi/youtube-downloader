import { Toaster as Sonner } from 'sonner';
import { useUiStore } from '@/shared/stores/useUiStore';

export const Toaster = () => {
  const theme = useUiStore((s) => s.theme);
  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--panel)',
          border: '1px solid var(--border2)',
          color: 'var(--text)',
        },
      }}
    />
  );
};
