import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { exportAnswers, importAnswers } from '../data/backup';
import { logError } from '../logger';
import { strings } from '../strings';

export type UseBackup = {
  busy: boolean;
  exportNow: () => void;
  importNow: () => void;
};

// Wraps backup export/import with busy-state + Alert feedback. Cancellation stays silent
// (no error alert); only genuine failures alert (blueprint §6.3).
export function useBackup(onImported: () => void): UseBackup {
  const [busy, setBusy] = useState<boolean>(false);

  const exportNow = useCallback(() => {
    setBusy(true);
    exportAnswers()
      .then((result) => {
        Alert.alert(
          strings.backup,
          result === 'shared' ? strings.exportShared : strings.exportUnavailable,
        );
      })
      .catch((error) => {
        logError('useBackup.export', error);
        Alert.alert(strings.errorTitle, strings.backupError);
      })
      .finally(() => setBusy(false));
  }, []);

  const importNow = useCallback(() => {
    setBusy(true);
    importAnswers()
      .then((result) => {
        if (result.status === 'imported') {
          onImported();
          Alert.alert(strings.backup, strings.importDone(result.count));
        }
      })
      .catch((error) => {
        logError('useBackup.import', error);
        Alert.alert(strings.errorTitle, strings.backupError);
      })
      .finally(() => setBusy(false));
  }, [onImported]);

  return { busy, exportNow, importNow };
}
