/**
 * device.ts — seed the language from the phone's own preference list.
 *
 * Separated from the rest of i18n so the pure resolution logic stays testable
 * under plain Node, with no native locale module to boot.
 */

import { getLocales } from 'expo-localization';

import { initLanguage } from './index.ts';
import type { Language } from './index.ts';

export function initLanguageFromDevice(): Language {
  try {
    return initLanguage(getLocales().map((locale) => locale.languageTag));
  } catch {
    // A locale module that cannot answer is not a reason to fail to start.
    return initLanguage([]);
  }
}
