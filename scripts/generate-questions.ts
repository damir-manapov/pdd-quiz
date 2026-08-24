// One-time ETL/codegen step: takes the scraped official ПДД dataset
// in ../data and produces the bundled app assets + a static image-asset lookup table.
//
//   data/pdd.json      -> assets/questions.json           (the question bank the app loads)
//   data/images/*.jpg  -> assets/images/*.jpg             (bundled, offline)
//   (derived)          -> src/data/generated/imageAssets.ts (imagePath -> require(...) map)
//
// Metro can only resolve static string-literal require() paths, so the asset map must be
// generated rather than built with dynamic require() at runtime.
//
// Run with `node scripts/generate-questions.ts` (Node strips the type annotations natively).

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The raw source is untrusted (the fidelity checks below validate it), so every field is
// optional/loosely typed here — presence and shape are asserted at runtime, not by the compiler.
type RawOption = { id?: string; text?: string };
type RawQuestion = {
  id?: string;
  topic?: string;
  category?: string;
  text?: string;
  code?: string;
  explanation?: string;
  imagePath?: string;
  options?: RawOption[];
  correctOptionId?: string;
};
type RawFile = RawQuestion[] | { questions?: RawQuestion[]; sourceVersion?: string };

type GeneratedOption = { id: string; text: string };
type GeneratedQuestion = {
  id: string;
  topic: string;
  text: string;
  options: GeneratedOption[];
  correctOptionId: string;
  code?: string;
  explanation?: string;
  imagePath?: string;
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const assetsDir = join(root, 'assets');
const assetImagesDir = join(assetsDir, 'images');
const generatedDir = join(root, 'src', 'data', 'generated');

const sourceFile = join(dataDir, 'pdd.json');
if (!existsSync(sourceFile)) {
  throw new Error(`Missing source dataset: ${sourceFile}`);
}

const raw = JSON.parse(readFileSync(sourceFile, 'utf8')) as RawFile;
const questions = Array.isArray(raw) ? raw : raw.questions;
if (!Array.isArray(questions)) {
  throw new Error('Source dataset has no "questions" array');
}

// --- Fidelity checks: fail loudly on transcription/import mistakes ---
const errors: string[] = [];
const seenIds = new Set<unknown>();
for (const q of questions) {
  if (!q.id) errors.push(`Question missing id: ${JSON.stringify(q).slice(0, 80)}`);
  if (seenIds.has(q.id)) errors.push(`Duplicate question id: ${q.id}`);
  seenIds.add(q.id);
  if (!q.text?.trim()) errors.push(`Question ${q.id} has empty text`);
  if (!Array.isArray(q.options) || q.options.length < 2) {
    errors.push(`Question ${q.id} has fewer than 2 options`);
  }
  const optIds = new Set<unknown>();
  for (const o of q.options ?? []) {
    if (!o.id) errors.push(`Question ${q.id} has an option with no id`);
    if (optIds.has(o.id)) errors.push(`Question ${q.id} has duplicate option id ${o.id}`);
    optIds.add(o.id);
    if (!o.text?.trim()) errors.push(`Question ${q.id} option ${o.id} has empty text`);
  }
  if (!optIds.has(q.correctOptionId)) {
    errors.push(`Question ${q.id} correctOptionId ${q.correctOptionId} matches no option`);
  }
  if (q.imagePath && !existsSync(join(dataDir, q.imagePath))) {
    errors.push(`Question ${q.id} imagePath missing on disk: ${q.imagePath}`);
  }
}
if (errors.length > 0) {
  throw new Error(`Dataset fidelity check failed:\n - ${errors.slice(0, 30).join('\n - ')}`);
}

// The scraped source encodes punctuation as HTML entities (« » — … etc.); decode them so
// the app renders real characters instead of literal "&laquo;".
const namedEntities: Record<string, string> = {
  laquo: '«',
  raquo: '»',
  nbsp: '\u00a0',
  quot: '"',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  amp: '&',
  lt: '<',
  gt: '>',
};
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => namedEntities[name] ?? match);
}

// --- Normalise into the app's QuizQuestion shape (drop reference-only fields) ---
const cleaned: GeneratedQuestion[] = questions.map((q) => ({
  id: String(q.id),
  topic: String(q.topic ?? q.category ?? 'ПДД'),
  text: decodeEntities(String(q.text).trim()),
  options: (q.options ?? []).map((o) => ({
    id: String(o.id),
    text: decodeEntities(String(o.text).trim()),
  })),
  correctOptionId: String(q.correctOptionId),
  ...(q.code ? { code: String(q.code) } : {}),
  ...(q.explanation ? { explanation: decodeEntities(String(q.explanation).trim()) } : {}),
  ...(q.imagePath ? { imagePath: String(q.imagePath).replace(/^data\//, '') } : {}),
}));

// --- Write bundled question bank ---
mkdirSync(assetsDir, { recursive: true });
writeFileSync(join(assetsDir, 'questions.json'), `${JSON.stringify(cleaned, null, 2)}\n`);

// --- Copy images into assets ---
rmSync(assetImagesDir, { recursive: true, force: true });
mkdirSync(assetImagesDir, { recursive: true });
const usedImages: string[] = [
  ...new Set(cleaned.map((q) => q.imagePath).filter((p): p is string => Boolean(p))),
];
for (const rel of usedImages) {
  cpSync(join(dataDir, rel), join(root, 'assets', rel));
}

// --- Generate the static image asset map ---
const entries = usedImages
  .map((rel) => `  ${JSON.stringify(rel)}: require('../../../assets/${rel}'),`)
  .join('\n');
const assetMap = `// AUTO-GENERATED by scripts/generate-questions.ts — do not edit by hand.
// Static require() lookup so <Image source={imageAssets[imagePath]} /> works offline.

import type { ImageSourcePropType } from 'react-native';

export const imageAssets: Record<string, ImageSourcePropType> = {
${entries}
};
`;
mkdirSync(generatedDir, { recursive: true });
writeFileSync(join(generatedDir, 'imageAssets.ts'), assetMap);

const meta = Array.isArray(raw) ? 'unknown' : (raw.sourceVersion ?? 'unknown');
console.log(
  `Generated ${cleaned.length} questions (${usedImages.length} images), source version ${meta}.`,
);

// Content hash for record-keeping of exactly which dataset was bundled.
const hash = createHash('sha256').update(readFileSync(sourceFile)).digest('hex').slice(0, 12);
console.log(`Source dataset sha256: ${hash}`);
