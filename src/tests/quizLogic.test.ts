import { describe, expect, it } from 'vitest';
import type { QuizQuestion } from '../data/questions';
import type { AnswerRecord } from '../data/quizLogic';
import {
  buildSession,
  buildSessionQuestion,
  computeStats,
  getProgressPercent,
  isCorrect,
  isEligibleForMode,
  orderQuestions,
  shuffle,
  weightedSample,
} from '../data/quizLogic';

// A deterministic "random" source: cycles through the given values.
function seededRandom(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length] ?? 0;
    i += 1;
    return v;
  };
}

const question = (id: string, topic = 'T'): QuizQuestion => ({
  id,
  topic,
  text: `Question ${id}`,
  options: [
    { id: `${id}:0`, text: 'a' },
    { id: `${id}:1`, text: 'b' },
    { id: `${id}:2`, text: 'c' },
  ],
  correctOptionId: `${id}:1`,
});

const answer = (
  questionId: string,
  correct: boolean,
  answeredAt: string,
  optionId = `${questionId}:1`,
): AnswerRecord => ({ questionId, mode: 'standard', optionId, correct, answeredAt });

describe('shuffle', () => {
  it('keeps every element (permutation)', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seededRandom([0.1, 0.5, 0.9, 0.3]));
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('does not mutate the input', () => {
    const input = [1, 2, 3];
    shuffle(input, seededRandom([0.5]));
    expect(input).toEqual([1, 2, 3]);
  });

  it('is deterministic for a fixed random source', () => {
    const a = shuffle([1, 2, 3, 4], seededRandom([0.2, 0.8, 0.4]));
    const b = shuffle([1, 2, 3, 4], seededRandom([0.2, 0.8, 0.4]));
    expect(a).toEqual(b);
  });
});

describe('weightedSample', () => {
  it('never returns more than count or more than the pool', () => {
    const out = weightedSample(
      [
        { item: 'a', weight: 1 },
        { item: 'b', weight: 1 },
      ],
      5,
      seededRandom([0.1, 0.9]),
    );
    expect(out).toHaveLength(2);
  });

  it('samples without replacement', () => {
    const out = weightedSample(
      [
        { item: 'a', weight: 1 },
        { item: 'b', weight: 1 },
        { item: 'c', weight: 1 },
      ],
      3,
      seededRandom([0.1, 0.5, 0.9]),
    );
    expect(new Set(out).size).toBe(3);
  });

  it('prefers heavier weights first', () => {
    const out = weightedSample(
      [
        { item: 'light', weight: 1 },
        { item: 'heavy', weight: 1000 },
      ],
      1,
      seededRandom([0.5]),
    );
    expect(out).toEqual(['heavy']);
  });
});

describe('isEligibleForMode', () => {
  it('accepts a well-formed question', () => {
    expect(isEligibleForMode(question('1'), 'standard')).toBe(true);
  });

  it('rejects a question whose correctOptionId matches no option', () => {
    expect(isEligibleForMode({ ...question('1'), correctOptionId: 'nope' }, 'standard')).toBe(
      false,
    );
  });
});

describe('buildSessionQuestion', () => {
  it('shuffles options but keeps correctOptionId valid', () => {
    const session = buildSessionQuestion(question('1'), 'standard', seededRandom([0.9, 0.1, 0.5]));
    expect(session.options.map((o) => o.id).sort()).toEqual(['1:0', '1:1', '1:2']);
    expect(session.options.some((o) => o.id === session.correctOptionId)).toBe(true);
  });

  it('omits optional fields that are absent', () => {
    const session = buildSessionQuestion(question('1'), 'standard', seededRandom([0.5]));
    expect('imagePath' in session).toBe(false);
    expect('code' in session).toBe(false);
  });
});

describe('orderQuestions weakest', () => {
  it('puts never-answered questions before answered ones', () => {
    const questions = [question('1'), question('2')];
    const history = [answer('1', true, '2026-01-01T00:00:00Z')];
    const ordered = orderQuestions(questions, 'weakest', history, 'standard');
    expect(ordered[0]?.id).toBe('2');
  });

  it('puts the least accurate answered question first', () => {
    const questions = [question('1'), question('2')];
    const history = [
      answer('1', true, '2026-01-01T00:00:00Z'),
      answer('2', false, '2026-01-02T00:00:00Z'),
    ];
    const ordered = orderQuestions(questions, 'weakest', history, 'standard');
    expect(ordered[0]?.id).toBe('2');
  });

  it('ignores answers from a different mode', () => {
    const questions = [question('1')];
    const history: AnswerRecord[] = [
      {
        questionId: '1',
        mode: 'standard',
        optionId: '1:1',
        correct: true,
        answeredAt: '2026-01-01T00:00:00Z',
      },
    ];
    const ordered = orderQuestions(questions, 'weakest', history, 'standard');
    expect(ordered).toHaveLength(1);
  });

  it('randomises ties via a pre-shuffle (stable sort preserves it)', () => {
    const questions = [question('1'), question('2'), question('3'), question('4')];
    const seed = [0.99, 0.6, 0.2];
    // All never-answered => all tie => output equals the pre-shuffle order.
    const ordered = orderQuestions(questions, 'weakest', [], 'standard', seededRandom(seed));
    const expected = shuffle(questions, seededRandom(seed));
    expect(ordered.map((q) => q.id)).toEqual(expected.map((q) => q.id));
  });
});

describe('orderQuestions stale', () => {
  it('orders by oldest answer first, never-answered before all', () => {
    const questions = [question('1'), question('2'), question('3')];
    const history = [
      answer('1', true, '2026-01-03T00:00:00Z'),
      answer('2', true, '2026-01-01T00:00:00Z'),
    ];
    const ordered = orderQuestions(questions, 'stale', history, 'standard', seededRandom([0.5]));
    expect(ordered.map((q) => q.id)).toEqual(['3', '2', '1']);
  });
});

describe('orderQuestions least-answered', () => {
  it('orders by fewest attempts first, regardless of correctness', () => {
    const questions = [question('1'), question('2'), question('3')];
    const history = [
      answer('1', true, '2026-01-01T00:00:00Z'),
      answer('1', false, '2026-01-02T00:00:00Z'),
      answer('2', true, '2026-01-01T00:00:00Z'),
    ];
    const ordered = orderQuestions(
      questions,
      'least-answered',
      history,
      'standard',
      seededRandom([0.5]),
    );
    expect(ordered.map((q) => q.id)).toEqual(['3', '2', '1']);
  });
});

describe('buildSession', () => {
  it('respects the requested count and only eligible questions', () => {
    const questions = [question('1'), question('2'), { ...question('3'), correctOptionId: 'bad' }];
    const session = buildSession(questions, 'standard', 'sequential', 2, [], seededRandom([0.5]));
    expect(session).toHaveLength(2);
    expect(session.map((q) => q.id)).toEqual(['1', '2']);
  });
});

describe('isCorrect', () => {
  it('matches by option id, not position', () => {
    const session = buildSessionQuestion(question('1'), 'standard', seededRandom([0.9, 0.1]));
    expect(isCorrect(session, '1:1')).toBe(true);
    expect(isCorrect(session, '1:0')).toBe(false);
  });
});

describe('getProgressPercent', () => {
  it('handles zero total', () => {
    expect(getProgressPercent(0, 0)).toBe(0);
  });

  it('rounds to a whole percent', () => {
    expect(getProgressPercent(1, 3)).toBe(33);
  });
});

describe('computeStats', () => {
  it('aggregates overall, per-topic and weakest correctly', () => {
    const questions = [question('1', 'A'), question('2', 'B')];
    const history = [
      answer('1', true, '2026-01-01T00:00:00Z'),
      answer('1', false, '2026-01-02T00:00:00Z'),
      answer('2', true, '2026-01-03T00:00:00Z'),
    ];
    const stats = computeStats(history, questions);
    expect(stats.total).toBe(3);
    expect(stats.correct).toBe(2);
    expect(stats.weakest[0]?.questionId).toBe('1');
    expect(stats.byTopic.find((t) => t.topic === 'A')?.accuracy).toBeCloseTo(0.5);
    expect(stats.byTopic.find((t) => t.topic === 'B')?.accuracy).toBe(1);
  });
});
