import {
  getKeyboardMetrics,
  getSystemKeyboardFrame,
} from 'react-native-keyflow/testing';
import { launchTest, testPlatform, testMaterial } from '../testing/launch';
import { studioTheme } from '../themes/studio';
import {
  assertAnimatedOpening,
  assertKeyboardTransition,
} from '../testing/transitionChecks';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Dimensions,
  Keyboard,
  Platform,
  StatusBar,
  TextInput,
  View,
} from 'react-native';
import type { KeyflowKeyboardFrame } from 'react-native-keyflow';
import { useKeyflow } from 'react-native-keyflow';

type Engine = 'custom' | 'system' | 'baseline';
const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
export function useTransitionTests() {
  const [raised, setRaised] = useState(testMaterial === 'raised');
  const [engine, setEngine] = useState<Engine>('custom');
  const [frame, setFrame] = useState<KeyflowKeyboardFrame | null>(null);
  const latestFrame = useRef<KeyflowKeyboardFrame | null>(null);
  const presentations = useRef<{ duration: number; easing: string }[]>([]);
  const dismissals = useRef<{ duration: number; easing: string }[]>([]);
  const frames = useRef<KeyflowKeyboardFrame[]>([]);
  const baselineError = useRef<unknown>(null);
  const [status, setStatus] = useState(
    'Ready: checks show, hide, switching, and layout restoration.',
  );
  const [running, setRunning] = useState(false);
  const alive = useRef(true);
  const baseline = useRef<TextInput>(null);
  const composer = useRef<View>(null);
  const record = (next: KeyflowKeyboardFrame) => {
    latestFrame.current = next;
    frames.current.push(next);
    setFrame(next);
  };
  const { inputRef: input, keyflowInputProps: bindings } = useKeyflow({
    enabled: engine !== 'baseline',
    keyboardMode: engine === 'baseline' ? 'custom' : engine,
    keyflowTheme: raised ? studioTheme : undefined,
    onKeyboardFrameChange: record,
  });
  useEffect(() => {
    alive.current = true;
    const mountedInput = input.current;
    const mountedBaseline = baseline.current;
    return () => {
      alive.current = false;
      void mountedInput?.blur();
      mountedBaseline?.blur();
    };
  }, [input]);
  useEffect(() => {
    if (Platform.OS === 'android') {
      if (engine !== 'baseline') return;
      // RN can emit a negative height before the IME insets arrive and never
      // correct it. Observe the OS directly, without attaching Keyflow here.
      let cancelled = false;
      let pending = false;
      let previous = '';
      baselineError.current = null;
      const poll = async () => {
        if (pending || cancelled) return;
        pending = true;
        try {
          const next = await getSystemKeyboardFrame();
          if (cancelled) return;
          const signature = JSON.stringify(next);
          if (signature !== previous || !frames.current.length) {
            previous = signature;
            record(next);
          }
        } catch (error) {
          if (!cancelled) baselineError.current = error;
        } finally {
          pending = false;
        }
      };
      const interval = setInterval(() => void poll(), 50);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
    const willShow = Keyboard.addListener('keyboardWillShow', (event) => {
      presentations.current.push({
        duration: event.duration,
        easing: event.easing,
      });
    });
    const willHide = Keyboard.addListener('keyboardWillHide', (event) => {
      dismissals.current.push({
        duration: event.duration,
        easing: event.easing,
      });
    });
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      record({
        ...e.endCoordinates,
        windowOffsetY: 0,
        visible: true,
        source: 'system',
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', (e) =>
      record({
        ...e.endCoordinates,
        height: 0,
        visible: false,
        windowOffsetY: 0,
        source: 'system',
      }),
    );
    return () => {
      willShow.remove();
      willHide.remove();
      show.remove();
      hide.remove();
    };
  }, [engine]);
  const bottom = () =>
    new Promise<number>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Composer measurement timed out')),
        2000,
      );
      composer.current?.measureInWindow((_x, y, _w, height) => {
        clearTimeout(timer);
        resolve(
          y +
            height +
            (Platform.OS === 'android'
              ? latestFrame.current?.windowOffsetY ??
                StatusBar.currentHeight ??
                0
              : 0),
        );
      });
    });
  const wait = async (ms: number) => {
    await pause(ms);
    if (!alive.current) throw new Error('Test screen closed');
  };
  const currentFrame = (): KeyflowKeyboardFrame | null => latestFrame.current;
  const waitForKeyboard = async (target: Engine = 'custom') => {
    const deadline = Date.now() + 7000;
    let stableSince = Date.now();
    let previous = '';
    while (Date.now() < deadline) {
      if (target === 'baseline' && baselineError.current) {
        throw baselineError.current;
      }
      const value = currentFrame();
      const signature = `${value?.visible}:${value?.screenY}`;
      if (signature !== previous || !value?.visible || value.height <= 0)
        stableSince = Date.now();
      previous = signature;
      if (
        value?.visible &&
        value.height > 0 &&
        Date.now() - stableSince >= 500
      ) {
        // A reserved handoff frame is not proof that the real IME has appeared.
        if (
          Platform.OS !== 'android' ||
          target !== 'system' ||
          (await getKeyboardMetrics(input))?.systemKeyboardVisible
        )
          return;
      }
      await wait(50);
    }
    throw new Error(
      `${target}: keyboard did not become visible and settle: ${JSON.stringify({
        frames: frames.current,
        native:
          target === 'baseline' ? undefined : await getKeyboardMetrics(input),
      })}`,
    );
  };
  const run = async () => {
    if (running) return;
    setRunning(true);
    const results: object[] = [];
    const capture = Date.now();
    const markFrames = (target: Engine, event: 'start' | 'end') => {
      if (Platform.OS === 'android')
        console.info(
          `KEYFLOW_FRAME_PHASE ${JSON.stringify({ capture, target, event })}`,
        );
    };
    const expectedHeights = new Map<Engine, number>();
    let nativeTiming: { duration: number; easing: string } | undefined;
    let nativeHideTiming: { duration: number; easing: string } | undefined;
    try {
      const reducedMotion = await AccessibilityInfo.isReduceMotionEnabled();
      for (const target of ['baseline', 'custom', 'system'] as const) {
        baseline.current?.blur();
        await input.current?.blur();
        setEngine(target);
        setFrame(null);
        latestFrame.current = null;
        await wait(700);
        // Android can transfer focus to the newly mounted first editor.
        // Establish a genuinely hidden baseline before recording a transition.
        baseline.current?.blur();
        await input.current?.blur();
        await wait(900);
        const resting = await bottom();
        const assertTransition = (direction: 'show' | 'hide') =>
          assertKeyboardTransition(
            frames.current,
            direction,
            Platform.OS,
            target,
          );
        markFrames(target, 'start');
        for (let cycle = 0; cycle < 2; cycle++) {
          setStatus(`${target}: show/hide cycle ${cycle + 1}/2`);
          frames.current = [];
          presentations.current = [];
          dismissals.current = [];
          if (target === 'baseline') baseline.current?.focus();
          else await input.current?.focus();
          await waitForKeyboard(target);
          const visible = currentFrame();
          const shownBottom = await bottom();
          if (!visible?.visible || visible.height <= 0)
            throw new Error(
              `${target} cycle ${
                cycle + 1
              }: no visible keyboard frame (${JSON.stringify(
                frames.current,
              )} events)`,
            );
          expectedHeights.set(target, visible.height);
          let nativeEditorBottom: number | undefined;
          let nativeKeyboardTop: number | undefined;
          if (Platform.OS === 'android' && target === 'custom') {
            const native = await getKeyboardMetrics(input);
            // The occupied frame includes Android's taskbar/navigation inset,
            // which can change after the system IME hides. Preserve the actual
            // keyboard surface height, not that OS-owned inset.
            expectedHeights.set(target, native.height);
            nativeEditorBottom = native.editorBottom;
            nativeKeyboardTop =
              target === 'custom' ? native.screenY : undefined;
            if (
              native.editorBottom === undefined ||
              native.editorBottom > visible.screenY + 1
            )
              throw new Error(
                `Native editor overlaps keyboard: ${JSON.stringify({
                  native,
                  visible,
                })}`,
              );
            if (
              target === 'custom' &&
              (native.screenY === undefined ||
                Math.abs(native.screenY - visible.screenY) > 1)
            )
              throw new Error(
                `Reported frame differs from native keyboard: ${JSON.stringify({
                  native,
                  visible,
                })}`,
              );
          }
          const overlap = shownBottom - visible.screenY;
          if (target === 'custom' && overlap > 3)
            throw new Error(
              `${target}: editor overlaps keyboard by ${overlap.toFixed(
                1,
              )}pt: ${JSON.stringify({
                frame: visible,
                composerBottom: shownBottom,
                restingBottom: resting,
                window: Dimensions.get('window'),
                screen: Dimensions.get('screen'),
              })}`,
            );
          const distinctFrames = new Set(
            frames.current
              .filter((f) => f.visible)
              .map((f) => Math.round(f.screenY)),
          ).size;
          assertTransition('show');
          if (
            Platform.OS === 'android' &&
            target === 'custom' &&
            !reducedMotion
          )
            assertAnimatedOpening(frames.current);
          if (Platform.OS === 'ios' && target !== 'system') {
            if (presentations.current.length !== 1)
              throw new Error(
                `${target}: expected one presentation, received ${presentations.current.length}`,
              );
            const timing = presentations.current[0]!;
            if (target === 'baseline') nativeTiming = timing;
            else if (
              nativeTiming &&
              (timing.duration !== nativeTiming.duration ||
                timing.easing !== nativeTiming.easing)
            )
              throw new Error(
                `${target}: UIKit timing differs from native baseline`,
              );
          }
          frames.current = [];
          if (target === 'baseline') baseline.current?.blur();
          else await input.current?.blur();
          await wait(900);
          assertTransition('hide');
          if (Platform.OS === 'ios' && target !== 'system') {
            if (dismissals.current.length !== 1)
              throw new Error(
                `${target}: expected one dismissal, received ${dismissals.current.length}`,
              );
            const timing = dismissals.current[0]!;
            if (target === 'baseline') nativeHideTiming = timing;
            else if (
              nativeHideTiming &&
              (timing.duration !== nativeHideTiming.duration ||
                timing.easing !== nativeHideTiming.easing)
            )
              throw new Error(
                `${target}: dismissal timing differs from native baseline: ${JSON.stringify(
                  { native: nativeHideTiming, actual: timing },
                )}`,
              );
          }
          const restored = await bottom();
          if (target === 'custom' && Math.abs(restored - resting) > 3)
            throw new Error(
              `${target}: layout did not restore (${(
                restored - resting
              ).toFixed(1)}pt)`,
            );
          if (target === 'custom' && currentFrame()?.visible)
            throw new Error(`${target}: frame remains visible after blur`);
          results.push({
            target,
            cycle: cycle + 1,
            overlap,
            restorationError: restored - resting,
            distinctFrames,
            nativeEditorBottom,
            nativeKeyboardTop,
            presentation: presentations.current[0],
            dismissal: dismissals.current[0],
          });
        }
        markFrames(target, 'end');
      }
      // Same editor, no blur between modes: catch handoff/inset regressions.
      for (const target of ['custom', 'system', 'custom', 'system'] as const) {
        const wasVisible = currentFrame()?.visible;
        frames.current = [];
        setEngine(target);
        await wait(150);
        await input.current?.focus();
        await waitForKeyboard(target);
        const visible = currentFrame();
        const surfaceHeight =
          Platform.OS === 'android' && target === 'custom'
            ? (await getKeyboardMetrics(input)).height
            : visible?.height;
        if (
          target === 'custom' &&
          surfaceHeight !== undefined &&
          Math.abs(surfaceHeight - (expectedHeights.get(target) ?? 0)) > 1
        )
          throw new Error(
            `${target}: handoff changed keyboard height from ${expectedHeights.get(
              target,
            )} to ${surfaceHeight} (occupied height ${visible?.height})`,
          );
        if (
          Platform.OS === 'android' &&
          target === 'custom' &&
          wasVisible &&
          frames.current.some((f) => !f.visible)
        )
          throw new Error(
            `${target}: avoidance collapsed during mode handoff: ${JSON.stringify(
              frames.current,
            )}`,
          );
        const editorBottom = await bottom();
        if (
          target === 'custom' &&
          (!visible?.visible || editorBottom > visible.screenY + 3)
        )
          throw new Error(
            `${target}: switching obscures editor: ${JSON.stringify({
              visible,
              editorBottom,
              frames: frames.current,
              native: await getKeyboardMetrics(input),
            })}`,
          );
      }
      await input.current?.blur();
      await wait(900);
      // Exercise actual interruptions, rather than merely reporting one.
      setEngine('custom');
      await wait(700);
      await input.current?.blur();
      await wait(700);
      const resting = await bottom();
      for (const delay of [40, 120, 220]) {
        await input.current?.focus();
        await wait(delay);
        await input.current?.blur();
        await wait(900);
        let metrics = await getKeyboardMetrics(input);
        if (
          metrics.focused ||
          metrics.popupVisible ||
          currentFrame()?.visible ||
          Math.abs((await bottom()) - resting) > 3
        )
          throw new Error(
            `Interrupted opening (${delay}ms) failed to dismiss: ${JSON.stringify(
              metrics,
            )}`,
          );
        await input.current?.focus();
        await waitForKeyboard('custom');
        await input.current?.blur();
        await wait(delay);
        await input.current?.focus();
        await waitForKeyboard('custom');
        metrics = await getKeyboardMetrics(input);
        if (
          !metrics.focused ||
          metrics.keyboardMode !== 'custom' ||
          metrics.violations.length ||
          (await bottom()) > currentFrame()!.screenY + 3
        )
          throw new Error(
            `Interrupted dismissal (${delay}ms) failed to reopen: ${JSON.stringify(
              metrics,
            )}`,
          );
        await input.current?.blur();
        await wait(900);
        results.push({
          interruptedAtMs: delay,
          opening: 'PASS',
          dismissal: 'PASS',
        });
      }
      const message = `PASS: ${
        Platform.OS
      }: 6 show/hide cycles + 4 switches + 6 interrupted transitions. ${JSON.stringify(
        results,
      )}`;
      console.info(
        `KEYFLOW_TRANSITION_TEST material=${
          raised ? 'raised' : 'flat'
        } ${message}`,
      );
      setStatus(message);
    } catch (error) {
      baseline.current?.blur();
      await input.current?.blur();
      const message = `FAIL: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.info(
        `KEYFLOW_TRANSITION_TEST material=${
          raised ? 'raised' : 'flat'
        } ${message}`,
      );
      if (alive.current) setStatus(message);
    } finally {
      if (alive.current) setRunning(false);
    }
  };
  // Launch is a one-time test event; theme/state updates must not restart it.
  const runOnLaunch = useEffectEvent(run);
  const launched = useRef(false);
  useEffect(() => {
    if (
      __DEV__ &&
      launchTest === 'transitions' &&
      (testPlatform === 'all' || Platform.OS === testPlatform) &&
      !launched.current
    ) {
      launched.current = true;
      void runOnLaunch();
    }
  }, []);
  return {
    raised,
    setRaised,
    engine,
    frame,
    running,
    status,
    composer,
    baseline,
    input,
    bindings,
    record,
    run,
  };
}
