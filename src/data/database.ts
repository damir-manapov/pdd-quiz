import * as SQLite from 'expo-sqlite';
import { type AnswerRow, answerToRow, rowToAnswer } from './databaseMappers';
import type { AnswerRecord } from './quizLogic';

type Migration = (db: SQLite.SQLiteDatabase) => Promise<void>;

// Append-only: never edit a past migration, only append new ones. Tracked via PRAGMA user_version.
const migrations: Migration[] = [
  async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        questionId TEXT NOT NULL,
        mode TEXT NOT NULL,
        optionId TEXT NOT NULL,
        correct INTEGER NOT NULL,
        answeredAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  },
];

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < migrations.length; version += 1) {
    const migration = migrations[version];
    if (migration !== undefined) await migration(db);
  }
  if (current < migrations.length) {
    await db.execAsync(`PRAGMA user_version = ${migrations.length}`);
  }
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbPromise === null) {
    dbPromise = SQLite.openDatabaseAsync('pdd-quiz.db').then(async (db) => {
      await db.execAsync('PRAGMA journal_mode = WAL');
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

const INSERT_ANSWER =
  'INSERT INTO answers (questionId, mode, optionId, correct, answeredAt) VALUES (?, ?, ?, ?, ?)';

export async function recordAnswer(answer: AnswerRecord): Promise<void> {
  const db = await getDb();
  const row = answerToRow(answer);
  await db.runAsync(INSERT_ANSWER, row.questionId, row.mode, row.optionId, row.correct, row.answeredAt);
}

export async function getAnswerHistory(): Promise<AnswerRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<AnswerRow>(
    'SELECT questionId, mode, optionId, correct, answeredAt FROM answers ORDER BY answeredAt ASC',
  );
  const answers: AnswerRecord[] = [];
  for (const row of rows) {
    const record = rowToAnswer(row);
    if (record !== null) answers.push(record);
  }
  return answers;
}

export async function replaceAnswerHistory(answers: readonly AnswerRecord[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM answers');
    for (const answer of answers) {
      const row = answerToRow(answer);
      await db.runAsync(
        INSERT_ANSWER,
        row.questionId,
        row.mode,
        row.optionId,
        row.correct,
        row.answeredAt,
      );
    }
  });
}

export async function clearAnswerHistory(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM answers');
}

export async function getPreference(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM preferences WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setPreference(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)', key, value);
}
