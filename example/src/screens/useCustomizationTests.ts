import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  getKeyboardMetrics,
  type KeyflowKeyboardMetrics,
} from 'react-native-keyflow/testing';
import type {
  KeyboardTheme,
  KeyflowKeyboardFrame,
  KeyflowKeyboardType,
  KeyflowTextInputRef,
} from 'react-native-keyflow';
import { launchTest, testPlatform } from '../testing/launch';
import {
  customizationBase,
  customizationCases,
  customizationVisuals,
} from '../testing/customizationCases';
const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useCustomizationTests(loaded: boolean, landscape: boolean) {
  const input = useRef<KeyflowTextInputRef>(null),
    alive = useRef(true),
    launched = useRef(false);
  const [theme, setTheme] = useState<KeyboardTheme>(customizationBase);
  const [type, setType] = useState<KeyflowKeyboardType>('default');
  const [frame, setFrame] = useState<KeyflowKeyboardFrame | null>(null);
  const [requested, setRequested] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(
    'Choose a layout and rotate to test it.',
  );
  const [report, setReport] = useState<object | null>(null),
    [diagnostic, setDiagnostic] = useState<object | null>(null);
  const [visual, setVisual] = useState(-1);
  useEffect(() => {
    alive.current = true;
    const mountedInput = input.current;
    return () => {
      alive.current = false;
      void mountedInput?.blur();
    };
  }, []);
  const change = (next: KeyboardTheme) => {
    setTheme(next);
    void input.current?.focus();
  };
  const validate = (
    metrics: KeyflowKeyboardMetrics,
    baseline?: KeyflowKeyboardMetrics,
  ) => {
    if (
      !metrics.focused ||
      metrics.keyboardType !== type ||
      metrics.landscape !== landscape
    )
      throw new Error('Stale layout, orientation, or focus');
    const minimum = type === 'default' ? 26 : Platform.OS === 'ios' ? 12 : 16;
    if (
      metrics.keyCount < minimum ||
      metrics.width <= 0 ||
      metrics.height <= 0 ||
      metrics.violations.length
    )
      throw new Error(metrics.violations.join('; ') || 'Keyboard not laid out');
    if (
      Platform.OS === 'android' &&
      metrics.editorBottom !== undefined &&
      metrics.screenY !== undefined &&
      metrics.editorBottom > metrics.screenY + 1
    )
      throw new Error('Editor obscured');
    if (
      baseline &&
      (Math.abs(metrics.height - baseline.height) > 1 ||
        Math.abs(metrics.width - baseline.width) > 1)
    )
      throw new Error('Customization changed keyboard geometry');
    if (
      baseline &&
      (metrics.text !== baseline.text ||
        metrics.selectionStart !== baseline.selectionStart ||
        metrics.selectionEnd !== baseline.selectionEnd)
    )
      throw new Error('Customization changed editor text or selection');
  };
  const inspect = async () => {
    try {
      const metrics = await getKeyboardMetrics(input.current);
      validate(metrics);
      setDiagnostic({
        ...metrics,
        profile: customizationVisuals[visual]?.name ?? 'manual',
        theme: {
          material: theme.material,
          keyBackground: theme.keyBackground,
          actionKeyBackground: theme.actionKeyBackground,
          deleteKeyBackground: theme.deleteKeyBackground,
        },
        result: 'PASS',
      });
    } catch (e) {
      setDiagnostic({ result: 'FAIL', error: String(e) });
    }
  };
  const run = async () => {
    if (running) return;
    if (!loaded) {
      setRequested(true);
      setStatus('Waiting for the input and font to be ready…');
      return;
    }
    setRequested(false);
    setRunning(true);
    setReport(null);
    setStatus(`Testing ${customizationCases.length} themes…`);
    const original = theme,
      results: Array<Record<string, unknown>> = [];
    let current = 'baseline';
    try {
      await input.current?.focus();
      await pause(500);
      const baseline = await getKeyboardMetrics(input.current);
      validate(baseline);
      for (const test of customizationCases) {
        current = test.name;
        if (!alive.current) throw new Error('Screen closed');
        try {
          setTheme(test.theme);
          await pause(180);
          const metrics = await getKeyboardMetrics(input.current);
          validate(metrics, baseline);
          if (
            Platform.OS === 'ios' &&
            test.bundled &&
            (!metrics.fonts.some((n) => n.includes('JetBrains')) ||
              (type === 'phone-pad' &&
                !metrics.padFonts?.every((n) => n.includes('JetBrains'))))
          )
            throw new Error('Bundled font did not resolve for all pad labels');
          results.push({
            name: test.name,
            result: 'PASS',
            width: metrics.width,
            height: metrics.height,
            fonts: metrics.fonts,
            padFonts: metrics.padFonts,
          });
        } catch (error) {
          results.push({
            name: test.name,
            result: 'FAIL',
            error: String(error),
          });
        }
      }
      const failures = results.filter((item) => item.result === 'FAIL');
      if (failures.length)
        throw new Error(
          failures.map((item) => `${item.name}: ${item.error}`).join('; '),
        );
      const result = {
        result: 'PASS',
        type,
        landscape,
        count: results.length,
        cases: results,
      };
      console.info('KEYFLOW_CUSTOMIZATION_TEST', JSON.stringify(result));
      if (alive.current) {
        setReport(result);
        setStatus(
          `PASS: ${results.length} themes; no key overlap, label overflow, or keyboard size changes.`,
        );
      }
    } catch (e) {
      if (alive.current) {
        const result = {
          result: 'FAIL',
          type,
          landscape,
          count: results.length,
          test: current,
          cases: results,
          error: String(e),
        };
        setReport(result);
        setStatus(`FAIL: ${current}: ${String(e)}`);
      }
    } finally {
      if (alive.current) {
        setRunning(false);
        setTheme(original);
      }
    }
  };
  // Launch is a one-time test event; theme/state updates must not restart it.
  const runOnLaunch = useEffectEvent(run);
  useEffect(() => {
    if (requested && loaded) void runOnLaunch();
  }, [requested, loaded]);
  useEffect(() => {
    if (
      __DEV__ &&
      loaded &&
      launchTest === 'customization' &&
      (testPlatform === 'all' || Platform.OS === testPlatform) &&
      !launched.current
    ) {
      launched.current = true;
      void runOnLaunch();
    }
  }, [loaded]);
  return {
    input,
    theme,
    type,
    setType,
    frame,
    setFrame,
    running,
    status,
    report,
    setReport,
    diagnostic,
    visual,
    setVisual,
    change,
    inspect,
    run,
  };
}
