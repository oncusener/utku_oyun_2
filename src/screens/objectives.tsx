/**
 * objectives.tsx — how an objective is named and marked, everywhere it appears.
 *
 * The HUD, the map card and the "still needed" panel all show objectives, and
 * they have to agree: the same mark, the same word. Each objective gets a small
 * mark drawn from the ring's own vocabulary — three dots in a row for a merge,
 * a piece of the colour for a colour target, a prism's diamond for a prism —
 * so the goal reads at a glance without a word of either language.
 */

import React from 'react';
import { View } from 'react-native';

import type { Objective } from '../game/levels';
import { palette, pieceColors, prismColor, prismRim } from '../game/theme';
import type { Copy } from '../i18n';

export function objectiveLabel(o: Objective, copy: Copy): string {
  switch (o.kind) {
    case 'merges':
      return copy.objective.merges;
    case 'prisms':
      return copy.objective.prisms;
    case 'colour':
      return [copy.objective.colour0, copy.objective.colour1, copy.objective.colour2][
        o.colour
      ];
  }
}

export function ObjectiveMark({ o, size = 10 }: { o: Objective; size?: number }) {
  if (o.kind === 'colour') {
    return (
      <View
        style={{
          width: size + 2,
          height: size + 2,
          borderRadius: (size + 2) / 2,
          backgroundColor: pieceColors[o.colour],
        }}
      />
    );
  }

  if (o.kind === 'prisms') {
    return (
      <View
        style={{
          width: size,
          height: size,
          transform: [{ rotate: '45deg' }],
          backgroundColor: prismColor,
          borderWidth: 1,
          borderColor: prismRim,
        }}
      />
    );
  }

  const dot = Math.max(3, Math.round(size * 0.45));
  return (
    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: palette.text,
          }}
        />
      ))}
    </View>
  );
}
