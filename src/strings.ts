import type { QuestionOrder } from './data/quizLogic';

// One dictionary of Russian UI strings (single language, so no i18n machinery is needed).
export const strings = {
  // App and navigation
  appTitle: 'Экзамен ПДД',
  start: 'Начать',
  restart: 'Заново',
  restartConfirmTitle: 'Начать новую сессию?',
  restartConfirmMessage: 'Текущая сессия будет завершена.',
  cancel: 'Отмена',
  confirm: 'Начать',
  next: 'Далее',
  showStats: 'Статистика',

  // Settings and order modes
  order: 'Порядок вопросов',
  category: 'Категория',
  allCategories: 'Все',
  categoryOpen: 'Скрыть',
  categoryClosed: 'Выбрать',
  orderSequential: 'По порядку',
  orderRandom: 'Случайно',
  orderWeakest: 'Слабые вопросы',
  orderStale: 'Давно не повторяли',
  orderLeastAnswered: 'Мало отвечали',
  orderHasTwoIncorrect: '2 ошибки подряд',
  orderLeastCorrectStreak: 'Меньше правильных подряд',
  sessionSize: 'Вопросов в сессии',

  // Quiz and answer feedback
  question: (index: number, total: number): string => `Вопрос ${index} из ${total}`,
  correct: 'Верно',
  incorrect: 'Неверно',
  yourAnswer: 'Ваш ответ',
  correctAnswer: 'Правильный ответ',
  sessionComplete: 'Сессия завершена',
  sessionScore: (correct: number, total: number): string =>
    `Правильных ответов: ${correct} из ${total}`,

  // Statistics
  stats: 'Статистика',
  statsOverall: 'Всего ответов',
  statsAccuracy: 'Точность',
  statsByTopic: 'По темам',
  statsRareAnswerGroups: 'Вопросы с малым числом ответов',
  statsAnswersForQuestions: (answers: number, questions: number): string =>
    `${answers} отв. — ${questions} вопр.`,
  statsRareCorrectStreakGroups: 'Короткие серии правильных ответов',
  statsCorrectForQuestions: (correct: number, questions: number): string =>
    `${correct} верн. подряд — ${questions} вопр.`,
  statsWeakest: 'Слабые вопросы',
  statsMastery: 'Освоение',
  statsQuestionsTotal: 'Всего вопросов',
  statsAttempted: 'Отвечено хотя бы раз',
  statsEverCorrect: 'Верно хотя бы раз',
  statsLastCorrect: 'Последний ответ верный',
  statsLastThreeCorrect: 'Три верных подряд',
  statsLastTwoCorrect: 'Два последних верных подряд',
  statsEverTwoIncorrect: 'Были две ошибки подряд',
  statsEverThreeIncorrect: 'Были три ошибки подряд',
  statsEmpty: 'Пока нет ответов — пройдите сессию, чтобы увидеть статистику.',

  // Backup and errors
  backup: 'Резервная копия',
  exportAnswers: 'Экспорт ответов',
  importAnswers: 'Импорт ответов',
  exportShared: 'Резервная копия готова к сохранению',
  exportUnavailable: 'Экспорт недоступен на этом устройстве',
  importDone: (count: number): string => `Импортировано ответов: ${count}`,
  errorTitle: 'Ошибка',
  backupError: 'Не удалось выполнить операцию с резервной копией',
  loading: 'Загрузка…',
} as const;

export const orderLabels: Record<QuestionOrder, string> = {
  sequential: strings.orderSequential,
  random: strings.orderRandom,
  weakest: strings.orderWeakest,
  stale: strings.orderStale,
  'least-answered': strings.orderLeastAnswered,
  'has-two-incorrect': strings.orderHasTwoIncorrect,
  'least-correct-streak': strings.orderLeastCorrectStreak,
};
