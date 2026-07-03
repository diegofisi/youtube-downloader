import { useEffect, useRef } from 'react';
import { onEvent } from '@/shared/lib/tauri';

// Subscribes to a backend event for the component's lifetime.
// handler goes through a ref so re-renders never resubscribe.
export function useTauriEvent<T>(name: string, handler: (payload: T) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void onEvent<T>(name, (payload) => handlerRef.current(payload)).then((fn) => {
      // listen() resolves async: if we unmounted meanwhile, release immediately
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [name]);
}
