import { execFileSync } from 'node:child_process';
const [platform, session, target] = process.argv.slice(2);
const labels = {
  interaction: 'Compare native interactions',
  longpress: 'Test long press behavior',
  transitions: 'Test keyboard transitions',
  customization: 'Customize fonts & test layouts',
  layouts: 'Compare layouts & rotation',
  languages: 'English & French keyboards',
  transparency: 'Make room for your style.',
  customfont: 'Your app. Your type.',
  default: 'Feels familiar.',
};
if (!['ios', 'android'].includes(platform) || !session || !labels[target])
  throw new Error('Supply platform session and a known fixture name');
const agent = process.env.AGENT_DEVICE || 'agent-device';
const run = (...args) =>
  JSON.parse(
    execFileSync(agent, [...args, '--session', session, '--json'], {
      encoding: 'utf8',
    }),
  ).data;
let nodes = run('snapshot').nodes;
const isHome = (items) =>
  items.some(
    (node) =>
      node.label === 'Keyboard lab' ||
      node.label?.startsWith('Keyboard lab,') ||
      node.label === 'Feels familiar.' ||
      node.label?.startsWith('Story Studio'),
  );
if (!isHome(nodes)) {
  run(
    'press',
    platform === 'ios' ? 'role=button label="Keyflow"' : 'label="Navigate up"',
    '--settle',
  );
  nodes = run('snapshot').nodes;
}
if (isHome(nodes)) {
  run('scroll', 'top');
  nodes = run('snapshot').nodes;
}
for (
  let attempt = 0;
  !nodes.some((node) => node.label === labels[target]) && attempt < 10;
  attempt++
) {
  run('scroll', 'down', '240');
  nodes = run('snapshot').nodes;
}
run('press', `label="${labels[target]}"`, '--settle');
