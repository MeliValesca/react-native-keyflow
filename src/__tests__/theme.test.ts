import { serializeKeyflowTheme } from '../serializeTheme';
import {
  createKeyflowTheme,
  darkKeyflowTheme,
  keyflowThemeLimits,
  transparentKeyflowTheme,
} from '../theme';

test('serializes custom return key text or a portable icon', () => {
  const theme = createKeyflowTheme();
  expect(
    JSON.parse(serializeKeyflowTheme(theme, { text: 'Send' })).returnKeyContent,
  ).toEqual({ text: 'Send' });
  expect(
    JSON.parse(serializeKeyflowTheme(theme, { icon: 'arrow-right' }))
      .returnKeyContent,
  ).toEqual({ icon: 'arrow-right' });
  expect(() => serializeKeyflowTheme(theme, { text: ' ' })).toThrow(TypeError);
  expect(() =>
    serializeKeyflowTheme(theme, { icon: 'upload' } as never),
  ).toThrow(TypeError);
});

test('translucent keys stay defined when customizing fonts', () => {
  const theme = createKeyflowTheme(
    { fontFamily: 'system-rounded', fontSize: 32 },
    transparentKeyflowTheme,
  );
  const original = JSON.parse(serializeKeyflowTheme(transparentKeyflowTheme));
  const rendered = JSON.parse(serializeKeyflowTheme(theme));
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
  const theme = createKeyflowTheme({ fontSize: 24 }, darkKeyflowTheme);
  expect(theme.fontSize).toBe(24);
  expect(theme.background).toBe(darkKeyflowTheme.background);
  expect(darkKeyflowTheme.fontSize).toBe(22);
  expect(Object.isFrozen(theme)).toBe(true);
});

test('undefined overrides retain defaults', () => {
  expect(createKeyflowTheme({ fontSize: undefined })).toEqual(
    createKeyflowTheme(),
  );
});

test.each(['#FFF', '#GGGGGG', '#123456789'])(
  'rejects malformed color %s',
  (color) => {
    expect(() =>
      createKeyflowTheme({ background: color as `#${string}` }),
    ).toThrow(TypeError);
  },
);

test('supports alpha-last colors and custom fonts', () => {
  expect(
    createKeyflowTheme({ background: '#112233AA', fontFamily: 'Inter' }),
  ).toMatchObject({
    background: '#112233AA',
    fontFamily: 'Inter',
  });
});

test.each([0, -1, 11, 33, NaN, Infinity])(
  'rejects invalid font size %s',
  (fontSize) => {
    expect(() => createKeyflowTheme({ fontSize })).toThrow(RangeError);
  },
);

test.each([-1, 25, NaN, Infinity])(
  'rejects invalid radius %s',
  (keyCornerRadius) => {
    expect(() => createKeyflowTheme({ keyCornerRadius })).toThrow(RangeError);
  },
);

test('supports square keys and rejects blank fonts', () => {
  expect(createKeyflowTheme({ keyCornerRadius: 0 }).keyCornerRadius).toBe(0);
  expect(() => createKeyflowTheme({ fontFamily: ' ' })).toThrow(TypeError);
});

test('resolves and serializes the outer keyboard radius and border', () => {
  const theme = createKeyflowTheme({
    keyboard: {
      cornerRadius: 32,
      borderColor: '#C77DFF',
      borderWidth: 2,
    },
  });
  expect(theme).toMatchObject({
    keyboardCornerRadius: 32,
    keyboardBorderColor: '#C77DFF',
    keyboardBorderWidth: 2,
  });
  expect(JSON.parse(serializeKeyflowTheme(theme))).toMatchObject({
    keyboardCornerRadius: 32,
    keyboardBorderColor: '#C77DFF',
    keyboardBorderWidth: 2,
  });
  expect(() => createKeyflowTheme({ keyboard: { cornerRadius: 49 } })).toThrow(
    RangeError,
  );
  expect(() => createKeyflowTheme({ keyboard: { borderWidth: 4 } })).toThrow(
    RangeError,
  );
  expect(() =>
    createKeyflowTheme({ keyboard: { borderColor: '#BAD' } }),
  ).toThrow(TypeError);
});

test.each([-1, 7, 13, NaN, Infinity])(
  'rejects invalid raised depth %s',
  (depth) => {
    expect(() =>
      createKeyflowTheme({
        keyboard: { material: { type: 'raised', depth } },
      }),
    ).toThrow(RangeError);
  },
);

test('rejects unknown native material and font weight', () => {
  expect(() =>
    createKeyflowTheme({
      keyboard: { material: { type: 'unknown' } as never },
    }),
  ).toThrow(TypeError);
  expect(() => createKeyflowTheme({ fontWeight: 'heavy' as never })).toThrow(
    TypeError,
  );
});

test('raised-only settings are nested and legacy loose settings are rejected', () => {
  expect(
    createKeyflowTheme({
      keyboard: {
        material: { type: 'raised', depth: 3, shadowColor: '#123456' },
      },
    }).material,
  ).toEqual({ type: 'raised', depth: 3, shadowColor: '#123456' });
  for (const legacy of ['material', 'keyDepth', 'keyShadow', 'keyHighlight'])
    expect(() => createKeyflowTheme({ [legacy]: 1 } as never)).toThrow(
      /belongs in keyboard\.material/,
    );
});

test.each(['phone', 'tablet', 'portrait', 'landscape', 'ios', 'android'])(
  'rejects device-scoped %s themes so one theme works everywhere',
  (scope) => {
    expect(() =>
      createKeyflowTheme({ [scope]: { fontSize: 24 } } as never),
    ).toThrow(/pass one keyflowTheme/);
  },
);

test('removed material fields exist only as native compatibility data', () => {
  const theme = createKeyflowTheme({
    keyboard: {
      material: { type: 'raised', depth: 3, shadowColor: '#123456' },
    },
  });
  expect(theme).not.toHaveProperty('keyDepth');
  expect(theme).not.toHaveProperty('keyShadow');
  expect(theme).not.toHaveProperty('keyHighlight');
  const native = JSON.parse(serializeKeyflowTheme(theme));
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
            const theme = createKeyflowTheme({
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
  Object.keys(keyflowThemeLimits).filter(
    (key) => key !== 'materialDepth',
  ) as (keyof typeof keyflowThemeLimits)[],
)('rejects out-of-range %s before the native boundary', (key) => {
  const { min, max } = keyflowThemeLimits[key];
  for (const value of [min - 0.01, max + 0.01, 1e100, -Infinity])
    expect(() => createKeyflowTheme({ [key]: value })).toThrow(RangeError);
});

test('normalizes font names and rejects unbounded values', () => {
  expect(createKeyflowTheme({ fontFamily: ' Inter ' }).fontFamily).toBe(
    'Inter',
  );
  expect(() => createKeyflowTheme({ fontFamily: 'a'.repeat(129) })).toThrow(
    TypeError,
  );
});

test('medium font weight survives native theme serialization', () => {
  const theme = createKeyflowTheme({ fontWeight: 'medium' });
  expect(JSON.parse(JSON.stringify(theme)).fontWeight).toBe('medium');
});

test('selection colors are independent of press colors and preserve alpha', () => {
  const theme = createKeyflowTheme(
    { selectedKeyBackground: '#A35CEA99', selectedKeyForeground: '#102D46' },
    transparentKeyflowTheme,
  );
  expect(theme.selectedKeyBackground).toBe('#A35CEA99');
  expect(theme.selectedKeyForeground).toBe('#102D46');
  expect(theme.pressedKeyBackground).toBe(
    transparentKeyflowTheme.pressedKeyBackground,
  );
  expect(theme.material).toEqual({ type: 'flat' });
  expect(() => createKeyflowTheme({ selectedKeyBackground: '#FFF' })).toThrow(
    TypeError,
  );
  expect(() =>
    createKeyflowTheme({ selectedKeyForeground: '#badcolor' }),
  ).toThrow(TypeError);
});
