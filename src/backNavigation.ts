import type { QuizStatus } from './hooks/useQuiz';

export function shouldHandleBack(status: QuizStatus): boolean {
  return status === 'active';
}
