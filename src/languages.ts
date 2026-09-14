/** English and French are the supported custom keyboard languages. */
export type KeyflowLanguage = {
  language: 'en' | 'fr';
  /** Explicit software layout; this is not read from the system keyboard. */
  layout?: 'qwerty' | 'azerty';
};

export function serializeKeyboardLanguages(
  languages?: readonly KeyflowLanguage[],
): string {
  if (languages === undefined) return '';
  if (!Array.isArray(languages) || languages.length === 0)
    throw new Error(
      'Keyflow: keyboardLanguages must contain English or French. Omit it to follow device preferences.',
    );
  const seen = new Set<string>();
  return JSON.stringify(
    languages.map((item) => {
      if (!item || !['en', 'fr'].includes(item.language))
        throw new Error(
          'Keyflow: only English (en) and French (fr) are supported.',
        );
      if (seen.has(item.language))
        throw new Error('Keyflow: each keyboard language must appear once.');
      seen.add(item.language);
      const layout =
        item.layout ?? (item.language === 'fr' ? 'azerty' : 'qwerty');
      if (!['qwerty', 'azerty'].includes(layout))
        throw new Error('Keyflow: layout must be qwerty or azerty.');
      return { language: item.language, layout };
    }),
  );
}
