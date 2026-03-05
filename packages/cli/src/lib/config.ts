import { loadConfig, type PlaybookConfig } from '@zachariahredfield/playbook-engine';

export type LoadedPlaybookConfig = { config: PlaybookConfig; warning?: string };

export const readConfig = (repoRoot: string): LoadedPlaybookConfig => loadConfig(repoRoot);
