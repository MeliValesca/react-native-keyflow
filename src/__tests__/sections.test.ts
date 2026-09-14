import { serializeKeyboardTheme } from '../serializeTheme';
import {
  createKeyboardTheme,
  androidKeyboardTheme,
  androidDarkKeyboardTheme,
} from '../theme';

test('Android previews use native bubble fills and accept independent customization', () => {
  expect(androidKeyboardTheme.sections?.preview).toMatchObject({
    background: '#FFFFFF',
    fontSize: 28,
  });
  expect(androidDarkKeyboardTheme.sections?.preview?.background).toBe(
    '#33343A',
  );
  const theme = createKeyboardTheme(
    { preview: { background: '#123456', fontSize: 30 } },
    androidKeyboardTheme,
  );
  expect(theme.sections?.preview).toMatchObject({
    background: '#123456',
    fontSize: 30,
  });
  expect(theme.sections?.keys?.background).toBe('#FFFFFF');
});

test('section colors and fonts inherit shared defaults', () => {
  const theme = createKeyboardTheme({
    font: { family: 'system-serif', weight: 'bold' },
    keys: { color: '#FF0000' },
  });
  expect(theme.sections?.keys).toMatchObject({
    color: '#FF0000',
    iconColor: '#FF0000',
    pressedColor: '#FF0000',
    fontFamily: 'system-serif',
    fontWeight: 'bold',
  });
});
test('explicit section overrides survive partial updates without mutating the base', () => {
  const base = createKeyboardTheme({
    toolbar: { color: '#123456', fontFamily: 'system-serif' },
  });
  const theme = createKeyboardTheme(
    {
      font: { family: 'system-monospace' },
      toolbar: { color: undefined, borderWidth: 2 },
    },
    base,
  );
  expect(theme.sections?.toolbar).toMatchObject({
    color: '#123456',
    fontFamily: 'system-serif',
    borderWidth: 2,
  });
  expect(theme.sections?.keys?.fontFamily).toBe('system-monospace');
  expect(base.sections?.toolbar?.borderWidth).toBe(0);
  expect(Object.isFrozen(theme.sections?.toolbar)).toBe(true);
});
test('section fonts can reset to system and invalid styles are rejected', () => {
  expect(
    createKeyboardTheme({
      font: { family: 'system-serif' },
      keys: { fontFamily: null },
    }).sections?.keys?.fontFamily,
  ).toBeNull();
  for (const style of [
    { color: 'red' },
    { fontSize: 99 },
    { borderWidth: -1 },
    { iconSize: Infinity },
    { fontWeight: 'heavy' },
    { fontFamily: '' },
  ]) {
    expect(() => createKeyboardTheme({ keys: style as never })).toThrow();
  }
});

test('focused long-press colors remain independent through serialization', () => {
  const theme = createKeyboardTheme(
    {
      preview: { background: '#173E42', color: '#E1F7F1' },
      selection: { background: '#A8E6CF', color: '#123B32' },
    },
    androidKeyboardTheme,
  );
  const native = JSON.parse(serializeKeyboardTheme(theme));
  expect(native.sectionOverrides.selection).toEqual({
    background: '#A8E6CF',
    color: '#123B32',
  });
  expect(native.sections.preview.background).toBe('#173E42');
  expect(native.sections.keys.background).toBe('#FFFFFF');
});
