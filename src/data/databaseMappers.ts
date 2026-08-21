import { ALL_MODES, type AnswerRecord, type QuizMode } from './quizLogic';

// Kept as pure row <-> domain mapping (separate from database.ts, which touches a native
// module) specifically so this conversion is unit-testable.
export type AnswerRow = {
  questionId: string;
  mode: string;
  optionId: string;
  correct: number;
  answeredAt: string;
};

function isMode(value: unknown): value is QuizMode {
  return typeof value === 'string' && (ALL_MODES as string[]).includes(value);
}

export function answerToRow(answer: AnswerRecord): AnswerRow {
  return {
    questionId: answer.questionId,
    mode: answer.mode,
    optionId: answer.optionId,
    correct: answer.correct ? 1 : 0,
    answeredAt: answer.answeredAt,
  };
}

export function rowToAnswer(row: unknown): AnswerRecord | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.questionId !== 'string') return null;
  if (!isMode(r.mode)) return null;
  if (typeof r.optionId !== 'string') return null;
  if (typeof r.answeredAt !== 'string') return null;
  return {
    questionId: r.questionId,
    mode: r.mode,
    optionId: r.optionId,
    correct: r.correct === 1 || r.correct === true,
    answeredAt: r.answeredAt,
  };
}
