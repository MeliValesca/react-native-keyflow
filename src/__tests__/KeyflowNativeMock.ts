export const mockListeners = new Map<
  string,
  (event: Record<string, unknown>) => void
>();
export const mockNative = {
  attachInput: jest.fn().mockResolvedValue(undefined),
  configure: jest.fn().mockResolvedValue(undefined),
  updateInputContext: jest.fn().mockResolvedValue(undefined),
  getKeyboardMetrics: jest.fn().mockResolvedValue({ violations: [] }),
  destroy: jest.fn().mockResolvedValue(undefined),
  addListener: jest.fn(
    (name: string, listener: (event: Record<string, unknown>) => void) => {
      mockListeners.set(name, listener);
      return { remove: () => mockListeners.delete(name) };
    },
  ),
};
export const requireNativeModule = () => mockNative;
