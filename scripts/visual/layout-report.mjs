import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { relative, resolve, dirname } from 'node:path';
import { PNG } from 'pngjs';
const root = resolve('artifacts/layouts');
mkdirSync(root, { recursive: true });
const escape = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;');
let sections = '';
for (const platform of ['ios', 'android']) {
  const latest = `${root}/${platform}/latest.json`;
  if (!existsSync(latest)) continue;
  const { output } = JSON.parse(readFileSync(latest));
  const data = JSON.parse(readFileSync(`${output}/results.json`));
  sections += `<h2>${platform}: ${data.result} · ${
    data.checks.length
  } checks</h2><p>${escape(data.completedAt)} · <a href="${relative(
    root,
    output,
  )}/results.json">Full results</a></p>`;
  if (data.error) sections += `<pre>${escape(data.error)}</pre>`;
  if (data.scope) sections += `<p>${escape(data.scope)}</p>`;
  if (data.history)
    sections += `<details><summary>Run history (including failures)</summary><ul>${data.history
      .map(
        (h) =>
          `<li><a href="${relative(root, h.file)}">${escape(
            h.result,
          )} · ${escape(h.file.split('/').slice(-2).join('/'))}</a></li>`,
      )
      .join('')}</ul></details>`;
  const visualPath = `${root}/${platform}/visual-latest.json`;
  const visual = existsSync(visualPath)
    ? JSON.parse(readFileSync(visualPath))
    : undefined;
  const finalCaptures = new Map(data.captures.map((c) => [c.name, c]));
  if (visual) {
    if (visual.unchangedCustomSource)
      sections += `<p>This phone-pad refresh retains unchanged QWERTY, Number, and Decimal captures from <a href="${relative(
        root,
        visual.unchangedCustomSource,
      )}">the preceding full capture set</a>.</p>`;
    const typographyPath = `${visual.output}/typography.json`;
    if (existsSync(typographyPath)) {
      const typography = JSON.parse(readFileSync(typographyPath));
      sections += `<p>Pad typography: ${escape(typography.result)} · ${
        typography.checks.filter((c) => c.pass).length
      }/${
        typography.checks.length
      } glyph-bound comparisons. <a href="${relative(
        root,
        typographyPath,
      )}">Text measurements</a></p>`;
    }
    if (visual.nativeSource)
      sections += `<p>Native screenshots reused from <a href="${relative(
        root,
        visual.nativeSource,
      )}">this completed capture run</a>; custom screenshots and measurements refreshed after the final change.</p>`;
    sections += `<p>Final visual refresh: ${escape(visual.result)} · ${
      visual.geometry.filter((g) => g.pass).length
    }/${
      visual.geometry.length
    } geometry comparisons within 3 points. <a href="${relative(
      root,
      visual.output,
    )}/results.json">Measurements</a>. Geometry checks cover key faces, not glyphs or animation curves.</p>`;
    if (visual.result === 'PASS')
      for (const c of visual.captures) finalCaptures.set(c.name, c);
  }
  const spacesPath = `${root}/${platform}/spaces/results.json`;
  if (existsSync(spacesPath))
    sections += `<p><a href="${relative(
      root,
      spacesPath,
    )}">Numeric-pad double-space regression results</a></p>`;
  const groups = new Map();
  for (const capture of finalCaptures.values()) {
    const key = capture.name.replace('-system-', '-').replace('-custom-', '-');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(capture);
  }
  for (const [name, captures] of groups) {
    sections += `<h3>${escape(name)}</h3><div class="pair">`;
    for (const capture of captures.sort(
      (a, b) =>
        Number(a.name.includes('-custom-')) -
        Number(b.name.includes('-custom-')),
    )) {
      let path = capture.path;
      if (platform === 'ios' && capture.name.includes('landscape')) {
        const png = PNG.sync.read(readFileSync(path));
        if (png.width < png.height) {
          const display = `${dirname(path)}/display-${path.split('/').at(-1)}`;
          execFileSync(
            'sips',
            [
              '-r',
              capture.name.includes('landscape-left') ? '-90' : '90',
              path,
              '--out',
              display,
            ],
            { stdio: 'ignore' },
          );
          path = display;
        }
      }
      sections += `<figure><figcaption>${
        capture.name.includes('-custom-') ? 'Keyflow' : 'Native'
      }</figcaption><a href="${relative(
        root,
        path,
      )}"><img loading="lazy" src="${relative(root, path)}" alt="${escape(
        capture.name,
      )}"></a></figure>`;
    }
    sections += '</div>';
  }
}
writeFileSync(
  `${root}/index.html`,
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Keyflow layouts</title><style>body{font:16px system-ui;background:#f4f6fa;color:#192231;margin:32px auto;padding:0 20px;max-width:1200px}h1{font-size:36px}.pair{display:flex;gap:18px;align-items:start}figure{margin:0;flex:1;min-width:0;background:white;padding:12px;border-radius:14px}figcaption{font-weight:700;margin-bottom:8px}img{max-width:100%;max-height:620px;display:block;margin:auto}pre{white-space:pre-wrap;color:#922}a{color:#145fb4}@media(max-width:650px){.pair{gap:6px}figure{padding:5px}body{padding:0 8px}}</style><h1>Layouts & rotation</h1><p>Saved device assertions and native/custom screenshot pairs. A passing result does not certify pixel identity. Images retain the captured device theme and input state. iOS landscape images are rotated for viewing; source captures are retained.</p>${sections}`,
);
console.log(`${root}/index.html`);
