/**
 * tr.ts — Türkçe metinler.
 *
 * `Copy` tipine uyduğu için eksik veya yanlış yazılmış bir anahtar derleme
 * hatası verir; oyuncu boş metin görmez. `{n}` gibi yer tutucuları `format()`
 * doldurur; sayının cümledeki yeri çeviriye aittir (yüzde işareti başa gelir).
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
  map: {
    region: 'BÖLGE {n}',
    level: 'SEVİYE {n}',
    play: 'OYNA',
    nextUp: 'SIRADAKİ',
    hard: 'ZOR',
    coins: 'JETON',
    endless: 'SONSUZ',
    locked: 'açmak için {n}. bölgeyi bitir',
    previousRegion: 'önceki bölge',
    nextRegion: 'sonraki bölge',
  },
  objective: {
    merges: 'BİRLEŞME',
    prisms: 'PRİZMA',
    colour0: 'TURKUAZ',
    colour1: 'KEHRİBAR',
    colour2: 'MOR',
  },
  hud: {
    drops: 'HAMLE',
    pause: 'duraklat',
    back: 'haritaya dön',
  },
  lesson: {
    merge:
      'halkayı çevirmek için sürükle · bırakınca taş düşer\nyan yana üç aynı renk birleşir',
    rotate: 'çift, düşme noktasının altında değil\nönce halkayı çevir',
    colour: 'bu renkten birleştirdiğin her taş sayılır',
    prism: 'yan yana dört taş geride bir prizma bırakır\nprizma her renge uyar',
  },
  result: {
    complete: 'TAMAMLANDI',
    ringFull: 'HALKA DOLDU',
    soClose: 'ÇOK YAKIN',
    drops: 'HAMLE',
    coinsEarned: 'KAZANILAN JETON',
    balance: 'BAKİYE {n}',
    alreadyCollected: 'daha önce alındı',
    newBest: 'YENİ REKOR',
    double: 'ÖDÜLÜ İKİYE KATLA',
    ad: 'REKLAM',
    next: 'SONRAKİ SEVİYE',
    map: 'HARİTAYA DÖN',
    percent: '%{n}',
    goalProgress: 'HEDEF İLERLEMESİ',
    stillNeeded: 'KALAN',
    continue: 'DEVAM ET',
    continueHint: 'halka boşalır · ilerleme kalır',
    continueCoins: 'DEVAM ET · {n} JETON',
    retry: 'TEKRAR DENE',
    loading: 'yükleniyor…',
  },
  pause: {
    title: 'DURAKLATILDI',
    resume: 'DEVAM',
    restart: 'YENİDEN BAŞLA',
  },
  language: {
    switchTo: 'EN',
  },
};
