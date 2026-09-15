/**
 * useCopy — subscribe a component to the active language.
 *
 * `useSyncExternalStore` rather than a context provider: the language lives in a
 * plain module because non-React code needs to read it too, and this is the
 * supported way to read mutable external state without tearing.
 */

import { useSyncExternalStore } from 'react';

import { copy, getLanguage, subscribe } from './index.ts';
import type { Copy, Language } from './index.ts';

export function useCopy(): Copy {
  useSyncExternalStore(subscribe, getLanguage, getLanguage);
  return copy();
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}
