import { useCallback, useEffect, useState } from 'react';
import { getAnswerHistory, recordAnswer } from '../data/database';
import { getAllQuestions } from '../data/questions';
import {
  type AnswerRecord,
  buildSession,
  isCorrect,
  type QuestionOrder,
  type QuizMode,
  type SessionQuestion,
} from '../data/quizLogic';
import { logError } from '../logger';

export type QuizStatus = 'loading' | 'ready' | 'active' | 'finished';

const MODE: QuizMode = 'standard';
const DEFAULT_SESSION_SIZE = 20;

export type UseQuiz = {
  status: QuizStatus;
  order: QuestionOrder;
  sessionSize: number;
  session: SessionQuestion[];
  currentIndex: number;
  current: SessionQuestion | undefined;
  selectedOptionId: string | null;
  correctCount: number;
  history: AnswerRecord[];
  setOrder: (order: QuestionOrder) => void;
  setSessionSize: (size: number) => void;
  start: () => void;
  answer: (optionId: string) => void;
  next: () => void;
  restart: () => void;
  reload: () => void;
};

export function useQuiz(): UseQuiz {
  const [history, setHistory] = useState<AnswerRecord[]>([]);
  const [status, setStatus] = useState<QuizStatus>('loading');
  const [order, setOrder] = useState<QuestionOrder>('sequential');
  const [sessionSize, setSessionSize] = useState<number>(DEFAULT_SESSION_SIZE);
  const [session, setSession] = useState<SessionQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState<number>(0);

  useEffect(() => {
    getAnswerHistory()
      .then((loaded) => {
        setHistory(loaded);
        setStatus('ready');
      })
      .catch((error) => {
        logError('useQuiz.load', error);
        setStatus('ready');
      });
  }, []);

  const start = useCallback(() => {
    const built = buildSession(getAllQuestions(), MODE, order, sessionSize, history);
    setSession(built);
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setCorrectCount(0);
    setStatus(built.length > 0 ? 'active' : 'ready');
  }, [order, sessionSize, history]);

  const answer = useCallback(
    (optionId: string) => {
      const question = session[currentIndex];
      if (question === undefined || selectedOptionId !== null) return;
      const correct = isCorrect(question, optionId);
      setSelectedOptionId(optionId);
      if (correct) setCorrectCount((count) => count + 1);

      const record: AnswerRecord = {
        questionId: question.id,
        mode: MODE,
        optionId,
        correct,
        answeredAt: new Date().toISOString(),
      };
      setHistory((previous) => [...previous, record]);
      recordAnswer(record).catch((error) => logError('useQuiz.recordAnswer', error));
    },
    [session, currentIndex, selectedOptionId],
  );

  const next = useCallback(() => {
    setSelectedOptionId(null);
    setCurrentIndex((index) => {
      const nextIndex = index + 1;
      if (nextIndex >= session.length) {
        setStatus('finished');
        return index;
      }
      return nextIndex;
    });
  }, [session.length]);

  const restart = useCallback(() => {
    setStatus('ready');
    setSession([]);
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setCorrectCount(0);
  }, []);

  const reload = useCallback(() => {
    getAnswerHistory()
      .then(setHistory)
      .catch((error) => logError('useQuiz.reload', error));
  }, []);

  return {
    status,
    order,
    sessionSize,
    session,
    currentIndex,
    current: session[currentIndex],
    selectedOptionId,
    correctCount,
    history,
    setOrder,
    setSessionSize,
    start,
    answer,
    next,
    restart,
    reload,
  };
}
