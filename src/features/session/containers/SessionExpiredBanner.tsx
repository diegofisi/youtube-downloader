import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { t } from '@/shared/lib/messages/t';
import { AppPath } from '@/shared/routes/app-path';
import { SessionStatus } from '../models/session-status.model';
import { useSessionStatus } from '../api/get-session-status/useSessionStatus';
import { openYouTubeLogin } from '../api/open-youtube-login/openYouTubeLogin';
import { SessionExpiredBannerView } from '../components/SessionExpiredBannerView';

export const SessionExpiredBanner = () => {
  const navigate = useNavigate();
  const { data: status } = useSessionStatus();
  const [dismissed, setDismissed] = useState(false);
  const [prevStatus, setPrevStatus] = useState(status);

  // Reset the dismissal when the session reconnects, so a later re-expiry shows
  // again — the "adjust state on prop change" pattern, no effect needed.
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === SessionStatus.Connected) setDismissed(false);
  }

  if (status !== SessionStatus.Expired || dismissed) return null;

  const onReconnect = () => {
    setDismissed(true);
    void navigate(AppPath.YOUTUBE);
    openYouTubeLogin().catch(() => toast.error(t.common.couldNotOpenLogin()));
  };

  return <SessionExpiredBannerView onReconnect={onReconnect} onDismiss={() => setDismissed(true)} />;
};
