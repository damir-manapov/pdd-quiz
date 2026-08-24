import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { deserializeBackup, serializeBackup } from './backupFormat';
import { getAnswerHistory, replaceAnswerHistory } from './database';

export type ExportResult = 'shared' | 'unavailable';
export type ImportResult = { status: 'imported'; count: number } | { status: 'canceled' };

// iOS/web have no dialog-free way to write to a user-visible location: write to the app's
// private cache dir, then hand off via the share sheet.
export async function exportAnswers(): Promise<ExportResult> {
  const history = await getAnswerHistory();
  const content = serializeBackup(history, new Date().toISOString());
  const file = new File(Paths.cache, `pdd-quiz-backup-${Date.now()}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Сохранить резервную копию',
    UTI: 'public.json',
  });
  return 'shared';
}

// Use expo-file-system's own picker (not expo-document-picker): files it returns come with
// read permission already granted. Cancellation is a value, never an error.
export async function importAnswers(): Promise<ImportResult> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json'] });
  if (picked.canceled) return { status: 'canceled' };
  const text = await picked.result.text();
  const backup = deserializeBackup(text);
  await replaceAnswerHistory(backup.answers);
  return { status: 'imported', count: backup.answers.length };
}
