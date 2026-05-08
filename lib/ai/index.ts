export const DEFAULT_MODEL = 'anthropic/claude-haiku-4-5' as const;
export const FALLBACK_MODEL = 'openai/gpt-5-mini' as const;

export type ModelId = typeof DEFAULT_MODEL | typeof FALLBACK_MODEL;
