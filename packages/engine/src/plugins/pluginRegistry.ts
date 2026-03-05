import type { PlaybookPlugin, PlaybookRule, StackDetector } from './pluginTypes.js';

const registeredRules: PlaybookRule[] = [];
const registeredDetectors: StackDetector[] = [];

export const resetPluginRegistry = (): void => {
  registeredRules.length = 0;
  registeredDetectors.length = 0;
};

export const registerRule = (rule: PlaybookRule): void => {
  if (registeredRules.some((existing) => existing.id === rule.id)) return;
  registeredRules.push(rule);
};

export const registerDetector = (detector: StackDetector): void => {
  if (registeredDetectors.some((existing) => existing.id === detector.id)) return;
  registeredDetectors.push(detector);
};

export const registerPlugin = (plugin: PlaybookPlugin): void => {
  plugin.rules?.forEach(registerRule);
  plugin.detectors?.forEach(registerDetector);
};

export const getRegisteredRules = (): PlaybookRule[] => [...registeredRules];

export const getRegisteredDetectors = (): StackDetector[] => [...registeredDetectors];
