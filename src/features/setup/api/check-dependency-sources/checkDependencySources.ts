import { toast } from 'sonner';
import { invoke } from '@/shared/lib/tauri';
import { t } from '@/shared/lib/messages/t';

/** Mirror of Rust `SourceStatus` (camelCase serde); setup only needs the failure fields. */
interface SourceStatusDTOResponse {
  name: string;
  ok: boolean;
  detail: string;
}

let checked = false;

/** Once per app run, after the gate resolves: warn when a pinned download source is gone,
 * so the maintainer hears about a dead URL before a fresh install does. Never blocks. */
export function warnIfDependencySourcesDown(): void {
  if (checked) return;
  checked = true;
  invoke<SourceStatusDTOResponse[]>('check_dependency_sources')
    .then((sources) => {
      const down = sources.find((s) => !s.ok);
      if (!down) return;
      toast.warning(t.setup.sourcesWarningTitle(), {
        description: t.setup.sourcesWarningBody({ name: down.name, detail: down.detail }),
        duration: 12000,
      });
    })
    .catch(() => {
      /* offline or command missing: the setup itself will report when it matters */
    });
}
