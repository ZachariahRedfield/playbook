import fs from 'node:fs';
import path from 'node:path';

export type CleanupOptions = {
  sessionsDir: string;
  maxDays?: number;
  maxCount?: number;
  dryRun?: boolean;
  now?: Date;
};

export type CleanupResult = {
  deleted: string[];
  kept: string[];
  deletedCount: number;
  keptCount: number;
};

const listSnapshots = (sessionsDir: string): Array<{ path: string; mtimeMs: number }> => {
  if (!fs.existsSync(sessionsDir)) {
    return [];
  }

  return fs
    .readdirSync(sessionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => {
      const filePath = path.join(sessionsDir, entry);
      return { path: filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));
};

export const cleanupSessionSnapshots = (options: CleanupOptions): CleanupResult => {
  const maxDays = options.maxDays ?? 30;
  const maxCount = options.maxCount ?? 50;
  const now = options.now ?? new Date();

  const snapshots = listSnapshots(options.sessionsDir);
  const cutoff = now.getTime() - maxDays * 24 * 60 * 60 * 1000;

  const byAge = snapshots.filter((snapshot) => snapshot.mtimeMs >= cutoff);
  const keep = byAge.slice(0, Math.min(maxCount, byAge.length));
  const keepSet = new Set(keep.map((snapshot) => snapshot.path));

  const deleted = snapshots.filter((snapshot) => !keepSet.has(snapshot.path)).map((snapshot) => snapshot.path).sort();
  const kept = keep.map((snapshot) => snapshot.path).sort();

  if (!options.dryRun) {
    for (const filePath of deleted) {
      fs.unlinkSync(filePath);
    }
  }

  return {
    deleted,
    kept,
    deletedCount: deleted.length,
    keptCount: kept.length
  };
};
