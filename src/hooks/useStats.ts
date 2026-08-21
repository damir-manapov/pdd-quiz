import { useMemo } from 'react';
import { getAllQuestions } from '../data/questions';
import { type AnswerRecord, computeStats, type OverallStats } from '../data/quizLogic';

// Computes display stats on demand from the answer history owned by useQuiz.
export function useStats(history: readonly AnswerRecord[]): OverallStats {
  return useMemo(() => computeStats(history, getAllQuestions()), [history]);
}
