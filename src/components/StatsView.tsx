import { Text, View } from 'react-native';
import type { OverallStats } from '../data/quizLogic';
import { strings } from '../strings';
import { styles } from '../styles';

export type StatsViewProps = {
  stats: OverallStats;
};

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function StatsView({ stats }: StatsViewProps) {
  const mastery = stats.mastery;
  const outOf = mastery.totalQuestions;

  return (
    <View>
      <Text style={styles.subheader}>{strings.statsMastery}</Text>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>{strings.statsQuestionsTotal}</Text>
        <Text style={styles.statValue}>{outOf}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>{strings.statsAttempted}</Text>
        <Text style={styles.statValue}>
          {mastery.attempted} / {outOf}
        </Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>{strings.statsEverCorrect}</Text>
        <Text style={styles.statValue}>
          {mastery.everCorrect} / {outOf}
        </Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>{strings.statsLastCorrect}</Text>
        <Text style={styles.statValue}>
          {mastery.lastCorrect} / {outOf}
        </Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>{strings.statsLastThreeCorrect}</Text>
        <Text style={styles.statValue}>
          {mastery.lastThreeCorrect} / {outOf}
        </Text>
      </View>

      {stats.total === 0 ? (
        <Text style={styles.muted}>{strings.statsEmpty}</Text>
      ) : (
        <>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{strings.statsOverall}</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>{strings.statsAccuracy}</Text>
            <Text style={styles.statValue}>{percent(stats.accuracy)}</Text>
          </View>

          <Text style={styles.subheader}>{strings.statsByTopic}</Text>
          {stats.byTopic.map((topic) => (
            <View key={topic.topic} style={styles.statRow}>
              <Text style={styles.statLabel}>{topic.topic}</Text>
              <Text style={styles.statValue}>
                {percent(topic.accuracy)} ({topic.correct}/{topic.total})
              </Text>
            </View>
          ))}

          <Text style={styles.subheader}>{strings.statsRareAnswerGroups}</Text>
          {stats.rareAnswerGroups.map((group) => (
            <View key={group.answerCount} style={styles.statRow}>
              <Text style={styles.statLabel}>
                {strings.statsAnswersForQuestions(group.answerCount, group.questionCount)}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
