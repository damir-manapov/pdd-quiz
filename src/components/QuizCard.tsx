import { Image, Text, TouchableOpacity, View } from 'react-native';
import { imageAssets } from '../data/generated/imageAssets';
import type { SessionQuestion } from '../data/quizLogic';
import { strings } from '../strings';
import { styles } from '../styles';

export type QuizCardProps = {
  question: SessionQuestion;
  selectedOptionId: string | null;
  onSelect: (optionId: string) => void;
};

export function QuizCard({ question, selectedOptionId, onSelect }: QuizCardProps) {
  const answered = selectedOptionId !== null;
  const wasCorrect = selectedOptionId === question.correctOptionId;
  const imageSource = question.imagePath ? imageAssets[question.imagePath] : undefined;
  const selectedOption = question.options.find((option) => option.id === selectedOptionId);
  const correctOption = question.options.find((option) => option.id === question.correctOptionId);

  return (
    <View style={styles.card}>
      {imageSource !== undefined ? <Image source={imageSource} style={styles.image} /> : null}
      <Text style={styles.questionText}>{question.text}</Text>

      {question.options.map((option) => {
        const isAnswer = option.id === question.correctOptionId;
        const isSelected = option.id === selectedOptionId;
        const highlight =
          answered && isAnswer
            ? styles.optionCorrect
            : answered && isSelected
              ? styles.optionIncorrect
              : null;
        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.option, highlight]}
            disabled={answered}
            onPress={() => onSelect(option.id)}
          >
            <Text style={styles.optionText}>{option.text}</Text>
          </TouchableOpacity>
        );
      })}

      {answered ? (
        <View
          style={[
            styles.feedbackPanel,
            wasCorrect ? styles.feedbackPanelCorrect : styles.feedbackPanelIncorrect,
          ]}
        >
          <Text
            style={[
              styles.feedback,
              wasCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect,
            ]}
          >
            {wasCorrect ? strings.correct : strings.incorrect}
          </Text>
          <Text style={styles.feedbackLabel}>{strings.yourAnswer}</Text>
          <Text style={styles.feedbackAnswer}>{selectedOption?.text}</Text>
          {!wasCorrect ? (
            <View style={styles.correctAnswerBlock}>
              <Text style={styles.feedbackLabel}>{strings.correctAnswer}</Text>
              <Text style={styles.feedbackAnswer}>{correctOption?.text}</Text>
            </View>
          ) : null}
          {question.explanation !== undefined ? (
            <View style={styles.explanationBox}>
              <Text style={styles.explanationText}>{question.explanation}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.muted}>
        {strings.category}: {question.topic}
      </Text>
    </View>
  );
}
