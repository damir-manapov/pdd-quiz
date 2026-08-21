import type { AnswerRecord } from './quizLogic';

// Deliberately dependency-free from the rest of data/ (blueprint §6.2): the backup file's
// shape is self-contained and validated inline, so it can be reasoned about in isolation and
// old exports keep validating as new optional fields are added.
export type AnswersBackup = {
  version: 1;
  exportedAt: string;
  answers: AnswerRecord[];
};

const KNOWN_MODES = ['standard'];

function isAnswerRecord(value: unknown): value is AnswerRecord {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.questionId === 'string' &&
    typeof v.optionId === 'string' &&
    typeof v.answeredAt === 'string' &&
    typeof v.correct === 'boolean' &&
    typeof v.mode === 'string' &&
    KNOWN_MODES.includes(v.mode)
  );
}

export function isAnswersBackup(value: unknown): value is AnswersBackup {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 1) return false;
  if (typeof v.exportedAt !== 'string') return false;
  if (!Array.isArray(v.answers)) return false;
  return v.answers.every(isAnswerRecord);
}

export function serializeBackup(answers: readonly AnswerRecord[], exportedAt: string): string {
  const backup: AnswersBackup = { version: 1, exportedAt, answers: [...answers] };
  return `${JSON.stringify(backup, null, 2)}\n`;
}

// Runtime-validate JSON.parse output before trusting it: the file came from outside the app.
export function deserializeBackup(text: string): AnswersBackup {
  const parsed: unknown = JSON.parse(text);
  if (!isAnswersBackup(parsed)) {
    throw new Error('Файл резервной копии повреждён или имеет неверный формат');
  }
  return parsed;
}
