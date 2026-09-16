import { createElement, StrictMode, useState } from 'react';
import type { ReactElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { useKeyflow } from '../useKeyflow';
import { KeyflowAvoidingView } from '../KeyflowAvoidingView';
import type { KeyflowKeyboardFrame } from '../keyboardGeometry';
import {
  clearKeyflowFrame,
  claimKeyflowFrame,
  getKeyflowFrame,
  publishKeyflowFrame,
} from '../keyflowFrameStore';

jest.mock('expo', () => jest.requireActual('./KeyflowNativeMock'));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', constants: { interfaceIdiom: 'phone' } },
  useColorScheme: () => 'light',
  useWindowDimensions: () => ({ height: 800 }),
  View: (props: Record<string, unknown>) =>
    jest.requireActual('react').createElement('div', props),
  Keyboard: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    scheduleLayoutAnimation: jest.fn(),
  },
  findNodeHandle: (input: { tag: number }) => input.tag,
  BackHandler: { addEventListener: jest.fn() },
}));

const { mockNative, mockListeners } = jest.requireMock('expo') as {
  mockNative: {
    attachInput: jest.Mock;
    configure: jest.Mock;
    updateInputContext: jest.Mock;
    getKeyboardMetrics: jest.Mock;
    destroy: jest.Mock;
    addListener: jest.Mock;
  };
  mockListeners: Map<string, (event: Record<string, unknown>) => void>;
};

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
});

function HookInput({
  mounted = true,
  enabled = true,
  replacement = false,
  keyboardMode = 'custom',
  onFrame,
  frameOverride,
}: {
  mounted?: boolean;
  enabled?: boolean;
  replacement?: boolean;
  keyboardMode?: 'custom' | 'system';
  onFrame?: jest.Mock;
  frameOverride?: KeyflowKeyboardFrame | null;
}) {
  const [value, setValue] = useState('App owns this');
  const { keyflowInputProps, inputRef, focus, blur } = useKeyflow({
    enabled,
    keyboardMode,
    keyflowTheme: { keyboard: { background: '#123456' } },
    hapticsEnabled: true,
    onKeyboardFrameChange: onFrame,
  });
  return createElement(
    'AppControls',
    { inputRef, focus, blur, testID: 'controls' },
    createElement(
      KeyflowAvoidingView,
      { style: { flex: 1 }, testID: 'surface', keyboardFrame: frameOverride },
      !mounted
        ? null
        : createElement('AppInput', {
            ...keyflowInputProps,
            key: replacement ? 'replacement' : 'initial',
            testID: replacement ? 'replacement' : 'initial',
            value,
            onChangeText: setValue,
            style: { color: 'purple', fontSize: 27 },
          }),
    ),
  );
}

const createNodeMock = (element: ReactElement) => ({
  focus: jest.fn(),
  blur: jest.fn(),
  tag:
    (element.props as { testID?: string }).testID === 'replacement' ? 22 : 11,
});

test('owns the ref and automatically avoids the active keyboard without consumer frame props', async () => {
  const onFrame = jest.fn();
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(HookInput, { onFrame }), {
      createNodeMock,
    });
  });
  const input = renderer.root.findByProps({ testID: 'initial' });
  expect(input.props.value).toBe('App owns this');
  expect(input.props.style).toEqual({ color: 'purple', fontSize: 27 });
  expect(input.props.showSoftInputOnFocus).toBe(true);
  expect(mockNative.configure).toHaveBeenCalledWith(
    expect.stringMatching(/^keyflow-/),
    'custom',
    'default',
    'light',
    expect.any(String),
    '',
    true,
    true,
  );
  expect(mockNative.attachInput).toHaveBeenCalledWith(expect.any(String), 11);
  const id = mockNative.attachInput.mock.calls[0]![0];
  const controls = renderer.root.findByProps({ testID: 'controls' }).props;
  const surface = () =>
    renderer.root.find(
      (node) => node.type === 'div' && node.props.testID === 'surface',
    );
  await act(async () =>
    surface().props.onLayout({
      nativeEvent: { layout: { y: 0, height: 800 } },
    }),
  );
  await act(async () => controls.focus());
  controls.blur();
  expect(controls.inputRef.current.focus).toHaveBeenCalledTimes(1);
  expect(controls.inputRef.current.blur).toHaveBeenCalledTimes(1);
  await act(async () => {
    mockListeners.get('onKeyflowFrameChange')?.({
      id: 'other-input',
      screenY: 500,
      height: 300,
      visible: true,
      source: 'custom',
    });
  });
  expect(surface().props.style).toEqual([{ flex: 1 }, { paddingBottom: 0 }]);
  const frame = {
    screenY: 500,
    height: 300,
    visible: true,
    source: 'custom' as const,
  };
  await act(async () => {
    mockListeners.get('onKeyflowFrameChange')?.({ id, ...frame });
  });
  expect(surface().props.style).toEqual([{ flex: 1 }, { paddingBottom: 300 }]);
  expect(onFrame).toHaveBeenCalledWith(
    expect.objectContaining({ height: 300 }),
  );
  await act(async () =>
    renderer.update(
      createElement(HookInput, {
        onFrame,
        frameOverride: { ...frame, screenY: 650, height: 150 },
      }),
    ),
  );
  expect(surface().props.style).toEqual([{ flex: 1 }, { paddingBottom: 150 }]);
  await act(async () => renderer.update(createElement(HookInput, { onFrame })));
  expect(surface().props.style).toEqual([{ flex: 1 }, { paddingBottom: 300 }]);
  const updated = renderer.root.findByProps({ testID: 'controls' }).props;
  expect(updated.inputRef).toBe(controls.inputRef);
  expect(updated.focus).toBe(controls.focus);
  expect(updated.blur).toBe(controls.blur);
  await act(async () => {
    claimKeyflowFrame('next-editor');
    publishKeyflowFrame('next-editor', { ...frame, screenY: 600, height: 200 });
  });
  await act(async () => {
    mockListeners.get('onKeyflowFrameChange')?.({ id, ...frame });
  });
  await act(async () => {
    mockListeners.get('onKeyflowFrameChange')?.({
      id,
      ...frame,
      height: 0,
      visible: false,
    });
  });
  expect(surface().props.style).toEqual([{ flex: 1 }, { paddingBottom: 200 }]);
  await act(async () => clearKeyflowFrame('next-editor'));
  expect(surface().props.style).toEqual([{ flex: 1 }, { paddingBottom: 0 }]);
  await act(async () => {
    mockListeners.get('onKeyflowFrameChange')?.({ id, ...frame });
  });
  await act(async () => renderer.unmount());
  expect(mockNative.destroy).toHaveBeenCalledWith(id);
  expect(getKeyflowFrame()).toBeNull();
  expect(() => {
    controls.focus();
    controls.blur();
  }).not.toThrow();
});

test.each(['ios', 'android'])(
  '%s preserves native input presentation across custom, system, and disabled modes',
  async (os) => {
    const platform = jest.requireMock('react-native').Platform as {
      OS: string;
    };
    const previousOS = platform.OS;
    platform.OS = os;
    let renderer: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        renderer = create(createElement(HookInput), { createNodeMock });
      });
      const presentation = () =>
        renderer!.root.findByProps({ testID: 'initial' }).props
          .showSoftInputOnFocus;
      expect(presentation()).toBe(os === 'ios');
      await act(async () =>
        renderer!.update(createElement(HookInput, { keyboardMode: 'system' })),
      );
      expect(presentation()).toBe(true);
      await act(async () =>
        renderer!.update(createElement(HookInput, { enabled: false })),
      );
      expect(presentation()).toBe(true);
      await act(async () => renderer!.update(createElement(HookInput)));
      expect(presentation()).toBe(os === 'ios');
    } finally {
      if (renderer) await act(async () => renderer!.unmount());
      platform.OS = previousOS;
    }
  },
);

test('focus controls and bindings target delayed and replacement inputs', async () => {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(HookInput, { mounted: false }), {
      createNodeMock,
    });
  });
  const controls = renderer.root.findByProps({ testID: 'controls' }).props;
  expect(() => {
    controls.focus();
    controls.blur();
  }).not.toThrow();
  expect(mockNative.configure).toHaveBeenCalled();
  expect(mockNative.attachInput).not.toHaveBeenCalled();
  await act(async () =>
    renderer.update(createElement(HookInput, { replacement: true })),
  );
  const replacement = renderer.root.findByProps({ testID: 'replacement' });
  await act(async () => replacement.props.onFocus());
  expect(mockNative.attachInput).toHaveBeenLastCalledWith(
    expect.any(String),
    22,
  );
  await act(async () => controls.focus());
  controls.blur();
  expect(controls.inputRef.current.tag).toBe(22);
  expect(controls.inputRef.current.focus).toHaveBeenCalledTimes(1);
  expect(controls.inputRef.current.blur).toHaveBeenCalledTimes(1);
  await act(async () => replacement.props.onSelectionChange());
  expect(mockNative.updateInputContext).toHaveBeenCalledWith(
    expect.any(String),
  );
  await act(async () => renderer.unmount());
});

test.each([
  ['configuration', false],
  ['configuration', true],
  ['attachment', false],
  ['attachment', true],
] as const)(
  'waits for native %s before focusing and supports cancellation=%s',
  async (phase, cancel) => {
    let complete!: () => void;
    if (phase === 'configuration') {
      mockNative.configure.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            complete = resolve;
          }),
      );
    }
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(createElement(HookInput), { createNodeMock });
    });
    if (phase === 'attachment') {
      mockNative.attachInput.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            complete = resolve;
          }),
      );
    }
    const controls = renderer.root.findByProps({ testID: 'controls' }).props;
    await act(async () => controls.focus());
    expect(controls.inputRef.current.focus).not.toHaveBeenCalled();
    if (cancel) controls.blur();
    await act(async () => complete());
    expect(controls.inputRef.current.focus).toHaveBeenCalledTimes(
      cancel ? 0 : 1,
    );
    await act(async () => renderer.unmount());
  },
);

test('waits for the native mount without turning a temporary missing tag into a render error', async () => {
  const frames: Array<(timestamp: number) => void> = [];
  const previous = globalThis.requestAnimationFrame;
  Object.assign(globalThis, {
    requestAnimationFrame: (callback: (timestamp: number) => void) => {
      frames.push(callback);
      return frames.length;
    },
  });
  mockNative.attachInput
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => {
      renderer = create(createElement(HookInput), { createNodeMock });
    });
    expect(mockNative.attachInput).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(1);
    await act(async () => frames.shift()!(16));
    expect(mockNative.attachInput).toHaveBeenCalledTimes(2);
    expect(renderer.root.findByProps({ testID: 'initial' }).props.value).toBe(
      'App owns this',
    );
  } finally {
    await act(async () => renderer.unmount());
    Object.assign(globalThis, { requestAnimationFrame: previous });
  }
});

test('does not retry a pending native mount after its input unmounts', async () => {
  const frames: Array<(timestamp: number) => void> = [];
  const previous = globalThis.requestAnimationFrame;
  Object.assign(globalThis, {
    requestAnimationFrame: (callback: (timestamp: number) => void) => {
      frames.push(callback);
      return frames.length;
    },
  });
  mockNative.attachInput.mockResolvedValueOnce(false);
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => {
      renderer = create(createElement(HookInput), { createNodeMock });
    });
    expect(frames).toHaveLength(1);
    await act(async () => renderer.unmount());
    await act(async () => frames.shift()!(16));
    expect(mockNative.attachInput).toHaveBeenCalledTimes(1);
  } finally {
    Object.assign(globalThis, { requestAnimationFrame: previous });
  }
});

test('does not attach after configuration completes for an unmounted hook', async () => {
  let complete!: () => void;
  mockNative.configure.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      complete = resolve;
    }),
  );
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(HookInput), { createNodeMock });
  });
  await act(async () => renderer.unmount());
  await act(async () => complete());
  expect(mockNative.attachInput).not.toHaveBeenCalled();
});

test('does not recreate a native controller when attachment is disabled during a pending mount', async () => {
  const frames: Array<(timestamp: number) => void> = [];
  const previous = globalThis.requestAnimationFrame;
  Object.assign(globalThis, {
    requestAnimationFrame: (callback: (timestamp: number) => void) => {
      frames.push(callback);
      return frames.length;
    },
  });
  mockNative.attachInput.mockResolvedValueOnce(false);
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => {
      renderer = create(createElement(HookInput), { createNodeMock });
    });
    expect(frames).toHaveLength(1);
    await act(async () =>
      renderer.update(createElement(HookInput, { enabled: false })),
    );
    expect(mockNative.destroy).toHaveBeenCalledTimes(1);
    await act(async () => frames.shift()!(16));
    expect(mockNative.attachInput).toHaveBeenCalledTimes(1);
    expect(
      renderer.root.findByProps({ testID: 'initial' }).props
        .showSoftInputOnFocus,
    ).toBe(true);
  } finally {
    await act(async () => renderer.unmount());
    Object.assign(globalThis, { requestAnimationFrame: previous });
  }
});

test('keeps the native controller configured and focusable after a StrictMode effect remount', async () => {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      createElement(StrictMode, null, createElement(HookInput)),
      { createNodeMock },
    );
  });
  expect(mockNative.destroy).toHaveBeenCalled();
  expect(mockNative.configure.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
    mockNative.destroy.mock.invocationCallOrder.at(-1)!,
  );
  const before = mockNative.attachInput.mock.calls.length;
  await act(async () =>
    renderer.root.findByProps({ testID: 'initial' }).props.onFocus(),
  );
  expect(mockNative.attachInput).toHaveBeenCalledTimes(before + 1);
  await act(async () => renderer.unmount());
});
