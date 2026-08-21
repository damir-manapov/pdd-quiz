import { describe, expect, it } from 'vitest';
import { deserializeBackup, isAnswersBackup, serializeBackup } from '../data/backupFormat';
import type { AnswerRecord } from '../data/quizLogic';

const answers: AnswerRecord[] = [
  {
    questionId: '10',
    mode: 'standard',
    optionId: '10:2',
    correct: true,
    answeredAt: '2026-01-01T00:00:00Z',
  },
];

describe('backup format', () => {
  it('serializes then deserializes back to the same answers', () => {
    const text = serializeBackup(answers, '2026-02-01T00:00:00Z');
    const restored = deserializeBackup(text);
    expect(restored.version).toBe(1);
    expect(restored.exportedAt).toBe('2026-02-01T00:00:00Z');
    expect(restored.answers).toEqual(answers);
  });

  it('validates shape with isAnswersBackup', () => {
    expect(isAnswersBackup({ version: 1, exportedAt: 'x', answers: [] })).toBe(true);
    expect(isAnswersBackup({ version: 2, exportedAt: 'x', answers: [] })).toBe(false);
    expect(isAnswersBackup({ version: 1, answers: [] })).toBe(false);
    expect(isAnswersBackup(null)).toBe(false);
  });

  it('throws on malformed JSON content', () => {
    expect(() => deserializeBackup('{"version":1}')).toThrow();
    expect(() => deserializeBackup('not json')).toThrow();
  });
});
