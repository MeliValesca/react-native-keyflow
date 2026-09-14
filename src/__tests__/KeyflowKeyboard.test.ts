import { createElement, createRef } from 'react';
import type { ReactElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { KeyflowKeyboard } from '../KeyflowKeyboard';
import { KeyflowAvoidingView } from '../KeyflowAvoidingView';
import type { KeyboardEvent } from 'react-native';

const mockKeyboardListeners = new Map<string, (event: KeyboardEvent) => void>();
import type {
  KeyflowInputBindings,
  KeyflowKeyboardRef,
} from '../KeyflowKeyboard';

jest.mock('expo', () => ({ requireNativeView: () => 'NativeKeyboard' }));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', constants: { interfaceIdiom: 'phone' } },
  View: 'View',
  useWindowDimensions: () => ({ width: 400, height: 800 }),
  Keyboard: {
    addListener: (name: string, listener: (event: KeyboardEvent) => void) => {
      mockKeyboardListeners.set(name, listener);
      return { remove: () => mockKeyboardListeners.delete(name) };
    },
    scheduleLayoutAnimation: jest.fn(),
  },
  useColorScheme: () => 'light',
  findNodeHandle: (input: { tag: number }) => input.tag,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function harness() {
  const native = {
    attachInput: jest.fn().mockResolvedValue(undefined),
    focus: jest.fn().mockResolvedValue(undefined),
    blur: jest.fn().mockResolvedValue(undefined),
    updateInputContext: jest.fn().mockResolvedValue(undefined),
    setKeyboardMode: jest.fn().mockResolvedValue(undefined),
    getNativeRef: () => ({
      measure: (callback: (...values: number[]) => void) =>
        callback(0, 0, 1, 1),
    }),
  };
  return {
    native,
    createNodeMock: (element: ReactElement) =>
      element.type === 'NativeKeyboard'
        ? native
        : {
            tag:
              (element.props as { testID?: string }).testID === 'replacement'
                ? 22
                : 11,
          },
  };
}

test('preserves app input props and callbacks while following resized keyboard frames', async () => {
  const { createNodeMock, native } = harness();
  const style = { color: 'purple', fontSize: 27, borderRadius: 0 };
  const onChangeText = jest.fn();
  const onSubmitEditing = jest.fn();
  const renderInput = (bindings: KeyflowInputBindings) =>
    createElement('AppInput', {
      ...bindings,
      style,
      value: 'App owns this',
      onChangeText,
      onSubmitEditing,
      placeholderTextColor: 'orange',
      accessibilityLabel: 'Message',
    });
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      createElement(
        KeyflowAvoidingView,
        { testID: 'avoidance' },
        createElement(KeyflowKeyboard, { renderInput }),
      ),
      { createNodeMock },
    );
  });
  expect(native.attachInput).not.toHaveBeenCalled();
  await act(async () => {
    renderer.root.findByProps({ pointerEvents: 'none' }).props.onLayout();
    await jest.advanceTimersByTimeAsync(100);
  });
  const input = renderer.root.findByProps({ accessibilityLabel: 'Message' });
  expect(input.props.style).toBe(style);
  expect(input.props.value).toBe('App owns this');
  expect(input.props.placeholderTextColor).toBe('orange');
  expect(input.props.accessibilityLabel).toBe('Message');
  input.props.onChangeText('Updated');
  const submit = { nativeEvent: { text: 'Updated' } };
  input.props.onSubmitEditing(submit);
  expect(onChangeText).toHaveBeenCalledWith('Updated');
  expect(onSubmitEditing).toHaveBeenCalledWith(submit);
  expect(native.attachInput).toHaveBeenCalledWith(11);
  const avoidance = () =>
    renderer.root.findAllByProps({ testID: 'avoidance' }).at(-1)!;
  await act(async () => {
    avoidance().props.onLayout({
      nativeEvent: { layout: { y: 0, height: 800 } },
    });
    mockKeyboardListeners.get('keyboardWillShow')?.({
      endCoordinates: { screenY: 800, height: 0 },
      duration: 0,
    } as KeyboardEvent);
  });
  // Autofocus can show an empty surface before attachment resizes the keyboard.
  await act(async () => {
    mockKeyboardListeners.get('keyboardWillChangeFrame')?.({
      endCoordinates: { screenY: 500, height: 300 },
      duration: 0,
    } as KeyboardEvent);
  });
  expect(avoidance().props.style.at(-1)).toEqual({ paddingBottom: 300 });
  await act(async () => {
    renderer.update(
      createElement(
        KeyflowAvoidingView,
        {
          testID: 'avoidance',
          keyboardFrame: {
            screenY: 450,
            height: 350,
            visible: true,
            source: 'custom',
          },
        },
        createElement(KeyflowKeyboard, { renderInput }),
      ),
    );
  });
  // The actual native custom frame wins if UIKit's notification is stale.
  expect(avoidance().props.style.at(-1)).toEqual({ paddingBottom: 350 });
  expect(input.props.style).toBe(style);
  await act(async () => renderer.unmount());
});

test('attaches a replacement input before focus and routes selection updates to its keyboard', async () => {
  const { createNodeMock, native } = harness();
  const ref = createRef<KeyflowKeyboardRef>();
  const render = (key: string) =>
    createElement(KeyflowKeyboard, {
      ref,
      renderInput: (bindings) =>
        createElement('AppInput', { ...bindings, key, testID: key }),
    });
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(render('initial'), { createNodeMock });
  });
  await act(async () => {
    renderer.root.findByProps({ pointerEvents: 'none' }).props.onLayout();
    await jest.advanceTimersByTimeAsync(100);
  });
  await act(async () => renderer.update(render('replacement')));
  expect(native.attachInput).toHaveBeenLastCalledWith(22);
  await act(async () => {
    await ref.current?.focus();
  });
  expect(native.attachInput).toHaveBeenLastCalledWith(22);
  expect(native.attachInput.mock.invocationCallOrder.at(-1)).toBeLessThan(
    native.focus.mock.invocationCallOrder[0]!,
  );
  await act(async () =>
    renderer.root
      .findByProps({ testID: 'replacement' })
      .props.onSelectionChange(),
  );
  expect(native.updateInputContext).toHaveBeenCalledTimes(1);
  await act(async () => renderer.unmount());
});
