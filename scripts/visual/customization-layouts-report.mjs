import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, relative, dirname } from 'node:path';
import { PNG } from 'pngjs';
const root = resolve('artifacts/customization-layouts');
mkdirSync(root, { recursive: true });
const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;');
let body = '';
for (const platform of ['ios', 'android']) {
  const pointer = `${root}/${platform}/latest.json`;
  if (!existsSync(pointer)) continue;
  const latest = JSON.parse(readFileSync(pointer));
  const d = JSON.parse(readFileSync(`${latest.output}/results.json`));
  body += `<h2>${platform}: ${d.result}</h2><p>${
    d.matrices.length
  }/12 layout/orientation matrices · ${d.matrices.reduce(
    (n, m) => n + m.count,
    0,
  )} theme checks · ${
    d.checks.length
  } interaction assertions. <a href="${relative(
    root,
    latest.output,
  )}/results.json">Full results</a></p>`;
  if (d.scope) body += `<p>${esc(d.scope)}</p>`;
  if (d.error) body += `<pre>${esc(d.error)}</pre>`;
  const foregroundPath = `${latest.output}/foreground-results.json`;
  if (existsSync(foregroundPath)) {
    const foreground = JSON.parse(readFileSync(foregroundPath));
    body += `<p>Pressed/released foregrounds: ${foreground.result} · ${
      foreground.checks.filter((c) => c.pass).length
    }/${foreground.checks.length}. <a href="${relative(
      root,
      foregroundPath,
    )}">Pixel measurements</a></p>`;
  }
  if (d.history)
    body += `<details><summary>Run history</summary>${d.history
      .map(
        (h) =>
          `<p><a href="${relative(root, h.file)}">${esc(h.result)} · ${esc(
            h.file,
          )}</a></p>`,
      )
      .join('')}</details>`;
  body += `<details><summary>Matrix results</summary><ul>${d.matrices
    .map((m) => `<li>${esc(m.name)}: ${m.result}, ${m.count} themes</li>`)
    .join('')}</ul></details>`;
  const groups = new Map();
  for (const c of d.captures) {
    const k = c.name.replace(/-(idle|held|released)$/, '');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  for (const [name, captures] of groups) {
    body += `<h3>${esc(name)}</h3><div class="row">`;
    for (const c of captures) {
      let path = c.path;
      if (platform === 'ios' && c.name.includes('landscape')) {
        const png = PNG.sync.read(readFileSync(path));
        if (png.width < png.height) {
          const out = `${dirname(path)}/display-${path.split('/').at(-1)}`;
          execFileSync(
            'sips',
            [
              '-r',
              c.name.includes('landscape-left') ? '-90' : '90',
              path,
              '--out',
              out,
            ],
            { stdio: 'ignore' },
          );
          path = out;
        }
      }
      body += `<figure><figcaption>${esc(
        c.name.split('-').at(-1),
      )}</figcaption><a href="${relative(
        root,
        path,
      )}"><img loading="lazy" src="${relative(root, path)}" alt="${esc(
        c.name,
      )}"></a></figure>`;
    }
    body += '</div>';
  }
}
writeFileSync(
  `${root}/index.html`,
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Keyflow customization layouts</title><style>body{font:16px system-ui;max-width:1500px;margin:32px auto;padding:0 20px;background:#f4f6fa;color:#192231}.row{display:flex;gap:12px}figure{flex:1;min-width:0;margin:0;background:white;padding:8px;border-radius:12px}img{display:block;max-width:100%;max-height:580px;margin:auto}figcaption{font-weight:600;margin-bottom:8px}pre{white-space:pre-wrap;color:#922}a{color:#145fb4}</style><h1>Customization across layouts</h1><p>QWERTY, Number, Decimal and Phone in portrait and both landscape directions. Each matrix checks 58 themes. The flat and raised visual profiles show idle, a real held key, and release. iOS landscape captures are rotated only for display.</p>${body}`,
);
console.log(`${root}/index.html`);
