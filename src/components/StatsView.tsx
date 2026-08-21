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
  if (stats.total === 0) {
    return <Text style={styles.muted}>{strings.statsEmpty}</Text>;
  }

  return (
    <View>
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
    </View>
  );
}
