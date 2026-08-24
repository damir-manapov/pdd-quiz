import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { shouldHandleBack } from './backNavigation';
import { QuizCard } from './components/QuizCard';
import { SettingsControls } from './components/SettingsControls';
import { StatsView } from './components/StatsView';
import { getProgressPercent } from './data/quizLogic';
import { useBackup } from './hooks/useBackup';
import { useQuiz } from './hooks/useQuiz';
import { useStats } from './hooks/useStats';
import { strings } from './strings';
import { colors, styles } from './styles';

// Thin composition root: wires the hooks and presentational components together, no logic of its own.
export default function App() {
  const quiz = useQuiz();
  const stats = useStats(quiz.history);
  const backup = useBackup(quiz.reload);
  const [showStats, setShowStats] = useState<boolean>(false);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!shouldHandleBack(quiz.status)) {
        return false;
      }
      return true;
    });

    return () => subscription.remove();
  }, [quiz.status]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.header}>{strings.appTitle}</Text>

          {quiz.status === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}

          {quiz.status === 'ready' ? (
            <View>
              <SettingsControls
                order={quiz.order}
                onOrderChange={quiz.setOrder}
                topic={quiz.topic}
                topics={quiz.topics}
                onTopicChange={quiz.setTopic}
                sessionSize={quiz.sessionSize}
                onSessionSizeChange={quiz.setSessionSize}
                onShowStats={() => setShowStats((value) => !value)}
                onExport={backup.exportNow}
                onImport={backup.importNow}
                backupBusy={backup.busy}
              />
              {showStats ? (
                <View>
                  <Text style={styles.subheader}>{strings.stats}</Text>
                  <StatsView stats={stats} />
                </View>
              ) : null}
              <TouchableOpacity style={styles.button} onPress={quiz.start}>
                <Text style={styles.buttonText}>{strings.start}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {quiz.status === 'active' && quiz.current !== undefined ? (
            <View>
              <Text style={styles.progressText}>
                {strings.question(quiz.currentIndex + 1, quiz.session.length)}
              </Text>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${getProgressPercent(quiz.currentIndex, quiz.session.length)}%` },
                  ]}
                />
              </View>
              <QuizCard
                question={quiz.current}
                selectedOptionId={quiz.selectedOptionId}
                onSelect={quiz.answer}
              />
              {quiz.selectedOptionId !== null ? (
                <TouchableOpacity style={styles.button} onPress={quiz.next}>
                  <Text style={styles.buttonText}>
                    {quiz.currentIndex + 1 >= quiz.session.length
                      ? strings.showStats
                      : strings.next}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {quiz.status === 'finished' ? (
            <View>
              <Text style={styles.subheader}>{strings.sessionComplete}</Text>
              <Text style={styles.muted}>
                {strings.sessionScore(quiz.correctCount, quiz.session.length)}
              </Text>
              <View style={{ marginTop: 16 }}>
                <StatsView stats={stats} />
              </View>
              <TouchableOpacity
                style={styles.button}
                onPress={() =>
                  Alert.alert(strings.restartConfirmTitle, strings.restartConfirmMessage, [
                    { text: strings.cancel, style: 'cancel' },
                    { text: strings.confirm, onPress: quiz.restart },
                  ])
                }
              >
                <Text style={styles.buttonText}>{strings.restart}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
