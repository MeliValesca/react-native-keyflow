import { createElement, createRef, useState } from 'react';
import type { ReactElement, RefObject } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { useKeyflow } from '../useKeyflow';
import type { TextInput } from 'react-native';

jest.mock('expo', () => jest.requireActual('./KeyflowNativeMock'));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', constants: { interfaceIdiom: 'phone' } },
  useColorScheme: () => 'light',
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
  inputRef,
  mounted = true,
  replacement = false,
  onFrame,
}: {
  inputRef: RefObject<TextInput | null>;
  mounted?: boolean;
  replacement?: boolean;
  onFrame?: jest.Mock;
}) {
  const [value, setValue] = useState('App owns this');
  const bindings = useKeyflow(inputRef, {
    keyboardMode: 'custom',
    keyflowTheme: { keyboard: { background: '#123456' } },
    hapticsEnabled: true,
    onKeyboardFrameChange: onFrame,
  });
  if (!mounted) return null;
  return createElement('AppInput', {
    ...bindings,
    ref: inputRef,
    key: replacement ? 'replacement' : 'initial',
    testID: replacement ? 'replacement' : 'initial',
    value,
    onChangeText: setValue,
    style: { color: 'purple', fontSize: 27 },
  });
}

const createNodeMock = (element: ReactElement) => ({
  tag:
    (element.props as { testID?: string }).testID === 'replacement' ? 22 : 11,
});

test('attaches an app-owned input while preserving its value and style', async () => {
  const inputRef = createRef<TextInput>();
  const onFrame = jest.fn();
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(HookInput, { inputRef, onFrame }), {
      createNodeMock,
    });
  });
  const input = renderer.root.findByProps({ testID: 'initial' });
  expect(input.props.value).toBe('App owns this');
  expect(input.props.style).toEqual({ color: 'purple', fontSize: 27 });
  expect(input.props.showSoftInputOnFocus).toBe(false);
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
  await act(async () => {
    mockListeners.get('onKeyflowFrameChange')?.({
      id,
      screenY: 500,
      height: 300,
      visible: true,
      source: 'custom',
    });
  });
  expect(onFrame).toHaveBeenCalledWith(
    expect.objectContaining({ height: 300 }),
  );
  await act(async () => renderer.unmount());
  expect(mockNative.destroy).toHaveBeenCalledWith(id);
});

test('supports delayed and replacement inputs through their focus binding', async () => {
  const inputRef = createRef<TextInput>();
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(HookInput, { inputRef, mounted: false }), {
      createNodeMock,
    });
  });
  expect(mockNative.configure).toHaveBeenCalled();
  expect(mockNative.attachInput).not.toHaveBeenCalled();
  await act(async () => {
    renderer.update(createElement(HookInput, { inputRef, replacement: true }));
  });
  const replacement = renderer.root.findByProps({ testID: 'replacement' });
  await act(async () => replacement.props.onFocus());
  expect(mockNative.attachInput).toHaveBeenLastCalledWith(
    expect.any(String),
    22,
  );
  await act(async () => replacement.props.onSelectionChange());
  expect(mockNative.updateInputContext).toHaveBeenCalledWith(
    expect.any(String),
  );
  await act(async () => renderer.unmount());
});
