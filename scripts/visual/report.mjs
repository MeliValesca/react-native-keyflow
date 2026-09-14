/** Build a local visual review gallery from explicit test result manifests. */
import {
  existsSync,
  readFileSync,
  statSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { relative, resolve } from 'node:path';
const out = resolve('artifacts/features');
mkdirSync(out, { recursive: true });
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ]),
  );
const sections = [];
const json = (path) =>
  existsSync(path)
    ? {
        ...JSON.parse(readFileSync(path)),
        savedAt: statSync(path).mtime.toISOString(),
      }
    : null;
const image = (path, title) =>
  existsSync(path)
    ? `<figure><a href="${escape(
        relative(out, resolve(path)),
      )}"><img loading="lazy" src="${escape(
        relative(out, resolve(path)),
      )}" alt="${escape(title)}"></a><figcaption>${escape(
        title,
      )}</figcaption></figure>`
    : '<p>Not captured</p>';
const statuses = [];
for (const platform of ['ios', 'android']) {
  const base = `artifacts/native-parity/${platform}`;
  const functional = json(`${base}/results.json`);
  const gestures = json(`${base}/gesture-results.json`);
  const heldBase = `artifacts/features/${platform}/long-press`;
  const latestHeld = json(`${heldBase}/results.json`);
  const verifiedHeld = json(`${heldBase}/verification.json`);
  const held =
    verifiedHeld && verifiedHeld.savedAt >= (latestHeld?.savedAt ?? '')
      ? verifiedHeld
      : latestHeld;
  for (const [name, data] of [
    ['Typing and switching', functional],
    [
      held?.sources
        ? 'Long presses — verified across full and focused runs'
        : 'Long presses',
      held,
    ],
    ...(platform === 'android' ? [['Pages and cursor', gestures]] : []),
  ]) {
    statuses.push({
      platform,
      suite: name,
      result: data?.result ?? 'NOT RUN',
      savedAt: data?.savedAt,
    });
  }
  const cards = [];
  for (const [name, path] of [
    [
      'Default light/dark pixel comparisons',
      `artifacts/qwerty-defaults/${platform}/results.json`,
    ],
    [
      'Accent contrast light/dark',
      `artifacts/pressed-contrast/${platform}-results.json`,
    ],
    ...(platform === 'android'
      ? [
          ['Preview geometry and cleanup', `${base}/preview-results.json`],
          ['Accent drag', `${base}/accent-results.json`],
        ]
      : []),
  ]) {
    const data = json(path);
    statuses.push({
      platform,
      suite: name,
      result: data?.result ?? 'NOT RUN',
      savedAt: data?.savedAt,
    });
  }

  if (functional) {
    const names = [
      ...new Set(
        functional.results.map((r) => r.name.replace(/^(native|custom): /, '')),
      ),
    ];
    for (const name of names) {
      const rows = ['native', 'custom'].map((mode) =>
        functional.results.find((r) => r.name === `${mode}: ${name}`),
      );
      cards.push(
        `<article><h3>${escape(name)}</h3><p>Behavior: ${
          rows.every((r) => r?.pass) ? 'PASS' : 'FAIL / incomplete'
        } · Visual comparison: review</p><div class="pair">${rows
          .map((r, i) =>
            r?.screenshot
              ? image(`${base}/${r.screenshot}`, i ? 'Keyflow' : 'Native')
              : '<p>Missing screenshot</p>',
          )
          .join('')}</div><p>Expected text: <code>${escape(
          rows[0]?.expected ?? '',
        )}</code></p></article>`,
      );
    }
  }
  if (held)
    for (const label of [...new Set(held.results.map((r) => r.label))]) {
      const rows = ['native', 'custom'].map((mode) =>
        held.results.find((r) => r.mode === mode && r.label === label),
      );
      cards.push(
        `<article><h3>Hold ${escape(
          label,
        )}</h3><p>Held-state / cleanup captures. Keyflow foreground checks: ${
          rows[1]?.cells?.length || 0
        } accent cells. Native visual parity requires review.</p><div class="pair">${rows
          .map((r, i) =>
            r
              ? image(
                  `${r.directory ?? heldBase}/${r.held}`,
                  i ? 'Keyflow held' : 'Native held',
                )
              : '<p>Not captured</p>',
          )
          .join(
            '',
          )}</div><details><summary>After release</summary><div class="pair">${rows
          .map((r, i) =>
            r
              ? image(
                  `${r.directory ?? heldBase}/${r.released}`,
                  i ? 'Keyflow released' : 'Native released',
                )
              : '',
          )
          .join('')}</div></details></article>`,
      );
    }
  if (gestures)
    for (const name of [...new Set(gestures.results.map((r) => r.name))]) {
      cards.push(
        `<article><h3>${escape(name)}</h3><div class="pair">${[
          'native',
          'custom',
        ]
          .map((mode) => {
            const r = gestures.results.find(
              (r) => r.mode === mode && r.name === name,
            );
            return r?.screenshot
              ? image(
                  `${base}/${r.screenshot}`,
                  `${mode} — ${r.pass ? 'PASS' : 'FAIL'}`,
                )
              : '<p>Not captured</p>';
          })
          .join('')}</div></article>`,
      );
    }
  if (platform === 'android') {
    for (const [title, suffix] of [
      ['Press preview', 'pressed-q'],
      ['Preview cleanup', 'released-q'],
      ['Accent menu selection', 'accent-held'],
      ['Drag to É', 'accent-selected-201'],
      ['Drag to Ë', 'accent-selected-203'],
    ]) {
      if (existsSync(`${base}/custom-${suffix}.png`))
        cards.push(
          `<article><h3>${title}</h3><div class="pair">${['native', 'custom']
            .map((mode) => image(`${base}/${mode}-${suffix}.png`, mode))
            .join('')}</div></article>`,
        );
    }
  }
  for (const suite of ['transitions', 'customization']) {
    const folder = `artifacts/features/${platform}/${suite}`;
    const data = json(`${folder}/results.json`);
    statuses.push({
      platform,
      suite,
      result: data?.result ?? 'NOT RUN',
      savedAt: data?.savedAt,
    });
    if (data) {
      cards.push(
        `<article><h3>${suite}: ${escape(
          data.result,
        )}</h3><details><summary>Assertions and metrics</summary><p>${escape(
          data.detail || data.error || data.result,
        )}</p></details>${
          data.video
            ? `<video controls preload="metadata" style="max-width:100%" src="${escape(
                relative(out, resolve(data.video)),
              )}"></video>`
            : ''
        }${image(
          `${folder}/result.png`,
          `${suite} result`,
        )}<div class="gallery">${(data.captures || [])
          .map((c) =>
            image(
              `${folder}/${c.file}`,
              `${c.material} / ${c.font} / ${c.size} pt`,
            ),
          )
          .join('')}</div></article>`,
      );
    }
  }
  const initial = json(
    `${
      platform === 'android'
        ? 'artifacts/features/android/initial-case'
        : 'artifacts/features/ios/initial-case'
    }/results.json`,
  );
  if (initial) {
    statuses.push({
      platform,
      suite: 'Seeded-text capitalization regression',
      result: initial.result,
      savedAt: initial.savedAt,
    });
    cards.push(
      `<article><h3>Seeded-text capitalization</h3><p>Native and Keyflow both insert “alpha betaq”.</p><div class="pair">${[
        'native',
        'custom',
      ]
        .map((mode) =>
          image(
            `artifacts/features/${platform}/initial-case/${mode}.png`,
            mode,
          ),
        )
        .join('')}</div></article>`,
    );
  }
  const transitionFolder = `artifacts/features/${platform}/transitions`;
  if (existsSync(transitionFolder)) {
    const attempts = readdirSync(transitionFolder)
      .filter((name) => /^transitions-.*\.json$/.test(name))
      .map((name) => json(`${transitionFolder}/${name}`));
    if (attempts.length)
      cards.push(
        `<article><h3>Transition recording history</h3><p>Earlier failures remain available for investigation.</p><ul>${attempts
          .map(
            (attempt) =>
              `<li>${escape(attempt.result)} · ${escape(
                attempt.savedAt,
              )} · <a href="${escape(
                relative(out, resolve(attempt.video)),
              )}">Recording</a></li>`,
          )
          .join('')}</ul></article>`,
      );
  }
  sections.push(
    `<section data-platform="${platform}"><h2>${
      platform === 'ios' ? 'iOS / Apple' : 'Android / Gboard'
    }</h2>${cards.join('')}</section>`,
  );
}
const latestIOS = json('artifacts/ios-qwerty-tests/latest.json');
const verificationIOS = json('artifacts/ios-qwerty-tests/verification.json');
const ios =
  verificationIOS && verificationIOS.savedAt >= (latestIOS?.savedAt ?? '')
    ? verificationIOS
    : latestIOS;
const iosAttachments = [];
for (const run of ios?.runs ?? (ios ? [ios] : [])) {
  if (run.attachments && existsSync(`${run.attachments}/manifest.json`)) {
    const groups = JSON.parse(readFileSync(`${run.attachments}/manifest.json`));
    for (const group of groups) {
      const captures = group.attachments.filter(
        (a) =>
          /^(apple|keyflow)-/.test(a.suggestedHumanReadableName) &&
          a.exportedFileName.endsWith('.png'),
      );
      if (captures.length)
        iosAttachments.push(
          `<article><h3>${escape(
            group.testIdentifier,
          )}</h3><div class="pair" style="flex-wrap:wrap">${captures
            .map((a) =>
              image(
                `${run.attachments}/${a.exportedFileName}`,
                a.suggestedHumanReadableName.split('_0_')[0],
              ),
            )
            .join('')}</div></article>`,
        );
    }
  }
}
statuses.push({
  platform: 'ios',
  suite: `Continuous gestures + accent catalogue (XCTest)${
    ios?.runs ? ' — verified across full and focused runs' : ''
  }`,
  result: ios?.result ?? 'NOT RUN',
  savedAt: ios?.savedAt,
});
const coverage = [
  [
    'Initial case, one-shot Shift, Caps Lock, sentence case, double-space',
    'Text assertions + paired screenshots',
  ],
  [
    'Primary/secondary symbols and return to letters',
    'Typing checks; Android page screenshots; iOS gesture attachments',
  ],
  [
    'Every recorded iOS accent row, Android letter accents/number hints',
    'Held/released pairs; iOS cell visibility; catalogue assertions in XCTest',
  ],
  [
    'Accent drag, Shift drag, number drag, space cursor movement',
    'XCTest on iOS; ADB continuous gestures on Android; screenshots',
  ],
  [
    'Delete graphemes, hold-repeat, release cleanup, return/focus',
    'Independent text/focus assertions + screenshots',
  ],
  [
    'Opening/dismissal, avoiding view, mode switching, interruptions',
    'Transition fixture metrics; transition video when run',
  ],
  [
    'Default light/dark geometry and pressed contrast',
    'Dedicated pinned-device pixel comparisons',
  ],
  [
    'Custom fonts, colors, transparency',
    'Existing customization fixtures; separate from default feature suite',
  ],
  [
    'Physical-device haptics, VoiceOver/TalkBack, third-party IMEs, OS private prediction/swipe',
    'Not certified by this simulator suite',
  ],
];
writeFileSync(
  `${out}/index.html`,
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Keyflow feature tests</title><style>body{font:16px system-ui;background:#eef1f6;color:#17243b;margin:0 auto;padding:24px;max-width:1200px}h1{margin-bottom:8px}nav{position:sticky;top:0;background:#eef1f6;padding:12px;z-index:1}button,input{font:inherit;padding:8px;margin-right:8px}article{background:white;border-radius:16px;padding:20px;margin:24px 0} .gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}.pair{display:flex;gap:16px}figure{margin:0;flex:1;min-width:0}img{width:100%;max-height:700px;object-fit:contain;background:#eef1f6}figcaption{padding:8px;text-align:center}p,td{overflow-wrap:anywhere}td,th{text-align:left;border-bottom:1px solid #ccd4df;padding:10px}code{white-space:pre-wrap}details{margin-top:12px}[hidden]{display:none}a{color:#204ea0}</style><h1>Keyflow visual feature tests</h1><p>Generated ${escape(
    new Date().toISOString(),
  )}. Each suite shows its most recent saved result; report generation does not rerun tests. Screenshots are evidence, not an automatic claim of native pixel parity. Open images at full resolution to inspect letter edges.</p><nav><button data-filter="all">Both platforms</button><button data-filter="ios">iOS</button><button data-filter="android">Android</button><input id="search" placeholder="Filter features" aria-label="Filter features"></nav><h2>Test results</h2><table><tr><th>Platform</th><th>Suite</th><th>Result</th><th>Saved</th></tr>${statuses
    .map(
      (s) =>
        `<tr><td>${s.platform}</td><td>${escape(s.suite)}</td><td>${escape(
          s.result,
        )}</td><td>${escape(s.savedAt ?? '—')}</td></tr>`,
    )
    .join('')}</table><h2>Coverage and limits</h2><table>${coverage
    .map(([a, b]) => `<tr><td>${escape(a)}</td><td>${escape(b)}</td></tr>`)
    .join('')}</table>${
    ios?.resultBundle
      ? `<p>XCTest attachments: <code>${escape(
          ios.resultBundle,
        )}</code> (open in Xcode).</p>`
      : ''
  }${(ios?.runs ?? (ios ? [ios] : []))
    .filter((run) => run.video)
    .map(
      (run) =>
        `<article><h3>iOS XCTest recording</h3><p>${escape(
          run.resultBundle,
        )}</p><video controls preload="metadata" style="max-width:100%;max-height:700px" src="${escape(
          relative(out, resolve(run.video)),
        )}"></video></article>`,
    )
    .join(
      '',
    )}<section data-platform="ios"><h2>iOS gesture screenshots</h2>${iosAttachments.join(
    '',
  )}</section>${sections.join(
    '',
  )}<script>let platform='all';function filter(){const q=document.querySelector('#search').value.toLowerCase();document.querySelectorAll('section').forEach(s=>{s.hidden=platform!=='all'&&s.dataset.platform!==platform;s.querySelectorAll('article').forEach(a=>a.hidden=!a.querySelector('h3').textContent.toLowerCase().includes(q));});}document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{platform=b.dataset.filter;filter();});document.querySelector('#search').oninput=filter;</script>`,
);
writeFileSync(
  `${out}/summary.json`,
  JSON.stringify(
    { generatedAt: new Date().toISOString(), statuses, coverage },
    null,
    2,
  ),
);
console.log(`${out}/index.html`);
