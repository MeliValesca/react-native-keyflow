import { serializeKeyboardTheme } from '../serializeTheme';
import {
  createKeyboardTheme,
  darkKeyboardTheme,
  keyboardThemeLimits,
  transparentKeyboardTheme,
} from '../theme';

test('translucent keys stay defined when customizing fonts', () => {
  const theme = createKeyboardTheme(
    { fontFamily: 'system-rounded', fontSize: 32 },
    transparentKeyboardTheme,
  );
  const original = JSON.parse(serializeKeyboardTheme(transparentKeyboardTheme));
  const rendered = JSON.parse(serializeKeyboardTheme(theme));
  for (const key of [
    'background',
    'keyBackground',
    'specialKeyBackground',
    'deleteKeyBackground',
    'actionKeyBackground',
  ]) {
    expect(rendered[key]).toBe(original[key]);
    expect(parseInt(rendered[key].slice(-2), 16)).toBeGreaterThan(0);
    expect(parseInt(rendered[key].slice(-2), 16)).toBeLessThan(255);
  }
  // Space uses the same face as letters, even though its label is empty.
  expect(rendered.sections.keys.background).toBe('#FFFFFFb3');
  expect(rendered.sections.keys.borderWidth).toBeGreaterThan(0);
  expect(theme.fontFamily).toBe('system-rounded');
});

test('merges overrides without changing or exposing mutable presets', () => {
  const theme = createKeyboardTheme({ fontSize: 24 }, darkKeyboardTheme);
  expect(theme.fontSize).toBe(24);
  expect(theme.background).toBe(darkKeyboardTheme.background);
  expect(darkKeyboardTheme.fontSize).toBe(22);
  expect(Object.isFrozen(theme)).toBe(true);
});

test('undefined overrides retain defaults', () => {
  expect(createKeyboardTheme({ fontSize: undefined })).toEqual(
    createKeyboardTheme(),
  );
});

test.each(['#FFF', '#GGGGGG', '#123456789'])(
  'rejects malformed color %s',
  (color) => {
    expect(() =>
      createKeyboardTheme({ background: color as `#${string}` }),
    ).toThrow(TypeError);
  },
);

test('supports alpha-last colors and custom fonts', () => {
  expect(
    createKeyboardTheme({ background: '#112233AA', fontFamily: 'Inter' }),
  ).toMatchObject({
    background: '#112233AA',
    fontFamily: 'Inter',
  });
});

test.each([0, -1, 11, 33, NaN, Infinity])(
  'rejects invalid font size %s',
  (fontSize) => {
    expect(() => createKeyboardTheme({ fontSize })).toThrow(RangeError);
  },
);

test.each([-1, 25, NaN, Infinity])(
  'rejects invalid radius %s',
  (keyCornerRadius) => {
    expect(() => createKeyboardTheme({ keyCornerRadius })).toThrow(RangeError);
  },
);

test('supports square keys and rejects blank fonts', () => {
  expect(createKeyboardTheme({ keyCornerRadius: 0 }).keyCornerRadius).toBe(0);
  expect(() => createKeyboardTheme({ fontFamily: ' ' })).toThrow(TypeError);
});

test.each([-1, 7, 13, NaN, Infinity])(
  'rejects invalid raised depth %s',
  (depth) => {
    expect(() =>
      createKeyboardTheme({
        keyboard: { material: { type: 'raised', depth } },
      }),
    ).toThrow(RangeError);
  },
);

test('rejects unknown native material and font weight', () => {
  expect(() =>
    createKeyboardTheme({
      keyboard: { material: { type: 'unknown' } as never },
    }),
  ).toThrow(TypeError);
  expect(() => createKeyboardTheme({ fontWeight: 'heavy' as never })).toThrow(
    TypeError,
  );
});

test('raised-only settings are nested and legacy loose settings are rejected', () => {
  expect(
    createKeyboardTheme({
      keyboard: {
        material: { type: 'raised', depth: 3, shadowColor: '#123456' },
      },
    }).material,
  ).toEqual({ type: 'raised', depth: 3, shadowColor: '#123456' });
  for (const legacy of ['material', 'keyDepth', 'keyShadow', 'keyHighlight'])
    expect(() => createKeyboardTheme({ [legacy]: 1 } as never)).toThrow(
      /belongs in keyboard\.material/,
    );
});

test.each(['phone', 'tablet', 'portrait', 'landscape', 'ios', 'android'])(
  'rejects device-scoped %s themes so one theme works everywhere',
  (scope) => {
    expect(() =>
      createKeyboardTheme({ [scope]: { fontSize: 24 } } as never),
    ).toThrow(/pass one keyboardTheme/);
  },
);

test('removed material fields exist only as native compatibility data', () => {
  const theme = createKeyboardTheme({
    keyboard: {
      material: { type: 'raised', depth: 3, shadowColor: '#123456' },
    },
  });
  expect(theme).not.toHaveProperty('keyDepth');
  expect(theme).not.toHaveProperty('keyShadow');
  expect(theme).not.toHaveProperty('keyHighlight');
  const native = JSON.parse(serializeKeyboardTheme(theme));
  expect(native).toMatchObject({
    material: 'raised',
    keyDepth: 3,
    keyShadow: '#123456',
    keyHighlight: '#00000000',
  });
});

test('all supported boundary combinations preserve fixed geometry tokens', () => {
  for (const fontFamily of [
    null,
    'system-rounded',
    'system-serif',
    'system-monospace',
    'An Unavailable Font',
  ]) {
    for (const material of ['flat', 'raised'] as const) {
      for (const fontSize of [12, 22, 32]) {
        for (const keyCornerRadius of [0, 24]) {
          for (const depth of [0, 6]) {
            const theme = createKeyboardTheme({
              fontFamily,
              fontSize,
              keyCornerRadius,
              keyboard: {
                material:
                  material === 'raised'
                    ? { type: 'raised', depth, shadowColor: '#123456' }
                    : { type: 'flat' },
              },
            });
            expect(theme).toMatchObject({
              fontFamily,
              fontSize,
              keyCornerRadius,
            });
            expect(theme.material).toEqual(
              material === 'raised'
                ? { type: 'raised', depth, shadowColor: '#123456' }
                : { type: 'flat' },
            );
            expect(Object.isFrozen(theme)).toBe(true);
          }
        }
      }
    }
  }
});

test.each(
  Object.keys(keyboardThemeLimits).filter(
    (key) => key !== 'materialDepth',
  ) as (keyof typeof keyboardThemeLimits)[],
)('rejects out-of-range %s before the native boundary', (key) => {
  const { min, max } = keyboardThemeLimits[key];
  for (const value of [min - 0.01, max + 0.01, 1e100, -Infinity])
    expect(() => createKeyboardTheme({ [key]: value })).toThrow(RangeError);
});

test('normalizes font names and rejects unbounded values', () => {
  expect(createKeyboardTheme({ fontFamily: ' Inter ' }).fontFamily).toBe(
    'Inter',
  );
  expect(() => createKeyboardTheme({ fontFamily: 'a'.repeat(129) })).toThrow(
    TypeError,
  );
});

test('medium font weight survives native theme serialization', () => {
  const theme = createKeyboardTheme({ fontWeight: 'medium' });
  expect(JSON.parse(JSON.stringify(theme)).fontWeight).toBe('medium');
});

test('selection colors are independent of press colors and preserve alpha', () => {
  const theme = createKeyboardTheme(
    { selectedKeyBackground: '#A35CEA99', selectedKeyForeground: '#102D46' },
    transparentKeyboardTheme,
  );
  expect(theme.selectedKeyBackground).toBe('#A35CEA99');
  expect(theme.selectedKeyForeground).toBe('#102D46');
  expect(theme.pressedKeyBackground).toBe(
    transparentKeyboardTheme.pressedKeyBackground,
  );
  expect(theme.material).toEqual({ type: 'flat' });
  expect(() => createKeyboardTheme({ selectedKeyBackground: '#FFF' })).toThrow(
    TypeError,
  );
  expect(() =>
    createKeyboardTheme({ selectedKeyForeground: '#badcolor' }),
  ).toThrow(TypeError);
});
