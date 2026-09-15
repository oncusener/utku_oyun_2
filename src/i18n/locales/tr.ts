/**
 * tr.ts — Türkçe metinler.
 *
 * `Copy` tipine uyduğu için eksik veya yanlış yazılmış bir anahtar derleme
 * hatası verir; oyuncu boş metin görmez.
 */

import type { Copy } from './en.ts';

export const tr: Copy = {
  sessionEnd: {
    level: 'SEVİYE',
    merges: 'BİRLEŞME',
    chain: 'ZİNCİR',
    again: 'yeniden başlamak için dokun',
    revive: 'halkayı temizlemek için reklam izle',
    reviveLoading: 'yükleniyor…',
  },
  language: {
    switchTo: 'EN',
  },
};
