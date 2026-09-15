import type { KeyflowKeyboardFrame } from './keyboardGeometry';

// Avoiding views follow the active input, including handoffs between hook instances.
let activeInput: string | null = null;
let frame: KeyflowKeyboardFrame | null = null;
const listeners = new Set<() => void>();

export const getKeyflowFrame = () => frame;
export function claimKeyflowFrame(id: string) {
  // Preserve the occupied frame until the newly focused editor reports its own.
  activeInput = id;
}
export function subscribeToKeyflowFrame(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishKeyflowFrame(id: string, next: KeyflowKeyboardFrame) {
  // Ignore late animation/hide events from a previously focused editor.
  if (activeInput !== null && activeInput !== id) return;
  if (activeInput === null && !next.visible) return;
  activeInput = id;
  frame = next.visible ? next : null;
  listeners.forEach((listener) => listener());
}

export function clearKeyflowFrame(id: string) {
  if (activeInput !== id) return;
  activeInput = null;
  frame = null;
  listeners.forEach((listener) => listener());
}
