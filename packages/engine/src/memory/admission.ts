import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { MEMORY_PRESSURE_STATUS_LEGACY_RELATIVE_PATH, MEMORY_PRESSURE_STATUS_RELATIVE_PATH, type MemoryPressureBand } from './pressurePolicy.js';

export type MemoryAdmissionBand = MemoryPressureBand;

export type AdmissionDecision =
  | { action: 'admit'; band: MemoryAdmissionBand; reason: string }
  | { action: 'dedupe'; band: MemoryAdmissionBand; reason: string }
  | { action: 'rollup'; band: MemoryAdmissionBand; reason: string; rollupKey: string }
  | { action: 'skip'; band: MemoryAdmissionBand; reason: string };

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort((left, right) => left.localeCompare(right))) {
      const nested = canonicalize(record[key]);
      if (nested !== undefined) normalized[key] = nested;
    }
    return normalized;
  }
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') return undefined;
  return value;
};

const stableHash = (value: unknown, size = 16): string =>
  createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex').slice(0, size);

const normalizeBand = (value: unknown): MemoryAdmissionBand =>
  value === 'warm' || value === 'pressure' || value === 'critical' ? value : 'normal';

export const readCurrentMemoryPressureBand = (repoRoot: string): MemoryAdmissionBand => {
  const candidates = [MEMORY_PRESSURE_STATUS_RELATIVE_PATH, MEMORY_PRESSURE_STATUS_LEGACY_RELATIVE_PATH];
  for (const relativePath of candidates) {
    const fullPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as { band?: unknown };
      return normalizeBand(parsed.band);
    } catch {
      continue;
    }
  }
  return 'normal';
};

export const isLowSignalMemoryInput = (input: {
  riskLevel?: string;
  outcomeStatus?: string;
  signalCount?: number;
  hasModules?: boolean;
  hasRuleIds?: boolean;
}): boolean => {
  const lowRisk = input.riskLevel === 'low' || input.riskLevel === 'unknown' || !input.riskLevel;
  const nonCriticalOutcome = input.outcomeStatus === 'success' || input.outcomeStatus === 'skipped' || !input.outcomeStatus;
  const sparseScope = !input.hasModules && !input.hasRuleIds;
  const noExtraSignals = (input.signalCount ?? 0) <= 0;
  return lowRisk && nonCriticalOutcome && (sparseScope || noExtraSignals);
};

export const toAdmissionKey = (parts: { channel: string; kind: string; subject?: string; payload: unknown }): string =>
  stableHash({ channel: parts.channel, kind: parts.kind, subject: parts.subject ?? null, payload: parts.payload });

export const decideAdmission = (input: {
  band: MemoryAdmissionBand;
  isCanonical: boolean;
  isReviewCritical: boolean;
  isHighSignal: boolean;
  isLowSignal: boolean;
  duplicateCount: number;
  admissionKey: string;
}): AdmissionDecision => {
  if (input.isCanonical || input.isReviewCritical) {
    return { action: 'admit', band: input.band, reason: 'canonical-or-review-critical' };
  }

  if (input.band === 'normal') {
    return { action: 'admit', band: input.band, reason: 'normal-band-admit' };
  }

  if (input.band === 'warm') {
    if (input.isLowSignal && input.duplicateCount > 0) {
      return { action: 'dedupe', band: input.band, reason: 'warm-band-low-signal-dedupe' };
    }
    return { action: 'admit', band: input.band, reason: 'warm-band-admit' };
  }

  if (input.band === 'pressure') {
    if (input.isLowSignal && input.duplicateCount > 0) {
      return { action: 'rollup', band: input.band, reason: 'pressure-band-rollup-repeated-low-signal', rollupKey: input.admissionKey };
    }
    return { action: 'admit', band: input.band, reason: 'pressure-band-admit' };
  }

  if (input.isHighSignal) {
    return { action: 'admit', band: input.band, reason: 'critical-band-high-signal' };
  }

  return { action: 'skip', band: input.band, reason: 'critical-band-skip-low-value' };
};

type RollupState = {
  schemaVersion: '1.0';
  kind: 'playbook-memory-admission-rollup';
  channel: string;
  key: string;
  firstSeenAt: string;
  lastSeenAt: string;
  observedCount: number;
  sample: Record<string, unknown>;
};

export const writeAdmissionRollup = (input: {
  repoRoot: string;
  channel: string;
  rollupKey: string;
  occurredAt: string;
  sample: Record<string, unknown>;
}): string => {
  const rollupsDir = path.join(input.repoRoot, '.playbook/memory/events/rollups');
  fs.mkdirSync(rollupsDir, { recursive: true });
  const filePath = path.join(rollupsDir, `${input.channel}-${input.rollupKey}.json`);
  const current = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<RollupState>
    : null;

  const payload: RollupState = {
    schemaVersion: '1.0',
    kind: 'playbook-memory-admission-rollup',
    channel: input.channel,
    key: input.rollupKey,
    firstSeenAt: typeof current?.firstSeenAt === 'string' ? current.firstSeenAt : input.occurredAt,
    lastSeenAt: input.occurredAt,
    observedCount: Math.max(1, (typeof current?.observedCount === 'number' ? current.observedCount : 0) + 1),
    sample: canonicalize(input.sample) as Record<string, unknown>
  };

  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
};
