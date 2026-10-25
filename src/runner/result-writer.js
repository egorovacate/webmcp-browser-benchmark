import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeJsonl } from './metrics.js';

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(api.?key|secret|password|authorization|access.?token)/i.test(key))
    .map(([key, entry]) => [key, redact(entry)]));
}

export async function writeAttemptResult({ outputDir, runId, manifest, summary, events } = {}) {
  if (!outputDir || !runId) throw new Error('output directory and run ID are required');
  if (!Array.isArray(events)) throw new Error('attempt events must be an array');

  const attemptDir = join(outputDir, runId);
  await mkdir(attemptDir, { recursive: true });
  const manifestPath = join(attemptDir, 'manifest.json');
  const summaryPath = join(attemptDir, 'summary.json');
  const eventsPath = join(attemptDir, 'events.jsonl');
  await Promise.all([
    writeFile(manifestPath, `${JSON.stringify(redact(manifest), null, 2)}\n`, 'utf8'),
    writeFile(summaryPath, `${JSON.stringify(redact(summary), null, 2)}\n`, 'utf8'),
    writeJsonl(eventsPath, redact(events)),
  ]);
  return { attemptDir, manifestPath, summaryPath, eventsPath };
}
