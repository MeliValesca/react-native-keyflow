import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function layoutDriver(platform, session) {
  const run = (...args) =>
    JSON.parse(
      execFileSync(
        process.env.AGENT_DEVICE || 'agent-device',
        [...args.map(String), '--session', session, '--json'],
        { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
      ),
    ).data;
  const snapshot = () => run('snapshot').nodes;
  const control = (label) =>
    run(
      'press',
      label === 'Check layout'
        ? 'id="check-layout"'
        : `label=${JSON.stringify(label)}`,
      '--settle',
    );
  const inspect = async () => {
    control('Check layout');
    await pause(200);
    const node = snapshot().find((n) => n.identifier === 'check-layout');
    assert(node, 'Missing layout inspector');
    const state = JSON.parse(node.label.slice(node.label.indexOf('{')));
    assert.deepEqual(state.failures, []);
    assert(state.focused, 'Focus lost');
    return state;
  };
  const keyPoint = (labels, metrics) => {
    const nodes = snapshot();
    if (platform === 'ios' && metrics.landscape) {
      assert.equal(nodes[0].rect.width, 874);
      assert.equal(nodes[0].rect.height, 402);
      if (metrics.keyboardMode === 'system') return [197, 363]; // Only phone page toggle is used by this capture driver.
      const key = metrics.keyFrames.find((k) => labels.includes(k.label));
      assert(key);
      return [key.x + key.width / 2, key.y + key.height / 2];
    }
    const field = nodes.find(
      (n) => n.label === 'Layout input' || n.type?.includes('EditText'),
    );
    const key = nodes.find(
      (n) =>
        labels.includes(n.label) &&
        n.rect?.height > 20 &&
        n.rect.y >= (field?.rect.y ?? 100) + (field?.rect.height ?? 44),
    );
    if (key)
      return [
        key.rect.x + key.rect.width / 2,
        key.rect.y + key.rect.height / 2,
      ];
    assert.equal(metrics.keyboardMode, 'custom');
    const target = metrics.keyFrames.find((k) => labels.includes(k.label));
    assert(target, `Missing ${labels}`);
    return [target.x + target.width / 2, target.y + target.height / 2];
  };
  const key = (labels, metrics, hold = 0) => {
    // Coordinates here follow inspected AX, or native diagnostics when AX is omitted/rotated.
    const point = keyPoint(labels, metrics);
    run(hold ? 'longpress' : 'press', ...point, ...(hold ? [hold] : []));
  };
  const text = () => {
    const field = snapshot().find(
      (n) => n.label === 'Layout input' || n.type?.includes('EditText'),
    );
    assert(field);
    return field.value === 'Try this layout…' ? '' : field.value ?? '';
  };
  const open = () => {
    if (snapshot().some((n) => n.label === 'Compare layouts & rotation'))
      control('Compare layouts & rotation');
  };
  return { run, snapshot, control, inspect, key, keyPoint, text, open };
}
