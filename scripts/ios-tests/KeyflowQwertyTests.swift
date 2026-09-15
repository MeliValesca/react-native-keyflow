import XCTest
import UIKit

final class KeyflowQwertyTests: XCTestCase {
  let app = XCUIApplication(bundleIdentifier: "com.keyflow.example")
  private static var preparedSystemKeyboard = false
  private var expectsSystemKeyboard = false
  private var settledKeyboardGeometry: String?
  override func setUpWithError() throws {
    // Tablet-only cases must not relaunch the app on iPhone just to skip later.
    try XCTSkipIf(UIDevice.current.userInterfaceIdiom != .pad && name.contains(" testTablet"), "iPad-only test")
    try XCTSkipIf(UIDevice.current.userInterfaceIdiom == .pad && name.contains(" testPhone"), "iPhone-only test")
    continueAfterFailure = false
    if let url = ProcessInfo.processInfo.environment["KEYFLOW_METRO_URL"] {
      app.launchArguments = ["--initialUrl", url]
    }
    // Set the sensor before launch so a previous landscape test cannot leave a
    // portrait scene racing with a late orientation notification after launch.
    if UIDevice.current.userInterfaceIdiom == .pad {
      XCUIDevice.shared.orientation = .portrait
    }
    launchInteractionScreen()
    if UIDevice.current.userInterfaceIdiom == .pad {
      setOrientation(.portrait)
    }
    // A fresh simulator presents Apple's slide-to-type introduction on first
    // use. Warm up and dismiss that UI before measuring any native gesture.
    if !Self.preparedSystemKeyboard {
      mode(true)
      let introduction = app.buttons["Continue"]
      if introduction.waitForExistence(timeout: 5) {
        introduction.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
      }
      reset("Empty")
      do {
        // A fresh system keyboard can type the base character on its first hold
        // without presenting alternatives. Initialize that native path during
        // setup, before collecting any reference gesture or comparison.
        pressKey(["E"], duration: 2)
        let processed = NSPredicate { [self] _, _ in !text.isEmpty }
        XCTAssertEqual(
          XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: processed, object: nil)], timeout: 5),
          .completed, "Native held-key warm-up must process input")
      }
      // The introduction creates and dismisses system keyboard windows. End
      // that warm-up session so its responder/AX state cannot leak into the
      // first test. This is setup only; no test action is replayed.
      app.terminate()
      launchInteractionScreen()
      Self.preparedSystemKeyboard = true
    }
  }
  private func launchInteractionScreen() {
    app.launch()
    let entry = app.buttons["Compare native interactions"]
    let ready = NSPredicate(format: "exists == true AND hittable == true")
    let homeReady = { XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: ready, object: entry)], timeout: 30) }
    if homeReady() != .completed {
      // CoreSimulator can leave a relaunched app behind a black system window.
      // Recover startup once, retaining evidence; never replay a test gesture.
      capture("startup-not-ready-before-relaunch")
      app.terminate()
      app.launch()
      XCTAssertEqual(homeReady(), .completed, "Home navigation must be visible and hittable after launch")
    }
    entry.tap()
    XCTAssertTrue(app.buttons["Reset Empty"].waitForExistence(timeout: 10))
    // Controls appear before the auto-focused editor and its first keyboard
    // presentation settle. Do not remount during that outgoing presentation.
    expectsSystemKeyboard = false
    settledKeyboardGeometry = nil
    _ = key(["Q"])
  }
  func mode(_ native: Bool) {
    expectsSystemKeyboard = native
    settledKeyboardGeometry = nil
    let element = app.descendants(matching: .any)
      .matching(identifier: native ? "interaction-mode-system" : "interaction-mode-custom").firstMatch
    let ready = NSPredicate(format: "exists == true AND hittable == true")
    if !ready.evaluate(with: element) {
      XCTAssertEqual(
        XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: ready, object: element)], timeout: 10),
        .completed, "Keyboard mode tab must be visible and hittable")
    }
    if element.isSelected { return }
    element.tap()
    let selected = NSPredicate(format: "selected == true")
    if !selected.evaluate(with: element) {
      XCTAssertEqual(
        XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: selected, object: element)], timeout: 5),
        .completed, "Keyboard mode did not finish switching")
    }
    // The JS tab can select before UIKit finishes presenting the requested
    // keyboard. Do not cancel that presentation with an immediate reset.
    if Self.preparedSystemKeyboard { _ = key(["space", " "]) }
  }
  func reset(_ name: String) {
    settledKeyboardGeometry = nil
    let previousInputIdentifier = app.textFields.firstMatch.identifier
    app.buttons["Reset \(name)"].tap()
    let expected = name == "Empty" ? "" : "alpha beta"
    let resetFinished = NSPredicate { [self] _, _ in
      app.textFields.firstMatch.identifier != previousInputIdentifier && text == expected
    }
    XCTAssertEqual(
      XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: resetFinished, object: nil)], timeout: 5),
      .completed, "Reset \(name) did not remount the input with \(expected)")
    // Wait for the remounted editor's presentation before requesting metrics.
    // Polling must not start a new async request and erase the previous result.
    _ = key(["Q", "q"])
    center(app.buttons["Inspect keyboard state"]).tap()
    let nativeReady = NSPredicate { [self] _, _ in
      let label = app.staticTexts["interaction-state"].label
      guard label.hasPrefix("Diagnostic state: {"),
        let data = label.replacingOccurrences(of: "Diagnostic state: ", with: "").data(using: .utf8),
        let state = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
      else { return false }
      return state["focused"] as? Bool == true
        && state["keyboardMode"] as? String == (expectsSystemKeyboard ? "system" : "custom")
    }
    XCTAssertEqual(
      XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: nativeReady, object: nil)], timeout: 10),
      .completed, "Reset must finish native attachment, configuration and focus")
  }
  func key(_ labels: [String], file: StaticString = #filePath, line: UInt = #line) -> XCUIElement {
    var match: XCUIElement?
    var previous: String?
    var stableSince: TimeInterval?
    let ready = NSPredicate { [self] _, _ in
      let bounds = app.frame
      let keyboardRegion = bounds.minY + bounds.height * 0.42
      for label in labels {
        let predicate = NSPredicate(format: "identifier == %@ OR label == %@", label, label)
        match = app.descendants(matching: .any).matching(predicate).allElementsBoundByIndex.first {
          let frame = $0.frame
          return frame.midY >= keyboardRegion
            && bounds.contains(CGPoint(x: frame.midX, y: frame.midY))
            && frame.width > 0 && frame.height > 0 && $0.isHittable
            && $0.identifier.hasPrefix("keyflow-key-") != expectsSystemKeyboard
        }
        if let match {
          let frame = match.frame
          let editor =
            app.textFields.firstMatch.exists
            ? app.textFields.firstMatch.frame : app.textViews.firstMatch.frame
          let editorIdentifier = app.textFields.firstMatch.exists
            ? app.textFields.firstMatch.identifier : app.textViews.firstMatch.identifier
          let source = NSPredicate(format: expectsSystemKeyboard
            ? "NOT (identifier BEGINSWITH 'keyflow-key-')"
            : "identifier BEGINSWITH 'keyflow-key-'")
          let anchor = app.keys.matching(source).firstMatch
          let geometry = "\(expectsSystemKeyboard)|\(bounds)|\(editorIdentifier)|\(editor)|\(anchor.frame)|\(anchor.label)"
          if geometry == settledKeyboardGeometry { return true }
          let sample = "\(geometry)|\(frame)"
          let now = ProcessInfo.processInfo.systemUptime
          if sample != previous {
            previous = sample
            stableSince = now
          }
          if now - (stableSince ?? now) >= 0.3 {
            settledKeyboardGeometry = geometry
            return true
          }
          return false
        }
      }
      stableSince = nil
      previous = nil
      return false
    }
    if ready.evaluate(with: app), let match { return match }
    // Keyboard page changes and input remounts are asynchronous. Do not use
    // stale accessibility keys that still exist below the visible screen.
    let result = XCTWaiter.wait(
      for: [XCTNSPredicateExpectation(predicate: ready, object: app)], timeout: 5)
    XCTAssertEqual(
      result, .completed, "Keyboard key must be visible and hittable: \(labels)", file: file,
      line: line)
    return match ?? app.descendants(matching: .key).firstMatch
  }
  // Freeze screen coordinates before UIKit changes the held key's AX tree.
  // Resolving an element-relative point during synthesis can use a new frame.
  private func center(_ element: XCUIElement) -> XCUICoordinate {
    let frame = element.frame
    let bounds = app.frame
    return app.coordinate(withNormalizedOffset: .zero).withOffset(
      CGVector(dx: frame.midX - bounds.minX, dy: frame.midY - bounds.minY))
  }
  private func pressKey(_ labels: [String], duration: TimeInterval) {
    center(key(labels)).press(forDuration: duration)
  }
  var text: String {
    let value = app.textFields.firstMatch.value as? String ?? ""
    return value == "Start typing…" ? "" : value
  }
  private func waitForText(
    _ expected: String, context: String, file: StaticString = #filePath, line: UInt = #line
  ) {
    let applied = NSPredicate { [self] _, _ in text == expected }
    if !applied.evaluate(with: nil) {
      defer { if text != expected { capture("edit-not-applied") } }
      XCTAssertEqual(
        XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: applied, object: nil)], timeout: 5),
        .completed, "\(context); expected \(expected), got \(text)", file: file, line: line)
    }
    XCTAssertEqual(text, expected, context, file: file, line: line)
  }
  private func tapKey(
    _ labels: [String], expecting expected: String, context: String,
    file: StaticString = #filePath, line: UInt = #line
  ) {
    let item = key(labels, file: file, line: line)
    let targetFrame = item.frame
    center(item).tap()
    waitForText(
      expected, context: "\(context); tapped \(labels) at \(targetFrame)", file: file, line: line)
  }
  private func setOrientation(
    _ orientation: UIDeviceOrientation, file: StaticString = #filePath, line: UInt = #line
  ) {
    let device = XCUIDevice.shared
    if device.orientation != orientation { device.orientation = orientation }
    let landscape = orientation == .landscapeLeft || orientation == .landscapeRight
    settledKeyboardGeometry = nil
    var previousFrame = CGRect.null
    var stableSince = ProcessInfo.processInfo.systemUptime
    let settled = NSPredicate { [self] _, _ in
      let frame = app.frame
      let now = ProcessInfo.processInfo.systemUptime
      let matches = landscape ? frame.width > frame.height : frame.height > frame.width
      if !matches || frame != previousFrame || device.orientation != orientation {
        previousFrame = frame
        stableSince = now
        return false
      }
      return now - stableSince >= 0.3
    }
    let result = XCTWaiter.wait(
      for: [XCTNSPredicateExpectation(predicate: settled, object: nil)], timeout: 10)
    if result != .completed { capture("rotation-not-settled") }
    XCTAssertEqual(
      result, .completed,
      "App geometry did not settle after rotating to \(orientation.rawValue); device=\(device.orientation.rawValue), frame=\(app.frame)",
      file: file, line: line)
  }
  private func readInteractionState() throws -> [String: Any] {
    let output = app.staticTexts["interaction-state"]
    let ready = NSPredicate(format: "label BEGINSWITH %@", "Diagnostic state: {")
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: ready, object: output)], timeout: 5), .completed, "The asynchronous keyboard diagnostic must finish")
    let raw = output.label.replacingOccurrences(of: "Diagnostic state: ", with: "")
    return try JSONSerialization.jsonObject(with: Data(raw.utf8)) as! [String: Any]
  }
  func capture(_ name: String) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
  }
  func testSystemKoreanCompositionAndSwitching() throws {
    mode(true); reset("Empty")
    let globe = app.buttons["Next keyboard"]
    if !app.keys["ㄱ"].exists {
      guard globe.exists, (globe.value as? String) == "한국어" else {
        throw XCTSkip("Enable Korean (2-Set) beside English in the simulator keyboard settings")
      }
      center(globe).tap()
    }
    XCTAssertTrue(app.keys["ㄱ"].waitForExistence(timeout: 5))
    tapKey(["ㄱ"], expecting: "ㄱ", context: "Initial Korean consonant was not inserted")
    tapKey(["ㅏ"], expecting: "가", context: "Korean vowel did not compose")
    tapKey(["ㄴ"], expecting: "간", context: "Final Korean consonant did not compose")
    capture("system-korean-composition")
    tapKey(["삭제"], expecting: "가", context: "Korean delete did not remove the final consonant")
    tapKey([" "], expecting: "가 ", context: "Space did not commit the Korean composition")
    let committed = text
    XCTAssertTrue(globe.exists)
    center(globe).tap()
    XCTAssertTrue(app.keys["q"].waitForExistence(timeout: 5))
    tapKey(["q"], expecting: committed + "q", context: "English input after language switch failed")
    capture("system-language-switch-preserves-text")
    app.buttons["Inspect keyboard state"].tap()
    let state = try readInteractionState()
    XCTAssertEqual(state["keyboardMode"] as? String, "system")
  }
  // iPhone can share one launch safely. On iPad, a held key can leave the app
  // animated for XCTest's 60-second idle window, so each case gets a relaunch.
  func testPhoneAccentCataloguesFit() throws {
    reset("Cursor")
    for base in ["a", "e", "i", "o", "u", "c", "n", "s", "y", "z", "l", "d", "r", "t", "g", "h", "k", "w"] {
      try assertAccentCatalogue(base, uppercase: false, resetInput: false)
    }
    try assertAccentCatalogue("i", uppercase: true, resetInput: false)
    try assertAccentCatalogue("s", uppercase: true, resetInput: false)
  }
  func testTabletAccentCatalogueAFits() throws { try assertAccentCatalogue("a", uppercase: false) }
  func testTabletAccentCatalogueEFits() throws { try assertAccentCatalogue("e", uppercase: false) }
  func testTabletAccentCatalogueIFits() throws { try assertAccentCatalogue("i", uppercase: false) }
  func testTabletAccentCatalogueOFits() throws { try assertAccentCatalogue("o", uppercase: false) }
  func testTabletAccentCatalogueUFits() throws { try assertAccentCatalogue("u", uppercase: false) }
  func testTabletAccentCatalogueCFits() throws { try assertAccentCatalogue("c", uppercase: false) }
  func testTabletAccentCatalogueNFits() throws { try assertAccentCatalogue("n", uppercase: false) }
  func testTabletAccentCatalogueSFits() throws { try assertAccentCatalogue("s", uppercase: false) }
  func testTabletAccentCatalogueYFits() throws { try assertAccentCatalogue("y", uppercase: false) }
  func testTabletAccentCatalogueZFits() throws { try assertAccentCatalogue("z", uppercase: false) }
  func testTabletAccentCatalogueLFits() throws { try assertAccentCatalogue("l", uppercase: false) }
  func testTabletAccentCatalogueDFits() throws { try assertAccentCatalogue("d", uppercase: false) }
  func testTabletAccentCatalogueRFits() throws { try assertAccentCatalogue("r", uppercase: false) }
  func testTabletAccentCatalogueTFits() throws { try assertAccentCatalogue("t", uppercase: false) }
  func testTabletAccentCatalogueGFits() throws { try assertAccentCatalogue("g", uppercase: false) }
  func testTabletAccentCatalogueHFits() throws { try assertAccentCatalogue("h", uppercase: false) }
  func testTabletAccentCatalogueKFits() throws { try assertAccentCatalogue("k", uppercase: false) }
  func testTabletAccentCatalogueWFits() throws { try assertAccentCatalogue("w", uppercase: false) }
  func testTabletAccentCatalogueUppercaseIFits() throws { try assertAccentCatalogue("i", uppercase: true) }
  func testTabletAccentCatalogueUppercaseSFits() throws { try assertAccentCatalogue("s", uppercase: true) }
  private func assertAccentCatalogue(_ base: String, uppercase: Bool, resetInput: Bool = true) throws {
    let reference = UIDevice.current.userInterfaceIdiom == .pad ? "apple-tablet-letter-reference" : "apple-letter-reference"
    let url = Bundle(for: Self.self).url(forResource: reference, withExtension: "json")!
    let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
    let letterCase = uppercase ? "uppercase" : "lowercase"
    let rows = fixture[letterCase] as! [String: String]
    if resetInput { reset("Cursor") }
    if uppercase { center(key(["Shift"])).tap() }
    pressKey([uppercase ? base.uppercased() : base], duration: 0.7)
    app.buttons["Inspect keyboard state"].tap()
    let state = try readInteractionState()
    XCTAssertEqual(state["lastAccentChoices"] as? [String], rows[base]!.map(String.init), "\(letterCase) \(base) choices")
    XCTAssertEqual(state["lastAccentViolations"] as? [String], [], "\(letterCase) \(base) layout")
  }
  func testSubmitMatchesApple() throws {
    for native in [true, false] {
      mode(native); reset("Cursor")
      let submit = key(["return"])
      center(submit).tap()
      XCTAssertTrue(submit.waitForNonExistence(timeout: 5), "Return must dismiss the keyboard")
      XCTAssertEqual(text, "alpha beta")
      app.buttons["Inspect keyboard state"].tap()
      let state = try readInteractionState()
      XCTAssertEqual(state["focused"] as? Bool, false)
      capture(native ? "apple-submit" : "keyflow-submit")
    }
  }
  func testAllLettersMatchApple() throws {
    for native in [true, false] {
      mode(native); reset("Empty")
      var expected = ""
      for (index, letter) in "qwertyuiopasdfghjklzxcvbnm".enumerated() {
        let value = String(letter)
        expected.append(index == 0 ? value.uppercased() : value)
        tapKey(
          [value, value.uppercased()], expecting: expected,
          context: "\(native ? "Apple" : "Keyflow") letter \(value) was not inserted")
      }
      XCTAssertEqual(text, expected)
      if !native {
        XCTAssertFalse(app.buttons["assistantPaste:forEvent:"].exists, "UIKit must not add its editing toolbar above Keyflow")
        app.buttons["Inspect keyboard state"].tap()
        let state = try readInteractionState()
        let inputBottom = try XCTUnwrap(state["editorBottom"] as? Double)
        let keyboardTop = try XCTUnwrap(state["screenY"] as? Double)
        XCTAssertLessThanOrEqual(inputBottom, keyboardTop + 1, "The autofocus input must remain above the attached keyboard")
      }
      capture(native ? "apple-alphabet" : "keyflow-alphabet")
    }
  }
  func testCancelledLetterDoesNotInsert() {
    var expected = ""
    for native in [true, false] {
      mode(native); reset("Cursor")
      let q = key(["q", "Q"])
      let origin = q.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
      let outside = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: q.frame.midX, dy: max(100, q.frame.minY - q.frame.height * 2)))
      origin.press(forDuration: 0.1, thenDragTo: outside, withVelocity: .slow, thenHoldForDuration: 0.1)
      if max(app.frame.width, app.frame.height) >= 1000 {
        if !native { XCTAssertEqual(text, "alpha beta", "Dragging outside must cancel the Keyflow letter") }
      } else if native { expected = text }
      else { XCTAssertEqual(text, expected, "Dragging out must match Apple") }
      capture(native ? "apple-cancelled-letter" : "keyflow-cancelled-letter")
    }
  }
  func testSymbolPagesMatchApple() {
    for native in [true, false] {
      mode(native); reset("Cursor")
      center(key(["numbers", "123"])).tap()
      capture(native ? "apple-numbers" : "keyflow-numbers")
      center(key(["symbols", "#+="])).tap()
      capture(native ? "apple-symbols" : "keyflow-symbols")
      tapKey(["["], expecting: "alpha beta[", context: "Opening bracket was not inserted")
      center(key(["ABC", "letters"])).tap()
      tapKey(["q"], expecting: "alpha beta[q", context: "Letter after symbol page was not inserted")
      capture(native ? "apple-symbols-return" : "keyflow-symbols-return")
    }
  }
  func testEveryNumberKeyAndPageTransitionMatchesApple() {
    for native in [true, false] {
      mode(native); reset("Empty")
      center(key(["numbers", "123"])).tap()
      XCTAssertTrue(key(["1"]).exists, "123 tap must leave the number page open")
      var expected = ""
      for digit in "1234567890" {
        expected.append(digit)
        tapKey(
          [String(digit)], expecting: expected,
          context: "\(native ? "Apple" : "Keyflow") digit \(digit) was not inserted")
      }
      XCTAssertEqual(text, expected)
      center(key(["symbols", "#+="])).tap()
      XCTAssertTrue(key(["["]).exists)
      expected.append("[")
      tapKey(["["], expecting: expected, context: "Opening bracket was not inserted")
      center(key(["ABC", "letters"])).tap()
      XCTAssertTrue(key(["q", "Q"]).exists, "ABC tap must restore letters")
      expected.append("q")
      tapKey(["q", "Q"], expecting: expected, context: "Letter after number page was not inserted")
      XCTAssertEqual(text, expected)
      capture(native ? "apple-every-number" : "keyflow-every-number")
    }
  }
  func testTabletNativeKeyboardInventory() throws {
    guard max(app.frame.width, app.frame.height) >= 1000 else { throw XCTSkip("iPad audit") }
    mode(true); reset("Empty")
    capture("ipad-apple-letters")
    for item in app.keys.allElementsBoundByIndex where item.frame.midY >= app.frame.height * 0.42 {
      print("KEYFLOW_AUDIT_NATIVE_KEY label=\(item.label.debugDescription) value=\(String(describing: item.value)) frame=\(item.frame)")
    }
    let more = app.keys.matching(identifier: "more").allElementsBoundByIndex.first!
    XCTAssertTrue(more.exists)
    center(more).tap()
    capture("ipad-apple-symbols")
    for item in app.keys.allElementsBoundByIndex where item.frame.midY >= app.frame.height * 0.42 {
      print("KEYFLOW_AUDIT_NATIVE_SYMBOL label=\(item.label.debugDescription) value=\(String(describing: item.value)) frame=\(item.frame)")
    }
  }
  func testTabletKeyflowKeyboardInventory() throws {
    guard max(app.frame.width, app.frame.height) >= 1000 else { throw XCTSkip("iPad audit") }
    mode(false); reset("Empty")
    capture("ipad-keyflow-letters")
    let expectedLetters = ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "A", "S", "D", "F", "G", "H", "J", "K", "L", "Z", "X", "C", "V", "B", "N", "M"]
    for label in expectedLetters { XCTAssertTrue(key([label]).exists, "Missing \(label)") }
    center(key(["123", "numbers"])).tap()
    capture("ipad-keyflow-symbols")
    let trailing = app.frame.width > app.frame.height ? [",", "."] : ["!", "?"]
    for label in ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "@", "#", "$", "&", "*", "(", ")", "'", "\"", "%", "-", "+", "=", "/", ";", ":"] + trailing {
      XCTAssertTrue(key([label]).exists, "Missing tablet symbol \(label)")
    }
  }
  func testTabletCapsLockDoesNotSelectShiftKeys() throws {
    guard max(app.frame.width, app.frame.height) >= 1000 else { throw XCTSkip("iPad audit") }
    mode(false); reset("Empty")
    center(key(["Caps Lock"])).tap()
    let caps = app.descendants(matching: .any).matching(identifier: "Caps Lock").firstMatch
    XCTAssertEqual(caps.value as? String, "On", "Caps Lock must be the only locked action")
    let shifts = app.descendants(matching: .any).matching(identifier: "Shift").allElementsBoundByIndex.filter {
      $0.frame.midY >= app.frame.height * 0.42 && $0.frame.width > 0
    }
    XCTAssertEqual(shifts.count, 2, "iPad must expose two Shift keys")
    for shift in shifts {
      XCTAssertEqual(shift.value as? String, "Off", "Caps Lock must not select a Shift key")
      XCTAssertFalse(shift.isSelected, "Caps Lock must not give Shift the selected trait")
    }
    capture("ipad-caps-lock-only-selected")
  }
  func testTabletNumberPagePortraitHasBothReturnKeys() throws { try assertTabletPageHasBothReturnKeys(symbols: false, orientation: .portrait) }
  func testTabletNumberPageLandscapeHasBothReturnKeys() throws { try assertTabletPageHasBothReturnKeys(symbols: false, orientation: .landscapeRight) }
  func testTabletSymbolPagePortraitHasBothReturnKeys() throws { try assertTabletPageHasBothReturnKeys(symbols: true, orientation: .portrait) }
  func testTabletSymbolPageLandscapeHasBothReturnKeys() throws { try assertTabletPageHasBothReturnKeys(symbols: true, orientation: .landscapeRight) }
  private func assertTabletPageHasBothReturnKeys(symbols: Bool, orientation: UIDeviceOrientation) throws {
    guard max(app.frame.width, app.frame.height) >= 1000 else { throw XCTSkip("iPad audit") }
    setOrientation(orientation)
    mode(false); reset("Empty"); center(key(["123", "numbers"])).tap()
    if symbols { center(key(["#+=", "symbols"])).tap() }
    let predicate = NSPredicate(format: "identifier == 'return' OR identifier == 'keyflow-key-return' OR label == 'return'")
    let returns = app.descendants(matching: .any).matching(predicate).allElementsBoundByIndex.filter {
      $0.frame.midY >= app.frame.height * 0.42 && $0.frame.width > 0
    }
    let layout = "\(orientation == .portrait ? "portrait" : "landscape") \(symbols ? "symbol" : "number")"
    XCTAssertEqual(returns.count, 2, "iPad \(layout) page must have left and right return keys")
    capture("ipad-\(layout.replacingOccurrences(of: " ", with: "-"))-two-return-keys")
  }
  func testPhonePunctuationHoldsMatchApple() throws {
    for symbol in ["$", "-", "'", "\"", "?", "!"] { try assertPunctuationHold(symbol) }
  }
  func testTabletDollarHoldMatchesApple() throws { try assertPunctuationHold("$") }
  func testTabletHyphenHoldMatchesApple() throws { try assertPunctuationHold("-") }
  func testTabletApostropheHoldMatchesApple() throws { try assertPunctuationHold("'") }
  func testTabletQuoteHoldMatchesApple() throws { try assertPunctuationHold("\"") }
  private func assertPunctuationHold(_ symbol: String) throws {
    let tablet = max(app.frame.width, app.frame.height) >= 1000
    if tablet && ["?", "!"].contains(symbol) { throw XCTSkip("Phone punctuation layout") }
    var expected = ""
    for native in [true, false] {
      mode(native); reset("Cursor")
      // Reset's autoFocus presents the remounted input. Waiting for its keys
      // avoids tapping an already-focused caret and opening UIKit's edit menu.
      center(key(["numbers", "123"])).tap()
      let editMenu = app.descendants(matching: .any).matching(NSPredicate(format: "label == 'Select All' OR label == 'AutoFill'")).firstMatch
      XCTAssertFalse(editMenu.exists && editMenu.isHittable, "Punctuation hold must start without an edit menu")
      let source = key([symbol])
      if tablet && symbol == "$" {
        // iPadOS can highlight cents yet cancel a stationary release at the
        // original dollar key. Explicitly enter the popup before releasing.
        // Derive the target from the key frame, not a device-specific point.
        let frame = source.frame
        let origin = center(source)
        let choice = origin.withOffset(CGVector(dx: 0, dy: -frame.height))
        origin.press(forDuration: 1.2, thenDragTo: choice, withVelocity: .slow, thenHoldForDuration: 0.1)
      } else {
        center(source).press(forDuration: 1.2)
      }
      if native {
        let inserted = NSPredicate { [self] _, _ in text != "alpha beta" }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: inserted, object: nil)], timeout: 5), .completed, "Native hold must insert a character")
        expected = text
        XCTAssertNotEqual(expected, "alpha beta", "Native hold must insert a character")
        if tablet && symbol == "$" {
          XCTAssertEqual(expected, "alpha beta¢", "The currency gesture must select cents, not merely type a dollar")
        }
      }
      else { waitForText(expected, context: "Held \(symbol) release must match Apple") }
      capture("\(native ? "apple" : "keyflow")-punctuation-\(symbol.unicodeScalars.first!.value)")
    }
  }
  func testNumbersDragMatchesApple() {
    for native in [true, false] {
      mode(native); reset("Cursor")
      let origin = center(key(["numbers", "123"]))
      let destination = center(key(["q", "Q"]))
      origin.press(forDuration: 0.1, thenDragTo: destination, withVelocity: .slow, thenHoldForDuration: 0)
      waitForText("alpha beta1", context: "Number-page drag must type once")
      XCTAssertTrue(key(["q", "Q"]).exists, "Releasing a number drag should restore letters")
      capture(native ? "apple-number-drag" : "keyflow-number-drag")
    }
  }
  func testSpaceTrackpadMatchesApple() {
    var expected = ""
    for native in [true, false] {
      mode(native); reset("Cursor")
      let origin = center(key(["space", " "]))
      let destination = center(key(["numbers", "123"]))
      origin.press(forDuration: 0.7, thenDragTo: destination, withVelocity: .slow, thenHoldForDuration: 0.1)
      XCTAssertEqual(text, "alpha beta", "Moving the cursor must not insert spaces")
      center(key(["x", "X"])).tap()
      if native {
        let inserted = NSPredicate { [self] _, _ in ["xalpha beta", "Xalpha beta"].contains(text) }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: inserted, object: nil)], timeout: 5), .completed, "Apple trackpad must place the caret before the first letter")
        expected = text
      }
      else { waitForText(expected, context: "Caret position and capitalization must match Apple") }
      capture(native ? "apple-trackpad" : "keyflow-trackpad")
    }
  }
  func testShiftDragMatchesApple() {
    var expected = ""
    for native in [true, false] {
      mode(native); reset("Cursor")
      // Drag to adjacent Z without crossing other letter rows. On iPad,
      // Apple can commit an intermediate letter on the diagonal route to E.
      // Freeze centers before shift changes the accessibility labels.
      let shiftFrame = key(["shift", "Shift"]).frame
      let letterFrame = key(["z", "Z"]).frame
      let origin = app.coordinate(withNormalizedOffset: .zero)
      let shift = origin.withOffset(CGVector(dx: shiftFrame.midX - app.frame.minX, dy: shiftFrame.midY - app.frame.minY))
      let letter = origin.withOffset(CGVector(dx: letterFrame.midX - app.frame.minX, dy: letterFrame.midY - app.frame.minY))
      shift.press(forDuration: 0.1, thenDragTo: letter, withVelocity: .slow, thenHoldForDuration: 0)
      if native { waitForText("alpha betaZ", context: "Apple shift drag"); expected = text }
      else { waitForText(expected, context: "Keyflow shift drag") }
      capture(native ? "apple-shift-drag" : "keyflow-shift-drag")
    }
  }
  func testPhoneLetterPreviewContoursMatchApple() {
    for (letter, duration) in [("Q", 0.8), ("E", 0.3), ("P", 0.8)] {
      assertLetterPreview(letter, duration: duration)
    }
  }
  func testTabletLeftEdgeLetterPreviewContour() { assertLetterPreview("Q", duration: 0.8) }
  func testTabletCenterLetterPreviewContour() { assertLetterPreview("E", duration: 0.3) }
  func testTabletRightEdgeLetterPreviewContour() { assertLetterPreview("P", duration: 0.8) }
  private func assertLetterPreview(_ letter: String, duration: TimeInterval) {
    for native in [true, false] {
      mode(native); reset("Empty")
      pressKey([letter], duration: duration)
      waitForText(letter, context: "\(native ? "Apple" : "Keyflow") \(letter) preview input")
      capture("\(native ? "apple" : "keyflow")-preview-\(letter)")
    }
  }

  // The runner records the entire hold, including the first popup frame.
  func testRemountedInputUsesTheSelectedKeyboardBeforeTyping() {
    for _ in 0..<2 {
      for native in [true, false] {
        mode(native)
        reset("Empty")
        let letter = key(["Q"])
        XCTAssertEqual(letter.identifier.hasPrefix("keyflow-key-"), !native)
        center(letter).tap()
        waitForText("Q", context: "The selected keyboard must type into the remounted input")
      }
    }
  }
  func testRepeatedAccentPresentation() {
    var expected: [String: String] = [:]
    for native in [true, false] {
      mode(native)
      for letter in ["E", "A", "C", "E"] {
        reset("Empty")
        pressKey([letter], duration: 1.2)
        if native {
          let inserted = NSPredicate { [self] _, _ in !text.isEmpty }
          XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: inserted, object: nil)], timeout: 5), .completed, "Native hold must produce a character")
          expected[letter] = text
          XCTAssertFalse(text.isEmpty, "Native hold must produce a character")
        }
        else { waitForText(expected[letter]!, context: "Stationary hold must match Apple") }
        capture("\(native ? "apple" : "keyflow")-held-\(letter)")
      }
    }
  }
  func testMultilineEditorSupportsReturnAndVerticalTrackpad() throws {
    for native in [true, false] {
      mode(native)
      app.buttons["Reset Multiline"].tap()
      let editor = app.textViews.firstMatch
      XCTAssertTrue(editor.waitForExistence(timeout: 5))
      func waitForValue(_ expected: String) {
        let applied = NSPredicate { _, _ in editor.value as? String == expected }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: applied, object: editor)], timeout: 5), .completed)
      }
      waitForValue("alpha\nbeta\ngamma")
      center(key(["Return", "return", "newline"])).tap()
      waitForValue("alpha\nbeta\ngamma\n")
      if !native {
        let space = key(["space"])
        let origin = center(space)
        origin.press(forDuration: 0.7, thenDragTo: origin.withOffset(CGVector(dx: 0, dy: -24)), withVelocity: .slow, thenHoldForDuration: 0.1)
        center(key(["Delete", "delete"])).tap()
        waitForValue("alpha\nbetagamma\n")
        capture("multiline-vertical-trackpad")
      }
    }
  }

  func testAccentDragMatchesApple() {
    var expected = ""
    for native in [true, false] {
      mode(native); reset("Empty")
      let e = key(["E"])
      // Measured accent targets in the English iOS 26.5 E popup. Assert the
      // intended accent so a missing native popup cannot become the reference.
      let origin = center(e)
      let tablet = max(app.frame.width, app.frame.height) >= 1000
      let destination = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: e.frame.midX - (tablet ? 84 : 38) - app.frame.minX, dy: e.frame.midY - (tablet ? 60 : 55) - app.frame.minY))
      origin.press(forDuration: 2, thenDragTo: destination, withVelocity: .slow, thenHoldForDuration: 0.1)
      waitForText(tablet ? "Ě" : "É", context: "\(native ? "Apple" : "Keyflow") drag must select the target accent")
      if native {
        expected = text
      }
      else { XCTAssertEqual(text, expected) }
      capture(native ? "apple-accent-drag" : "keyflow-accent-drag")
    }
  }

  func openLayouts() {
    openLab("Compare layouts & rotation")
    XCTAssertTrue(app.buttons["Check layout"].waitForExistence(timeout: 10))
  }

  func testTabletNativeNumberPadInventory() throws { try assertTabletNativeInventory("Number") }
  func testTabletNativeDecimalPadInventory() throws { try assertTabletNativeInventory("Decimal") }
  func testTabletNativePhonePadInventory() throws { try assertTabletNativeInventory("Phone") }
  private func assertTabletNativeInventory(_ type: String) throws {
    expectsSystemKeyboard = true
    settledKeyboardGeometry = nil
    guard max(app.frame.width, app.frame.height) >= 1000 else { throw XCTSkip("iPad audit") }
    setOrientation(.portrait)
    openLayouts()
    app.descendants(matching: .any).matching(identifier: type).firstMatch.tap()
    app.descendants(matching: .any).matching(identifier: "Native").firstMatch.tap()
    focusLayoutInput()
    capture("ipad-apple-\(type.lowercased())")
    for item in app.keys.allElementsBoundByIndex where item.frame.midY >= app.frame.height * 0.35 {
      print("KEYFLOW_AUDIT_NATIVE_\(type.uppercased()) label=\(item.label.debugDescription) frame=\(item.frame)")
    }
    XCTAssertTrue(key(["1"]).exists, "Native \(type) pad must contain 1")
  }

  func testTabletSecondaryFlickMatchesApple() throws {
    guard max(app.frame.width, app.frame.height) >= 1000 else { throw XCTSkip("iPad audit") }
    var expected = ""
    for native in [true, false] {
      mode(native); reset("Empty")
      let q = key(["Q"])
      let frame = q.frame
      let origin = center(q).withOffset(CGVector(dx: 0, dy: -frame.height * 0.15))
      let destination = center(q).withOffset(CGVector(dx: 0, dy: frame.height * 0.9))
      origin.press(forDuration: 0.05, thenDragTo: destination, withVelocity: .fast, thenHoldForDuration: 0)
      if native { waitForText("1", context: "Apple secondary flick"); expected = text }
      else { waitForText(expected, context: "Q downward flick must type its secondary 1") }
      capture(native ? "ipad-apple-secondary-flick" : "ipad-keyflow-secondary-flick")
    }
  }

  func testTabletNumberPadPortraitParity() throws { try assertTabletInputType("Number", .portrait) }
  func testTabletDecimalPadPortraitParity() throws { try assertTabletInputType("Decimal", .portrait) }
  func testTabletPhonePadPortraitParity() throws { try assertTabletInputType("Phone", .portrait) }
  func testTabletNumberPadLandscapeParity() throws { try assertTabletInputType("Number", .landscapeRight) }
  func testTabletDecimalPadLandscapeParity() throws { try assertTabletInputType("Decimal", .landscapeRight) }
  func testTabletPhonePadLandscapeParity() throws { try assertTabletInputType("Phone", .landscapeRight) }
  private func focusLayoutInput() {
    let field = app.textFields["keyflow-input"]
    XCTAssertTrue(field.waitForExistence(timeout: 5))
    let frame = field.frame
    XCTAssertTrue(app.frame.contains(frame), "Layout input must be inside the visible app")
    let source = expectsSystemKeyboard
      ? "NOT (identifier BEGINSWITH 'keyflow-key-')"
      : "identifier BEGINSWITH 'keyflow-key-'"
    let digit = app.keys.matching(NSPredicate(format: "(label == '1' OR identifier == '1') AND \(source)")).firstMatch
    // Handoffs preserve focus. Do not move a live caret or open UIKit's edit menu.
    if !digit.exists || !digit.isHittable { center(field).tap() }
    let visible = NSPredicate(format: "exists == true AND hittable == true")
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: visible, object: digit)], timeout: 10), .completed, "The selected keyboard must show a hittable 1 key")
  }
  private func assertTabletInputType(_ type: String, _ orientation: UIDeviceOrientation) throws {
    guard max(app.frame.width, app.frame.height) >= 1000 else { throw XCTSkip("iPad audit") }
    setOrientation(orientation)
    openLayouts()
    app.descendants(matching: .any).matching(identifier: type).firstMatch.tap()
    var nativeFrames: [String: CGRect] = [:]
    for custom in [false, true] {
      expectsSystemKeyboard = !custom
      settledKeyboardGeometry = nil
      let modeLabel = custom ? "Custom keyboard" : "Native"
      app.descendants(matching: .any).matching(identifier: modeLabel).firstMatch.tap()
      focusLayoutInput()
      let rawBefore = text
      let before = rawBefore == "Try this layout…" ? "" : rawBefore
      var expected = before
      for digit in "1234567890" {
        let item = key([String(digit)])
        let targetFrame = item.frame
        if !custom { nativeFrames[String(digit)] = targetFrame }
        center(item).tap()
        expected.append(digit)
        // Observe this tap before issuing another. Never replay a missed key.
        let applied = NSPredicate { [self] _, _ in text == expected }
        if !applied.evaluate(with: nil) {
          XCTAssertEqual(
            XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: applied, object: nil)], timeout: 2),
            .completed,
            "\(modeLabel) \(type) digit \(digit) was not inserted; expected \(expected), got \(text), tapped \(targetFrame)"
          )
        }
        XCTAssertEqual(text, expected, "\(modeLabel) \(type) must insert digit \(digit) exactly once")
      }
      if custom {
        for digit in "1234567890" {
          let label = String(digit), frame = key([label]).frame, native = nativeFrames[label]!
          XCTAssertEqual(frame.minX, native.minX, accuracy: 3, "\(type) \(label) x")
          XCTAssertEqual(frame.minY, native.minY, accuracy: 3, "\(type) \(label) y")
          XCTAssertEqual(frame.width, native.width, accuracy: 3, "\(type) \(label) width")
          XCTAssertEqual(frame.height, native.height, accuracy: 3, "\(type) \(label) height")
        }
      }
      capture("ipad-\(orientation == .portrait ? "portrait" : "landscape")-\(type.lowercased())-\(custom ? "keyflow" : "apple")")
    }
  }
  func openLab(_ label: String) {
    let back = app.navigationBars.buttons["Keyflow"]
    XCTAssertTrue(back.waitForExistence(timeout: 5))
    center(back).tap()
    let hidden = NSPredicate { [self] _, _ in
      let firstKey = app.keys.firstMatch
      return !firstKey.exists || !firstKey.isHittable
    }
    XCTAssertEqual(
      XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: hidden, object: nil)], timeout: 10),
      .completed, "Keyboard must dismiss before navigating the lab")
    let card = app.buttons[label]
    func viewport() -> CGRect { app.scrollViews.firstMatch.frame.intersection(app.frame) }
    func visible() -> Bool {
      card.exists && card.isHittable && !card.frame.isEmpty && viewport().contains(card.frame)
    }
    for _ in 0..<8 {
      if visible() { break }
      let region = viewport()
      let targetDelta = card.exists ? region.midY - card.frame.midY : -region.height * 0.35
      let movement = max(-region.height * 0.35, min(region.height * 0.35, targetDelta))
      let origin = app.coordinate(withNormalizedOffset: .zero).withOffset(
        CGVector(dx: region.midX - app.frame.minX, dy: region.midY - app.frame.minY))
      origin.press(
        forDuration: 0.05, thenDragTo: origin.withOffset(CGVector(dx: 0, dy: movement)),
        withVelocity: .slow, thenHoldForDuration: 0)
    }
    var previous = CGRect.null
    var stableSince = ProcessInfo.processInfo.systemUptime
    let ready = NSPredicate { _, _ in
      guard visible() else { return false }
      let frame = card.frame
      let now = ProcessInfo.processInfo.systemUptime
      if frame != previous {
        previous = frame
        stableSince = now
        return false
      }
      return now - stableSince >= 0.3
    }
    let outcome = XCTWaiter.wait(
      for: [XCTNSPredicateExpectation(predicate: ready, object: nil)], timeout: 10)
    if outcome != .completed { capture("lab-card-not-ready") }
    XCTAssertEqual(outcome, .completed, "Lab card must settle fully inside its viewport: \(label)")
    // A partly visible card can be 'hittable' while its midpoint lies outside
    // the scroll viewport. Freeze the fully visible target after deceleration.
    center(card).tap()
  }
  func testTransitionDiagnosticsPass() {
    openLab("Test keyboard transitions")
    let run = app.buttons["Run transition tests"]
    let opened = run.waitForExistence(timeout: 10)
    if !opened { capture("transition-navigation-not-ready") }
    XCTAssertTrue(opened, "Transition screen did not open after its lab card tap")
    center(run).tap()
    let result = app.staticTexts["transition-result"]
    let passed = NSPredicate(format: "label BEGINSWITH 'PASS:' OR value BEGINSWITH 'PASS:'")
    expectation(for: passed, evaluatedWith: result)
    waitForExpectations(timeout: 210)
    capture("transition-diagnostics-pass")
  }
  func testCustomizationMatrixPasses() throws {
    openLab("Customize fonts & test layouts")
    let run = app.descendants(matching: .any).matching(identifier: "customization-run").firstMatch
    XCTAssertTrue(run.waitForExistence(timeout: 30)); run.tap()
    let finished = NSPredicate(format: "label CONTAINS '\"result\":'")
    let outcome = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: finished, object: run)], timeout: 90)
    capture("customization-matrix-result")
    XCTAssertEqual(outcome, .completed, "Customization did not finish: \(run.label)")
    let start = try XCTUnwrap(run.label.firstIndex(of: "{"))
    let data = try XCTUnwrap(String(run.label[start...]).data(using: .utf8))
    let report = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    let cases = try XCTUnwrap(report["cases"] as? [[String: Any]])
    XCTAssertFalse(cases.isEmpty, "The customization matrix must execute")
    let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
    attachment.name = "customization-cases"
    attachment.lifetime = .keepAlways
    add(attachment)
    let previousFailurePolicy = continueAfterFailure
    continueAfterFailure = true
    defer { continueAfterFailure = previousFailurePolicy }
    for item in cases {
      XCTContext.runActivity(named: item["name"] as? String ?? "Unnamed customization case") { _ in
        XCTAssertEqual(item["result"] as? String, "PASS", item["error"] as? String ?? "Missing case result")
      }
    }
    XCTAssertEqual(report["result"] as? String, "PASS", "Customization failed: \(run.label)")
  }
  func testIndependentTransparencyPasses() {
    openLab("Make room for your style.")
    let run = app.buttons["Run transparency checks"]
    run.tap()
    let result = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Transparency test result:'")).firstMatch
    let finished = NSPredicate(format: "label CONTAINS 'PASS' OR label CONTAINS 'FAIL'")
    let outcome = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: finished, object: result)], timeout: 30)
    XCTAssertEqual(outcome, .completed, "Transparency check must finish")
    XCTAssertTrue(result.label.contains("PASS"), result.label)
    capture("independent-transparency-pass")
  }

}
