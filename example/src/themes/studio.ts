import { createKeyboardTheme } from 'react-native-keyflow';

/** Original example styling, composed entirely through Keyflow's public theme API. */
export const studioTheme = createKeyboardTheme({
  keyboard: {
    material: { type: 'raised', depth: 4, shadowColor: '#241D46' },
  },
  background: '#F4F0FF',
  keyBackground: '#342B62',
  keyForeground: '#F4F0FF',
  specialKeyBackground: '#E05B8D',
  specialKeyForeground: '#FFFFFF',
  deleteKeyBackground: '#A8DADC',
  actionKeyBackground: '#E05B8D',
  actionKeyForeground: '#FFFFFF',
  pressedKeyBackground: '#55458F',
  preview: { background: '#342B62', color: '#F4F0FF' },
  selection: { background: '#E05B8D', color: '#FFFFFF' },
  keyCornerRadius: 8,
  fontSize: 20,
  fontWeight: 'medium',
});
