import type { QuizOption, QuizQuestion } from './questions';

// Only one mode is supported today (the official ticket presented as-is), but the whole
// module is written to generalise over "any mode string" so adding a mode later (blueprint
// §4.2) touches only this union, ALL_MODES, buildSessionQuestion, and the UI label record.
export type QuizMode = 'standard';
export const ALL_MODES: QuizMode[] = ['standard'];

export type QuestionOrder = 'sequential' | 'random' | 'weakest' | 'stale' | 'least-answered';

export type SessionQuestion = {
  id: string;
  topic: string;
  text: string;
  options: QuizOption[]; // shuffled for this session; option ids travel with each option
  correctOptionId: string; // still valid after shuffling since it references an option id
  code?: string;
  explanation?: string;
  imagePath?: string;
};

export type AnswerRecord = {
  questionId: string;
  mode: QuizMode;
  optionId: string; // the option the user actually picked
  correct: boolean;
  answeredAt: string; // ISO timestamp; empty string sorts before any real timestamp
};

// Only the most recent N answers per question (per mode) count toward "weakest" ordering,
// so an old mistake on now-mastered material stops flagging a question as weak.
const RECENCY_WINDOW = 10;

// Fisher-Yates shuffle with an injected random source so shuffling is deterministically testable.
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}

// Weighted random sampling without replacement (blueprint §5): every candidate can still be
// picked (weights are clamped to >= 0), higher weights are more likely to come out first.
export function weightedSample<T>(
  candidates: readonly { item: T; weight: number }[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const pool = candidates.map((c) => ({ item: c.item, weight: Math.max(c.weight, 0) }));
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, c) => sum + c.weight, 0);
    let index = 0;
    if (total <= 0) {
      index = Math.floor(random() * pool.length);
    } else {
      let threshold = random() * total;
      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[i];
        if (candidate === undefined) continue;
        threshold -= candidate.weight;
        if (threshold <= 0) {
          index = i;
          break;
        }
      }
    }
    const chosen = pool.splice(index, 1)[0];
    if (chosen !== undefined) picked.push(chosen.item);
  }
  return picked;
}

export function isEligibleForMode(question: QuizQuestion, _mode: QuizMode): boolean {
  return (
    question.options.length >= 2 &&
    question.options.some((option) => option.id === question.correctOptionId)
  );
}

export function buildSessionQuestion(
  question: QuizQuestion,
  _mode: QuizMode,
  random: () => number = Math.random,
): SessionQuestion {
  return {
    id: question.id,
    topic: question.topic,
    text: question.text,
    options: shuffle(question.options, random),
    correctOptionId: question.correctOptionId,
    ...(question.code !== undefined ? { code: question.code } : {}),
    ...(question.explanation !== undefined ? { explanation: question.explanation } : {}),
    ...(question.imagePath !== undefined ? { imagePath: question.imagePath } : {}),
  };
}

type Weakness = { accuracy: number; lastAnsweredAt: string; total: number };

function recentForQuestion(
  history: readonly AnswerRecord[],
  questionId: string,
  mode: QuizMode,
): AnswerRecord[] {
  return history
    .filter((answer) => answer.questionId === questionId && answer.mode === mode)
    .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))
    .slice(-RECENCY_WINDOW);
}

function weaknessOf(
  history: readonly AnswerRecord[],
  questionId: string,
  mode: QuizMode,
): Weakness {
  const recent = recentForQuestion(history, questionId, mode);
  if (recent.length === 0) {
    // Never answered sorts first: accuracy -1 beats any real accuracy, '' beats any timestamp.
    return { accuracy: -1, lastAnsweredAt: '', total: 0 };
  }
  const correct = recent.filter((answer) => answer.correct).length;
  const lastAnsweredAt = recent.reduce(
    (latest, answer) => (answer.answeredAt > latest ? answer.answeredAt : latest),
    '',
  );
  return { accuracy: correct / recent.length, lastAnsweredAt, total: recent.length };
}

function compareWeakness(a: Weakness, b: Weakness): number {
  if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
  if (a.lastAnsweredAt !== b.lastAnsweredAt) return a.lastAnsweredAt < b.lastAnsweredAt ? -1 : 1;
  return a.total - b.total;
}

// stale: oldest answer first; never-answered ('' sentinel) sorts before any real timestamp.
function compareStale(a: Weakness, b: Weakness): number {
  if (a.lastAnsweredAt !== b.lastAnsweredAt) return a.lastAnsweredAt < b.lastAnsweredAt ? -1 : 1;
  return 0;
}

// least-answered: fewest attempts first; never-answered (total 0) sorts first.
function compareLeastAnswered(a: Weakness, b: Weakness): number {
  return a.total - b.total;
}

function comparatorFor(order: QuestionOrder): (a: Weakness, b: Weakness) => number {
  if (order === 'stale') return compareStale;
  if (order === 'least-answered') return compareLeastAnswered;
  return compareWeakness;
}

export function orderQuestions(
  questions: readonly QuizQuestion[],
  order: QuestionOrder,
  history: readonly AnswerRecord[],
  mode: QuizMode,
  random: () => number = Math.random,
): QuizQuestion[] {
  if (order === 'sequential') return [...questions];
  if (order === 'random') return shuffle(questions, random);
  // History-based orders: pre-shuffle so tied entries (e.g. all never-answered) come out in
  // random order. Array.sort is stable, so the shuffle survives among entries that compare equal.
  const compare = comparatorFor(order);
  return shuffle(questions, random).sort((a, b) =>
    compare(weaknessOf(history, a.id, mode), weaknessOf(history, b.id, mode)),
  );
}

export function buildSession(
  questions: readonly QuizQuestion[],
  mode: QuizMode,
  order: QuestionOrder,
  count: number,
  history: readonly AnswerRecord[],
  random: () => number = Math.random,
): SessionQuestion[] {
  const eligible = questions.filter((question) => isEligibleForMode(question, mode));
  const ordered = orderQuestions(eligible, order, history, mode, random);
  return ordered
    .slice(0, Math.max(0, count))
    .map((question) => buildSessionQuestion(question, mode, random));
}

export function isCorrect(question: SessionQuestion, optionId: string): boolean {
  return question.correctOptionId === optionId;
}

export function getProgressPercent(answered: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((answered / total) * 100);
}

export type TopicStat = { topic: string; total: number; correct: number; accuracy: number };
export type QuestionStat = { questionId: string; total: number; correct: number; accuracy: number };
export type OverallStats = {
  total: number;
  correct: number;
  accuracy: number;
  byTopic: TopicStat[];
  weakest: QuestionStat[];
  mastery: MasteryStats;
};

// Per-question progress counts (out of the whole bank), independent of raw answer totals.
export type MasteryStats = {
  totalQuestions: number; // size of the bank
  attempted: number; // answered at least once
  everCorrect: number; // answered correctly at least once
  lastCorrect: number; // most recent answer was correct
  lastThreeCorrect: number; // the three most recent answers were all correct
};

export function computeStats(
  history: readonly AnswerRecord[],
  questions: readonly QuizQuestion[],
  mode?: QuizMode,
): OverallStats {
  const filtered = mode ? history.filter((answer) => answer.mode === mode) : history;
  const topicOf = new Map(questions.map((question) => [question.id, question.topic]));

  const topicAgg = new Map<string, { total: number; correct: number }>();
  const questionAgg = new Map<string, { total: number; correct: number }>();
  for (const answer of filtered) {
    const topic = topicOf.get(answer.questionId) ?? 'Прочее';
    const topicEntry = topicAgg.get(topic) ?? { total: 0, correct: 0 };
    topicEntry.total += 1;
    if (answer.correct) topicEntry.correct += 1;
    topicAgg.set(topic, topicEntry);

    const questionEntry = questionAgg.get(answer.questionId) ?? { total: 0, correct: 0 };
    questionEntry.total += 1;
    if (answer.correct) questionEntry.correct += 1;
    questionAgg.set(answer.questionId, questionEntry);
  }

  const byTopic = [...topicAgg.entries()]
    .map(([topic, s]) => ({ topic, total: s.total, correct: s.correct, accuracy: s.correct / s.total }))
    .sort((a, b) => a.accuracy - b.accuracy);
  const weakest = [...questionAgg.entries()]
    .map(([questionId, s]) => ({
      questionId,
      total: s.total,
      correct: s.correct,
      accuracy: s.correct / s.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 20);

  const byQuestion = new Map<string, AnswerRecord[]>();
  for (const answer of filtered) {
    const list = byQuestion.get(answer.questionId) ?? [];
    list.push(answer);
    byQuestion.set(answer.questionId, list);
  }
  const mastery: MasteryStats = {
    totalQuestions: questions.length,
    attempted: byQuestion.size,
    everCorrect: 0,
    lastCorrect: 0,
    lastThreeCorrect: 0,
  };
  for (const list of byQuestion.values()) {
    const sorted = [...list].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));
    if (sorted.some((answer) => answer.correct)) mastery.everCorrect += 1;
    if (sorted[sorted.length - 1]?.correct) mastery.lastCorrect += 1;
    const lastThree = sorted.slice(-3);
    if (lastThree.length === 3 && lastThree.every((answer) => answer.correct)) {
      mastery.lastThreeCorrect += 1;
    }
  }

  const total = filtered.length;
  const correct = filtered.filter((answer) => answer.correct).length;
  return { total, correct, accuracy: total > 0 ? correct / total : 0, byTopic, weakest, mastery };
}
