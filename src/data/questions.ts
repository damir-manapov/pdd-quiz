import rawQuestions from '../../assets/questions.json';

export type QuizOption = {
  id: string;
  text: string;
};

export type QuizQuestion = {
  id: string;
  topic: string;
  text: string;
  options: QuizOption[];
  correctOptionId: string;
  code?: string;
  explanation?: string;
  imagePath?: string;
};

// The bank is produced by scripts/generate-questions.ts and bundled as a JSON asset; the
// codegen already enforces the invariants asserted by src/tests/questions.test.ts.
const allQuestions = rawQuestions as unknown as QuizQuestion[];

export function getAllQuestions(): QuizQuestion[] {
  return allQuestions;
}

export function getTopics(): string[] {
  return [...new Set(allQuestions.map((q) => q.topic))].sort((a, b) => a.localeCompare(b, 'ru'));
}
