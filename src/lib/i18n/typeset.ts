import { getLocale } from '#lib/paraglide/runtime.js';
import { bindShortWords } from './typography.ts';

// Visible text in the locale being rendered (the one m.*() uses); never for
// attribute text or accessible names.
export const typeset = (text: string): string => bindShortWords(text, getLocale());
