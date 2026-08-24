import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { QuestionOrder } from '../data/quizLogic';
import { orderLabels, strings } from '../strings';
import { styles } from '../styles';

export type SettingsControlsProps = {
  order: QuestionOrder;
  onOrderChange: (order: QuestionOrder) => void;
  topic: string | null;
  topics: string[];
  onTopicChange: (topic: string | null) => void;
  sessionSize: number;
  onSessionSizeChange: (size: number) => void;
  onShowStats: () => void;
  onExport: () => void;
  onImport: () => void;
  backupBusy: boolean;
};

const ORDERS: QuestionOrder[] = [
  'sequential',
  'random',
  'weakest',
  'stale',
  'least-answered',
  'incorrect-streak',
];
const SESSION_SIZES = [10, 20, 40];

export function SettingsControls({
  order,
  onOrderChange,
  topic,
  topics,
  onTopicChange,
  sessionSize,
  onSessionSizeChange,
  onShowStats,
  onExport,
  onImport,
  backupBusy,
}: SettingsControlsProps) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  return (
    <View>
      <Text style={styles.subheader}>{strings.order}</Text>
      <View style={styles.row}>
        {ORDERS.map((value) => {
          const active = value === order;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.chip, active ? styles.chipActive : null]}
              onPress={() => onOrderChange(value)}
            >
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                {orderLabels[value]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.subheaderToggle} onPress={() => setCategoryOpen((v) => !v)}>
        <Text style={styles.subheader}>{strings.category}</Text>
        <Text style={styles.subheaderToggleValue}>
          {(topic ?? strings.allCategories) + (categoryOpen ? '  ▲' : '  ▼')}
        </Text>
      </TouchableOpacity>
      {categoryOpen ? (
        <View style={styles.row}>
          {[null, ...topics].map((value) => {
            const active = value === topic;
            return (
              <TouchableOpacity
                key={value ?? 'all'}
                style={[styles.chip, active ? styles.chipActive : null]}
                onPress={() => {
                  onTopicChange(value);
                  setCategoryOpen(false);
                }}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                  {value ?? strings.allCategories}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.subheader}>{strings.sessionSize}</Text>
      <View style={styles.row}>
        {SESSION_SIZES.map((size) => {
          const active = size === sessionSize;
          return (
            <TouchableOpacity
              key={size}
              style={[styles.chip, active ? styles.chipActive : null]}
              onPress={() => onSessionSizeChange(size)}
            >
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{size}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.subheader}>{strings.backup}</Text>
      <TouchableOpacity style={styles.secondaryButton} onPress={onShowStats} disabled={backupBusy}>
        <Text style={styles.secondaryButtonText}>{strings.showStats}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={onExport} disabled={backupBusy}>
        <Text style={styles.secondaryButtonText}>{strings.exportAnswers}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={onImport} disabled={backupBusy}>
        <Text style={styles.secondaryButtonText}>{strings.importAnswers}</Text>
      </TouchableOpacity>
    </View>
  );
}
