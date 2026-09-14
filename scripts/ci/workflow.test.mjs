import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
const workflow = parse(readFileSync('.github/workflows/native.yml', 'utf8'));
const jobs = workflow.jobs;

test('each device consumes the artifact from its required single platform producer', () => {
  for (const platform of ['android', 'ios']) {
    const producer = jobs[platform];
    const consumer = jobs[`${platform}-interactions`];
    assert.ok(
      consumer.needs.includes(platform),
      'Device job must wait for its build',
    );
    assert.ok(
      producer.if.includes(`needs.scope.outputs.${platform} != 'false'`),
      'Only an explicit unaffected scope may skip a build',
    );
    const artifact = `${platform}-test-build`;
    const uploads = producer.steps.filter(
      (step) =>
        step.uses?.startsWith('actions/upload-artifact') &&
        step.with.name === artifact,
    );
    const downloads = consumer.steps.filter(
      (step) =>
        step.uses?.startsWith('actions/download-artifact') &&
        step.with.name === artifact,
    );
    assert.equal(uploads.length, 1);
    assert.equal(downloads.length, 1);
    assert.equal(uploads[0].with['if-no-files-found'], 'error');
    assert.match(
      downloads[0].if,
      new RegExp(`needs\\.${platform}\\.result == 'success'`),
    );
    assert.ok(
      consumer.steps.some(
        (step) =>
          step.name === 'Require successful shared build' &&
          step.run === 'exit 1',
      ),
    );
    const commands = consumer.steps
      .map((step) => step.run ?? step.with?.script ?? '')
      .join('\n');
    assert.doesNotMatch(
      commands,
      /gradlew|expo prebuild|pod install|stim ios|build-ios\.sh/,
    );
    assert.ok(
      !producer.steps.some((step) => step.uses?.includes('emulator-runner')),
    );
  }
});

test('all protected build and device check names remain present', () => {
  const names = [jobs.android.name, jobs.ios.name];
  for (const platform of ['android', 'ios']) {
    const job = jobs[`${platform}-interactions`];
    const matrices = [...job.strategy.matrix.include.matchAll(/'(\[.*?\])'/g)];
    const regular = JSON.parse(matrices.at(-1)[1]);
    names.push(
      ...regular.map(({ label }) =>
        job.name.replace('${{ matrix.label }}', label),
      ),
    );
  }
  assert.deepEqual(
    names.sort(),
    [
      'Android unit tests, lint, and example build',
      'iOS example build',
      'Android phone interactions, pads, holds, and layouts',
      'Android tablet interactions, pads, holds, and layouts',
      'iPhone interactions, layouts, holds, and rotation',
      'iPad interactions, layouts, holds, and rotation',
    ].sort(),
  );
});

test('PR and weekly device suites have one native workflow trigger', () => {
  const nativeWorkflows = readdirSync('.github/workflows').filter((name) => {
    const contents = readFileSync(`.github/workflows/${name}`, 'utf8');
    return /scripts\/ci\/build-ios.sh|reactivecircus\/android-emulator-runner|scripts\/launch-ios-ci/.test(
      contents,
    );
  });
  assert.deepEqual(nativeWorkflows, ['native.yml']);
  assert.ok(
    workflow.on.pull_request !== undefined || 'pull_request' in workflow.on,
  );
  assert.equal(workflow.on.schedule.length, 1);
});

test('prebuilt runners cannot fall back to compiling missing artifacts', () => {
  const android = readFileSync(
    'scripts/android-tests/run-prebuilt-ci.sh',
    'utf8',
  );
  const ios = readFileSync('scripts/ci/run-ios.sh', 'utf8');
  assert.doesNotMatch(android, /gradlew|assembleDebug|expo prebuild/);
  assert.match(android, /build-commit\.txt/);
  assert.match(ios, /xcodebuild test-without-building/);
  assert.match(ios, /KEYFLOW_IOS_XCTESTRUN/);
  assert.match(
    readFileSync('scripts/run-ios-qwerty-tests.mjs', 'utf8'),
    /Missing shared XCTest bundle/,
  );
});

test('device coverage has no optional mode or hidden filters', () => {
  assert.equal(workflow.on.workflow_dispatch, null);
  assert.equal(workflow.env?.KEYFLOW_TEST_SUITE, undefined);
  for (const file of [
    'scripts/ci/run-ios.sh',
    'scripts/run-ios-qwerty-tests.mjs',
    'scripts/android-tests/instrumentation.py',
  ]) {
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /KEYFLOW_TEST_SUITE|selectedTests|extended_tests/,
    );
  }
});

test('device sources contain the proven inventory plus glyph and Shift regressions', () => {
  const baseline = JSON.parse(
    readFileSync('scripts/ci/baseline-tests.json', 'utf8'),
  );
  for (const [group, file] of [
    ['iosInteractions', 'scripts/ios-tests/KeyflowQwertyTests.swift'],
    ['iosRendering', 'scripts/ios-tests/KeyflowRenderingTests.swift'],
  ]) {
    const actual = [
      ...readFileSync(file, 'utf8').matchAll(/func (test\w+)\(/g),
    ].map((match) => match[1]);
    const regressions =
      group === 'iosRendering'
        ? [
            'testPhoneDoubleShiftLocksCaseAndShowsLockGlyph',
            'testSpacePressChangesDefaultFillAndRestoresOnRelease',
            'testSpacePressRestoresCustomFillOnCancellation',
            'testSpaceTrackpadSoftensFacesAndRestoresCustomColors',
            'testTabletDollarHoldCommitsInitialChoiceWithoutDrag',
            'testSpaceTrackpadLegendsFadeOnEntry',
            'testSpaceTrackpadReleaseRestoresLegendsDuringFade',
            'testSpaceTrackpadCancellationRestoresLegends',
            'testHeldDeleteStopsOnRelease',
            'testHeldDeleteStopsOnCancellation',
            'testHeldDeleteStopsOutsideKey',
            'testTabletShiftedCommaDisplaysAndInsertsExclamation',
            'testTabletShiftedPeriodDisplaysAndInsertsQuestion',
            'testTabletCapsLockClearsManualShift',
            'testTabletShiftTurnsCapsLockOff',
          ]
        : [];
    assert.deepEqual(
      actual.sort(),
      [...baseline[group], ...regressions].sort(),
    );
  }
  const directory = 'android/src/androidTest/java/com/keyflow';
  const actual = readdirSync(directory)
    .filter((name) => name.endsWith('Test.kt'))
    .flatMap((name) => {
      const code = readFileSync(`${directory}/${name}`, 'utf8');
      return [...code.matchAll(/@Test\s+fun (\w+)\(/g)].map(
        (match) => `com.keyflow.${name.slice(0, -3)}#${match[1]}`,
      );
    });
  const regressions = [
    'phoneDoubleShiftLocksCaseAndShowsDistinctGlyph',
    'leftShiftFillsArrowsUntilOneLetterIsTyped',
    'rightShiftFillsArrowsUntilOneLetterIsTyped',
    'tabletAutomaticCapitalizationSelectsCapsInsteadOfShift',
    'tabletCapsThenShiftRemainSelected',
    'tabletShiftThenCapsRemainSelected',
    'shiftedCommaDisplaysAndInsertsPlatformValue',
    'shiftedPeriodDisplaysAndInsertsPlatformValue',
    'spaceTrackpadKeepsPressedColorUntilRelease',
    'raisedSpaceTrackpadKeepsPressedColor',
    'spaceTrackpadCancellationRestoresColor',
    'flatPressedGlyphActuallyRenders',
    'raisedPressedGlyphActuallyRenders',
    'flatRestingGlyphActuallyRenders',
    'raisedRestingGlyphActuallyRenders',
  ].map((name) => `com.keyflow.KeyflowPressFeedbackTest#${name}`);
  assert.deepEqual(
    actual.sort(),
    [...baseline.androidInstrumentation, ...regressions].sort(),
  );
});
