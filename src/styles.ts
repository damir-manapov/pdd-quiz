import { StyleSheet } from 'react-native';

export const colors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceAlt: '#334155',
  primary: '#38bdf8',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  correct: '#22c55e',
  incorrect: '#ef4444',
  border: '#475569',
} as const;

// One shared StyleSheet used by every component (no per-component style files).
export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  subheader: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  subheaderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subheaderToggleValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  questionText: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 12,
    lineHeight: 24,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    resizeMode: 'contain',
    backgroundColor: colors.surfaceAlt,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.surfaceAlt,
  },
  optionCorrect: {
    borderColor: colors.correct,
    backgroundColor: '#14532d',
  },
  optionIncorrect: {
    borderColor: colors.incorrect,
    backgroundColor: '#7f1d1d',
  },
  optionText: {
    color: colors.text,
    fontSize: 15,
  },
  feedback: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  feedbackCorrect: {
    color: colors.correct,
  },
  feedbackIncorrect: {
    color: colors.incorrect,
  },
  explanationBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  explanationText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontSize: 14,
  },
  chipTextActive: {
    color: colors.background,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statLabel: {
    color: colors.text,
    fontSize: 14,
    flexShrink: 1,
    paddingRight: 8,
  },
  statValue: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
