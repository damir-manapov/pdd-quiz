import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getAllQuestions } from '../data/questions';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const questions = getAllQuestions();

describe('question bank invariants', () => {
  it('is non-empty', () => {
    expect(questions.length).toBeGreaterThan(0);
  });

  it('has unique question ids', () => {
    const ids = new Set(questions.map((q) => q.id));
    expect(ids.size).toBe(questions.length);
  });

  it('every question has text, >=2 options with unique ids, and a valid correctOptionId', () => {
    for (const q of questions) {
      expect(q.text.trim().length, `question ${q.id} text`).toBeGreaterThan(0);
      expect(q.options.length, `question ${q.id} options`).toBeGreaterThanOrEqual(2);
      const optionIds = new Set(q.options.map((o) => o.id));
      expect(optionIds.size, `question ${q.id} duplicate option id`).toBe(q.options.length);
      expect(optionIds.has(q.correctOptionId), `question ${q.id} correctOptionId`).toBe(true);
      for (const o of q.options) {
        expect(o.text.trim().length, `question ${q.id} option ${o.id} text`).toBeGreaterThan(0);
      }
    }
  });

  it('every referenced imagePath exists as a bundled asset', () => {
    for (const q of questions) {
      if (q.imagePath) {
        expect(existsSync(join(root, 'assets', q.imagePath)), `${q.id} -> ${q.imagePath}`).toBe(
          true,
        );
      }
    }
  });
});
