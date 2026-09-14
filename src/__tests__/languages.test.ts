import { serializeKeyboardLanguages } from '../languages';
import type { KeyflowLanguage } from '../languages';

test('undefined follows device preferences, explicit order and layouts are preserved', () => {
  expect(serializeKeyboardLanguages()).toBe('');
  expect(
    JSON.parse(
      serializeKeyboardLanguages([
        { language: 'fr', layout: 'qwerty' },
        { language: 'en' },
      ]),
    ),
  ).toEqual([
    { language: 'fr', layout: 'qwerty' },
    { language: 'en', layout: 'qwerty' },
  ]);
  expect(JSON.parse(serializeKeyboardLanguages([{ language: 'fr' }]))).toEqual([
    { language: 'fr', layout: 'azerty' },
  ]);
});
test.each(
  [
    [],
    [{ language: 'ko' }],
    [{ language: 'en', layout: 'dvorak' }],
    [{ language: 'en' }, { language: 'en' }],
    [null],
  ].map((value) => [value]),
)(
  'rejects invalid configuration without creating a broken layout: %j',
  (value) => {
    expect(() =>
      serializeKeyboardLanguages(value as unknown as KeyflowLanguage[]),
    ).toThrow('Keyflow:');
  },
);
