/** Optional diagnostics for integration tests; not part of the consumer component API. */
import type { RefObject } from 'react';
import type { TextInput } from 'react-native';
import type { KeyflowKeyboardType } from './useKeyflow';
export type KeyflowKeyboardMetrics = {
  /** Read-only screen-space touch targets for device regression tests. */
  keyFrames?: {
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  keyboardType?: KeyflowKeyboardType;
  landscape?: boolean;

  keyboardMode?: 'custom' | 'system';
  keyboardPage?: string;
  keyboardLanguage?: string;
  keyboardLayout?: 'qwerty' | 'azerty';
  availableKeyboardLanguages?: string[];
  focused?: boolean;
  popupVisible?: boolean;
  text?: string;
  selectionStart?: number;
  selectionEnd?: number;
  /** Opaque iOS view identities for rotation continuity diagnostics; not persistent IDs. */
  keyIdentities?: string[];
  /** iOS input-host reload count for rotation/transition diagnostics. */
  inputReloadCount?: number;
  /** Last opened iOS accent row, retained after release for device regression tests. */
  lastAccentChoices?: string[];
  lastAccentViolations?: string[];
  /** Screen coordinates for independent device regression checks. */
  screenY?: number;
  editorBottom?: number;
  systemKeyboardVisible?: boolean;
  width: number;
  height: number;
  keyCount: number;
  violations: string[];
  fonts: string[];
  /** Resolved iOS telephone alphabet-label fonts for device diagnostics. */
  padFonts?: string[];
  /** Resolved fonts for keyboard text controls. */
  textFonts?: Record<string, string>;
};

const readers = new WeakMap<
  RefObject<TextInput | null>,
  () => Promise<KeyflowKeyboardMetrics>
>();
/** @internal Register a mounted component's diagnostic reader. */
export function registerDiagnostics(
  ref: RefObject<TextInput | null>,
  read: () => Promise<KeyflowKeyboardMetrics>,
): RefObject<TextInput | null> {
  readers.set(ref, read);
  return ref;
}
/** Focus the input before inspecting its native geometry. */
export function getKeyboardMetrics(
  ref: RefObject<TextInput | null> | null,
): Promise<KeyflowKeyboardMetrics> {
  const read = ref && readers.get(ref);
  if (!read) return Promise.reject(new Error('Keyflow input is not mounted'));
  return read();
}
