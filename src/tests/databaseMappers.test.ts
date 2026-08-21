import { describe, expect, it } from 'vitest';
import { answerToRow, rowToAnswer } from '../data/databaseMappers';
import type { AnswerRecord } from '../data/quizLogic';

const record: AnswerRecord = {
  questionId: '10',
  mode: 'standard',
  optionId: '10:2',
  correct: true,
  answeredAt: '2026-01-01T00:00:00Z',
};

describe('answerToRow / rowToAnswer', () => {
  it('round-trips a record through a row', () => {
    const row = answerToRow(record);
    expect(row.correct).toBe(1);
    expect(rowToAnswer(row)).toEqual(record);
  });

  it('accepts a boolean-correct row (from an imported backup)', () => {
    expect(rowToAnswer({ ...record, correct: true })).toEqual(record);
  });

  it('rejects rows with a missing or wrong-typed field', () => {
    expect(rowToAnswer({ ...record, questionId: 5 })).toBeNull();
    expect(rowToAnswer({ ...record, mode: 'bogus' })).toBeNull();
    expect(rowToAnswer(null)).toBeNull();
    expect(rowToAnswer('nope')).toBeNull();
  });
});
