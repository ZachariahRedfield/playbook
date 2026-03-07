export const responseModes = {
  normal: {
    description: 'Full explanation with context',
    instruction: 'Respond with complete explanations, contextual details, and clear reasoning.'
  },
  concise: {
    description: 'Compressed but still complete answers',
    instruction:
      'Respond concisely. Keep answers technically complete but compressed for fast skimming. Prefer short paragraphs or bullet points. Avoid filler text.'
  },
  ultra: {
    description: 'Maximum compression, bullet points prioritized',
    instruction:
      'Respond in ultra concise format. Rules: bullet points preferred; prioritize actionable information; skip explanations unless necessary.'
  }
} as const;

export type ResponseMode = keyof typeof responseModes;

const responseModeValues = Object.keys(responseModes) as ResponseMode[];

export const parseResponseMode = (value: string | undefined): ResponseMode => {
  if (!value || value.trim().length === 0) {
    return 'normal';
  }

  const normalized = value.trim().toLowerCase();
  if (responseModeValues.includes(normalized as ResponseMode)) {
    return normalized as ResponseMode;
  }

  throw new Error(`Invalid --mode value "${value}". Allowed values: ${responseModeValues.join(', ')}.`);
};

export const getResponseModeInstruction = (mode: ResponseMode): string => responseModes[mode].instruction;
