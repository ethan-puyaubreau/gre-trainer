import { DAY } from '../mastery/model';
import { href } from '../router';
import { useProgress } from '../store/progress';

const MIN_ANSWERS = 50;
const EVERY_DAYS = 14;

/** Progress lives in this browser only: nudge toward a backup once there is something worth losing. */
export function ExportReminder() {
  const answers = useProgress((s) => s.history.length);
  const lastExportAt = useProgress((s) => s.settings.lastExportAt);
  if (answers < MIN_ANSWERS || (lastExportAt !== undefined && Date.now() - lastExportAt < EVERY_DAYS * DAY)) return null;
  return (
    <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', padding: '10px 16px 0', boxSizing: 'border-box' }}>
      <p className="muted small" style={{ margin: 0 }}>
        Your {answers} answers are saved in this browser only. <a href={href('settings')}>Export a backup</a> in Settings.
      </p>
    </div>
  );
}
