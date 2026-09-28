/**
 * insets.ts — fixed clearances for the notch and the home indicator.
 *
 * A safe-area library would be a new native module, which means a fresh
 * development build for every tester, to position half a dozen labels. The
 * status bar is hidden, so what is left to clear is the camera cutout at the
 * top and the gesture bar at the bottom, and both fit inside these numbers on
 * every current phone.
 */

import { Platform } from 'react-native';

export const INSET_TOP = Platform.select({ ios: 58, android: 44, default: 24 });
export const INSET_BOTTOM = Platform.select({ ios: 34, android: 24, default: 20 });
