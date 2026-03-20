import { spawnSync, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns } from 'node:child_process';

export const runSpawnSync = (
  command: string,
  options: SpawnSyncOptionsWithStringEncoding,
): SpawnSyncReturns<string> => spawnSync(command, options);
