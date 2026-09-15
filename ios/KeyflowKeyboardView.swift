import UIKit

/// UIKit keyboard surface: presentation/insets are owned by iOS, keystrokes stay native.
final class KeyflowKeyboardView: UIView {
  private typealias Page = KeyflowKeyboardPage
  private var landscape = false
  private var viewportSize = CGSize(width: 390, height: 844)
  private var safeInsets = UIEdgeInsets.zero
  private var keyboardType = "default"
  private var language = KeyflowLanguage.english
  private var canSwitchLanguage = false
  func setLanguage(_ value: KeyflowLanguage, canSwitch: Bool) {
    guard language != value || canSwitchLanguage != canSwitch else { return }
    language = value
    canSwitchLanguage = canSwitch
    page = isTablet && keyboardType != "default" ? .numbers : .letters
    capsLocked = false
    manualShift = false
    lastShiftTime = 0
    rebuildKeys()
  }
  // iPhone uses the compact 3x4 pad. iPadOS presents number, decimal, and
  // phone input types with the full-width tablet keyboard on its number page.
  private var isPad: Bool { keyboardType != "default" && !isTablet }
  private var isTablet: Bool { UIDevice.current.userInterfaceIdiom == .pad }
  private var tabletBasis: CGFloat { min(viewportSize.width, viewportSize.height) }
  // iPadOS uses taller rows in landscape. Scale both profiles from the
  // available short edge so mini, 11-inch, and 13-inch windows share the same
  // proportions without device-model branches.
  private var rowHeight: CGFloat {
    isTablet ? tabletBasis * (landscape ? 0.10252 : 0.07734) : (landscape ? 106.0 / 3.0 : 54)
  }
  private var topInset: CGFloat {
    isPad ? (landscape ? 2 : 17) : (isTablet ? tabletBasis * (landscape ? 0.0132 : 0.0084) : 4)
  }
  // The native iPad keyboard reserves its input-assistant band above the key
  // rows. Keyflow leaves it visually empty because predictions are unsupported,
  // but preserves the band so the keys and app avoidance line up with UIKit.
  private var tabletAssistantHeight: CGFloat { isTablet && !isPad ? tabletBasis * 0.06595 : 0 }
  func setKeyboardType(_ value: String) {
    let type = ["number-pad", "decimal-pad", "phone-pad"].contains(value) ? value : "default"
    guard keyboardType != type else { return }
    keyboardType = type
    reset()
  }
  func updateViewport(_ size: CGSize, insets: UIEdgeInsets) {
    let wide = size.width > size.height
    let orientationChanged = landscape != wide
    let changed = landscape != wide || safeInsets != insets || viewportSize != size
    landscape = wide
    safeInsets = insets
    viewportSize = size
    let inset: CGFloat
    if isTablet {
      inset =
        wide
        ? max(0, insets.bottom - tabletBasis * 0.005, tabletBasis * 0.0192)
        : max(0, insets.bottom - tabletBasis * 0.006, tabletBasis * 0.018)
    } else {
      inset = wide ? insets.bottom : (insets.bottom > 0 ? insets.bottom + 39 : 8)
    }
    guard changed || bottomInset != inset else { return }
    bottomInset = inset
    cancelTouches()
    if isTablet && orientationChanged {
      rebuildKeys()
      return
    }
    // Rotation changes geometry, not the key set. Keep the existing views
    // attached while UIKit rotates the keyboard host.
    updateHeight(notify: true)
    if isPad && rows.count == 4 {
      let phoneSymbols = keyboardType == "phone-pad" && page == .symbols
      rows[3][0].padUnfilled = !(phoneSymbols && landscape)
      if phoneSymbols { rows[3][1].padUnfilled = landscape }
    }
    rows.flatMap { $0 }.forEach { $0.setNeedsLayout() }
    setNeedsLayout()
    superview?.setNeedsLayout()
  }
  private static let panelHeight: CGFloat = 334
  // Preserve the native portrait typing position even without dock controls.
  // The dock includes ergonomic clearance above the home-indicator safe area.
  private var bottomInset: CGFloat = 73
  private var inputSurfaceHeight: CGFloat = 0
  private let panelBackground = UIView()
  private let panelMask = CAShapeLayer()
  private let panelBottom = UIView()
  private var preferredHeight: CGFloat = panelHeight
  private var presentationActive = true
  private var heightConstraint: NSLayoutConstraint!
  var onHeightChange: (() -> Void)?
  var onFrameChange: (() -> Void)?
  private static let repeatDelay: TimeInterval = 0.5
  private static let repeatInterval: TimeInterval = 0.065
  private var page = Page.letters
  private var shifted = true
  private var manualShift = false
  private var capsLocked = false
  private var lastShiftTime: TimeInterval = 0
  private var rows: [[KeyflowKey]] = []
  private var typingTop: CGFloat { tabletAssistantHeight + topInset }
  private var holdWork: DispatchWorkItem?
  private var heldTouch: ObjectIdentifier?
  private var heldOrigin: CGPoint = .zero
  private var cursorMode = false
  private var cursorOriginX: CGFloat = 0
  private var cursorOriginY: CGFloat = 0
  private var accentKeys: [KeyflowKey] = []
  private var selectedAccent: KeyflowKey?
  private let accentCallout = KeyflowCallout()
  private let accentSelectionIndicator = UIView()
  private var accentSource = CGRect.zero
  private var accentItemWidth: CGFloat = 0
  private var lastAccentChoices: [String] = []
  private var lastAccentViolations: [String] = []
  // Captured from the iOS 26.5 English keyboard, including its base position.
  private static let accents: [String: String] = [
    "a": "aàáâäǎæãåāăą", "e": "ëéeèêěẽēėę", "i": "įıīĩïíìiîǐ", "o": "őōõøœǒöóòoô",
    "u": "ųůűũüúùuûǔū", "c": "cçćčċ", "n": "ňņńñn", "s": "sßşșśš", "y": "ÿŷýy", "z": "zźžż",
    "l": "ĺľļłl", "d": "dďð", "r": "rř", "t": "tțťþ", "g": "gğġ", "h": "hħ", "k": "ķk", "w": "wŵ",
    "$": "€£¥₩₹¢", "€": "$£¥₩₹¢", "-": "–—•", "?": "¿", "!": "¡", "'": "‘’", "\"": "“”",
  ]
  private static let uppercaseAccents = ["i": "ĮİĪĨÏÍÌIÎǏ", "s": "SßŚŠŞȘ"]
  private var touchesByID: [ObjectIdentifier: KeyflowKey] = [:]
  private var originalKeysByID: [ObjectIdentifier: KeyflowKey] = [:]
  private var originsByID: [ObjectIdentifier: CGPoint] = [:]
  private var tabletFlickTouches: Set<ObjectIdentifier> = []
  private var pageSwitchTouches: Set<ObjectIdentifier> = []
  private var temporaryNumberTouch: ObjectIdentifier?
  private var deleteOwner: ObjectIdentifier?
  private var deleteTimer: Timer?
  var hapticFeedback: () -> Void = {
    let generator = UIImpactFeedbackGenerator(style: .light)
    return { generator.impactOccurred() }
  }()
  var onAction: ((KeyflowAction) -> Void)?
  var hapticsEnabled = false
  var theme = KeyflowTheme() { didSet { if oldValue != theme { applyTheme() } } }

  init() {
    // UIInputView.Style.default adds its own blur even with a clear color.
    // An ordinary UIView can also serve as the clear accessory host for transparent themes.
    super.init(frame: CGRect(x: 0, y: 0, width: 390, height: Self.panelHeight))
    isOpaque = false
    insertSubview(panelBackground, at: 0)
    panelBackground.isUserInteractionEnabled = false
    panelBackground.isOpaque = false
    panelBottom.isOpaque = false
    panelBackground.layer.mask = panelMask
    panelBackground.addSubview(panelBottom)
    translatesAutoresizingMaskIntoConstraints = false
    heightConstraint = heightAnchor.constraint(equalToConstant: Self.panelHeight)
    heightConstraint.isActive = true
    isMultipleTouchEnabled = true
    isExclusiveTouch = false
    addSubview(accentCallout)
    addSubview(accentSelectionIndicator)
    accentCallout.isHidden = true
    accentSelectionIndicator.isHidden = true
    accentSelectionIndicator.isUserInteractionEnabled = false
    accentCallout.isUserInteractionEnabled = false
    rebuildKeys()
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }
  deinit { stopDeleteRepeat() }
  override var intrinsicContentSize: CGSize {
    CGSize(width: UIView.noIntrinsicMetric, height: presentationActive ? preferredHeight : 0)
  }

  func setPresentationActive(_ active: Bool) {
    presentationActive = active
    let height = active ? preferredHeight : 0
    heightConstraint.constant = height
    frame.size.height = height
    invalidateIntrinsicContentSize()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil { cancelTouches() }
    onFrameChange?()
  }

  func metrics() -> [String: Any] {
    layoutIfNeeded()
    let keys = presentationActive ? rows.flatMap { $0 } : []
    var failures: [String] = []
    for (index, key) in keys.enumerated() {
      key.layoutIfNeeded()
      if !bounds.insetBy(dx: -0.5, dy: -0.5).contains(key.frame) {
        failures.append("Outside keyboard: \(key.caption)")
      }
      if !key.labelFits { failures.append("Label overflow: \(key.caption)") }
      if keys.dropFirst(index + 1).contains(where: {
        $0.frame.intersection(key.frame).width > 0.5
          && $0.frame.intersection(key.frame).height > 0.5
      }) {
        failures.append("Overlapping key: \(key.caption)")
      }
    }
    return [
      "padFonts": Array(Set(keys.compactMap { $0.resolvedPadFontName })).sorted(),
      "keyFrames": keys.filter { $0.isAccessibilityElement && $0.alpha > 0.5 }.map {
        item -> [String: Any] in
        let rect = item.convert(item.bounds, to: nil)
        return [
          "label": item.caption, "x": rect.minX, "y": rect.minY, "width": rect.width,
          "height": rect.height,
        ]
      }, "width": bounds.width, "height": bounds.height, "keyCount": keys.count,
      "violations": failures, "fonts": Array(Set(keys.map { $0.resolvedFontName })).sorted(),
      "keyboardType": keyboardType, "landscape": landscape,
      "keyboardPage": String(describing: page),
      "keyIdentities": keys.map { String(describing: ObjectIdentifier($0)) },
      "lastAccentChoices": lastAccentChoices, "lastAccentViolations": lastAccentViolations,
    ]
  }

  func setInputSurfaceHeight(_ value: CGFloat) {
    guard inputSurfaceHeight != value else { return }
    inputSurfaceHeight = value
    rebuildKeys()
  }

  func reset() {
    cancelTouches()
    page = isTablet && keyboardType != "default" ? .numbers : .letters
    shifted = true
    manualShift = false
    capsLocked = false
    lastShiftTime = 0
    rebuildKeys()
  }

  func cancelInteractions() { cancelTouches() }

  override func layoutSubviews() {
    super.layoutSubviews()
    // Clip only the background siblings, never the keys or callouts.
    // Round only the panel's top corners. The bottom surface reaches the
    // screen edges; the device supplies its own physical corner clipping.
    UIView.performWithoutAnimation {
      panelBackground.frame = bounds
      panelBottom.frame = panelBackground.bounds
      panelMask.frame = panelBackground.bounds
      panelMask.path =
        UIBezierPath(
          roundedRect: panelBackground.bounds, byRoundingCorners: [.topLeft, .topRight],
          cornerRadii: CGSize(width: 28, height: 28)
        ).cgPath
    }
    KeyflowKeyboardLayout(
      isTablet: isTablet, isPad: isPad, landscape: landscape,
      viewportSize: viewportSize, safeInsets: safeInsets, tabletBasis: tabletBasis,
      rowHeight: rowHeight, typingTop: typingTop,
      canSwitchLanguage: canSwitchLanguage, page: page
    ).apply(to: rows, in: bounds)
    onFrameChange?()
  }

  private func key(_ caption: String, _ action: KeyflowAction, symbol: String? = nil) -> KeyflowKey
  {
    let view = KeyflowKey(caption, action: action, symbol: symbol)
    view.theme = theme
    view.onActivate = { [weak self, weak view] in
      guard let self, let view else { return }
      let wasChoice = view.isSelectionChoice
      activate(view)
      if wasChoice {
        cancelTouches()
        UIAccessibility.post(notification: .layoutChanged, argument: self)
      }
    }
    if case .text(let value) = action, Self.accents[value] != nil {
      view.accessibilityCustomActions = [
        UIAccessibilityCustomAction(name: "Show accents") { [weak self, weak view] _ in
          guard let self, let view else { return false }
          self.showAccents(for: view, value: value)
          UIAccessibility.post(notification: .layoutChanged, argument: self.accentKeys.first)
          return true
        }
      ]
    }
    addSubview(view)
    return view
  }

  private func updateHeight(notify: Bool) {
    // UIKit's tablet number keyboards reserve five more points above their
    // first key row than the alphabetic surface. Preserve that frame height so
    // the custom pad remains aligned with the system pad in both orientations.
    let tabletPadTopReserve: CGFloat = isTablet && keyboardType != "default" ? 5 : 0
    let targetHeight =
      tabletAssistantHeight + topInset + 4 * rowHeight + bottomInset + tabletPadTopReserve
      + (isPad && !landscape ? 1 : 0) - inputSurfaceHeight
    let heightChanged = preferredHeight != targetHeight
    preferredHeight = targetHeight
    heightConstraint.constant = presentationActive ? targetHeight : 0
    invalidateIntrinsicContentSize()
    if heightChanged && notify { onHeightChange?() }
  }

  private func rebuildKeys() {
    cancelTouches()
    updateHeight(notify: true)
    rows.flatMap { $0 }.forEach { $0.removeFromSuperview() }
    rows = KeyflowKeyRows(
      isPad: isPad, isTablet: isTablet, landscape: landscape,
      keyboardType: keyboardType, language: language,
      canSwitchLanguage: canSwitchLanguage, rowHeight: rowHeight, page: page,
      makeKey: { [unowned self] caption, action, symbol in self.key(caption, action, symbol: symbol)
      }
    ).makeRows()
    applyCase()
    applyTheme()
    updateAccessibleKeys()
    let accessibleKeys: [KeyflowKey] = rows.flatMap { $0 }.filter(\.isAccessibilityElement)
    accessibilityElements = accessibleKeys
    setNeedsLayout()
  }

  private func applyTheme() {
    if !accentCallout.isHidden { accentCallout.configure(theme.styled("preview")) }
    for item in accentKeys {
      var popupTheme = theme
      popupTheme.keyBackground = "#00000000"
      popupTheme.pressedKeyBackground = theme.selectedKeyBackground
      item.theme = popupTheme
    }
    backgroundColor = .clear
    panelBottom.backgroundColor = UIColor(keyflowHex: theme.background)
    for key in rows.flatMap({ $0 }) { key.theme = theme }
    setNeedsLayout()
  }

  private func updateAccessibleKeys() {
    accessibilityElements =
      accentKeys.isEmpty ? rows.flatMap { $0 }.filter(\.isAccessibilityElement) : accentKeys
  }

  private func resolvedText(_ value: String) -> String {
    guard page == .letters else { return value }
    if isTablet && manualShift {
      if value == "," { return "!" }
      if value == "." { return "?" }
    }
    return shifted ? value.uppercased() : value
  }

  private func consumeShift() {
    manualShift = false
    shifted = capsLocked
    applyCase()
  }

  private func applyCase() {
    guard page == .letters else { return }
    for key in rows.flatMap({ $0 }) {
      if case .text(let value) = key.action, value != " " && value != "\t" {
        key.caption = resolvedText(value)
        if isTablet && (value == "," || value == ".") {
          key.tabletAlternate = manualShift ? nil : (value == "," ? "!" : "?")
        }
      } else if key.action == .shift {
        // iPad has a separate Caps Lock key. Locking it must not make both
        // Shift controls look selected or replace their glyphs with locks.
        let shiftSelected = shifted && !(isTablet && capsLocked)
        key.isLatched = shiftSelected
        key.setSymbol(
          !isTablet && capsLocked ? "capslock.fill" : (shiftSelected ? "shift.fill" : "shift"))
        key.accessibilityValue =
          !isTablet && capsLocked ? "Caps Lock" : (shiftSelected ? "On" : "Off")
      } else if key.action == .capsLock {
        key.isLatched = capsLocked
        key.setSymbol(capsLocked ? "capslock.fill" : "capslock")
        key.accessibilityValue = capsLocked ? "On" : "Off"
      }
    }
  }

  func updateContext(_ beforeCursor: String) {
    guard !capsLocked else { return }
    manualShift = false
    let trimmed = beforeCursor.trimmingCharacters(in: .whitespaces)
    shifted =
      beforeCursor.isEmpty || beforeCursor.hasSuffix("\n")
      || (beforeCursor.hasSuffix(" ") && trimmed.last.map { ".!?".contains($0) } == true)
    applyCase()
  }

  private func activate(_ key: KeyflowKey) {
    if hapticsEnabled { hapticFeedback() }
    switch key.action {
    case .shift:
      let now = CACurrentMediaTime()
      if now - lastShiftTime < 0.3 {
        capsLocked = true
        shifted = true
      } else {
        capsLocked = false
        shifted.toggle()
      }
      manualShift = shifted && !capsLocked
      lastShiftTime = now
      applyCase()
    case .capsLock:
      lastShiftTime = 0
      capsLocked.toggle()
      manualShift = false
      shifted = capsLocked
      applyCase()
    case .numbers:
      page = .numbers
      rebuildKeys()
    case .symbols:
      page = .symbols
      rebuildKeys()
    case .letters:
      page = .letters
      rebuildKeys()
    case .text(let value):
      let output = resolvedText(value)
      consumeShift()
      onAction?(.text(output))
      if page != .letters && (value == " " || (isPad && keyboardType == "phone-pad")) {
        page = .letters
        rebuildKeys()
      }
    default: onAction?(key.action)
    }
  }

  private func keyAt(_ point: CGPoint) -> KeyflowKey? {
    guard bounds.contains(point) else { return nil }
    // Tile frames include the visual gutters. The empty dock never types.
    return (rows.flatMap { $0 }).first {
      $0.frame.contains(point) && $0.alpha > 0.5 && $0.isAccessibilityElement
    }
  }

  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
    super.touchesBegan(touches, with: event)
    for touch in touches {
      guard var key = keyAt(touch.location(in: self)) else { continue }
      let id = ObjectIdentifier(touch)
      if [.numbers, .symbols, .letters].contains(key.action) {
        let temporary = page == .letters && key.action == .numbers
        activate(key)
        layoutIfNeeded()
        guard let replacement = keyAt(touch.location(in: self)) else { continue }
        key = replacement
        pageSwitchTouches.insert(id)
        if temporary { temporaryNumberTouch = id }
      }
      touchesByID[id] = key
      originalKeysByID[id] = key
      originsByID[id] = touch.location(in: self)
      key.isPressed = true
      heldTouch = id
      heldOrigin = touch.location(in: self)
      // Apple applies shift at touch-down, allowing one continuous shift-to-
      // letter gesture. Activating only on release loses the modifier on drag.
      if key.action == .shift { activate(key) }
      if case .text(let value) = key.action, value == " " || Self.accents[value] != nil {
        holdWork?.cancel()
        let work = DispatchWorkItem { [weak self, weak key] in
          guard let self, let key, touchesByID[id] === key else { return }
          key.isPressed = false
          if value == " " {
            cursorOriginX = heldOrigin.x
            cursorOriginY = heldOrigin.y
            onAction?(.beginCursorMovement)
            setCursorMode(true)
            if hapticsEnabled { hapticFeedback() }
          } else {
            showAccents(for: key, value: value)
          }
        }
        holdWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45, execute: work)
      }
      bringSubviewToFront(key)
      if key.action == .delete {
        activate(key)
        startDeleteRepeat(id)
      }
    }
  }

  override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
    super.touchesMoved(touches, with: event)
    for touch in touches {
      let id = ObjectIdentifier(touch)
      guard let previous = touchesByID[id] else { continue }
      let point = touch.location(in: self)
      if isTablet, let original = originalKeysByID[id], original.tabletAlternate != nil,
        let origin = originsByID[id], point.y - origin.y >= min(28, rowHeight * 0.34)
      {
        holdWork?.cancel()
        previous.isPressed = false
        touchesByID[id] = original
        original.isPressed = true
        tabletFlickTouches.insert(id)
        continue
      }
      if cursorMode && id == heldTouch {
        onAction?(.moveCursor(CGPoint(x: point.x - cursorOriginX, y: point.y - cursorOriginY)))
        continue
      }
      if !accentKeys.isEmpty && id == heldTouch {
        let hitBand =
          isTablet
          ? CGRect(
            x: accentCallout.frame.minX, y: accentCallout.frame.minY - 28,
            width: accentCallout.frame.width,
            height: accentSource.maxY - accentCallout.frame.minY + 56)
          : CGRect(
            x: accentKeys.first!.frame.minX, y: accentKeys.first!.frame.minY - 28,
            width: accentKeys.last!.frame.maxX - accentKeys.first!.frame.minX,
            height: accentSource.maxY - accentKeys.first!.frame.minY + 56)
        let nextAccent: KeyflowKey?
        if hitBand.contains(point) {
          nextAccent = accentKeys.min { left, right in
            let leftY = abs(left.frame.midY - point.y), rightY = abs(right.frame.midY - point.y)
            return leftY == rightY
              ? abs(left.frame.midX - point.x) < abs(right.frame.midX - point.x) : leftY < rightY
          }
          // UIKit snaps to a whole cell in both axes; Android follows the finger.
          UIView.performWithoutAnimation {
            accentSelectionIndicator.center = nextAccent!.center
          }
        } else {
          nextAccent = nil
        }
        if nextAccent !== selectedAccent {
          selectedAccent?.isPressed = false
          selectedAccent = nextAccent
          selectedAccent?.isPressed = accentKeys.count > 1
          if nextAccent != nil && hapticsEnabled { hapticFeedback() }
          accentSelectionIndicator.isHidden = nextAccent == nil || accentKeys.count == 1
        }
        continue
      }
      let next = keyAt(touch.location(in: self))
      if previous === next { continue }
      holdWork?.cancel()
      previous.isPressed = false
      if deleteOwner == id { stopDeleteRepeat() }
      // Preserve the touch while it crosses a gutter so it can enter another key.
      // Release outside a key is still cancelled below.
      if let next { touchesByID[id] = next }
      next?.isPressed = true
      if let next { bringSubviewToFront(next) }
    }
  }

  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
    super.touchesEnded(touches, with: event)
    for touch in touches {
      let id = ObjectIdentifier(touch)
      guard let key = touchesByID.removeValue(forKey: id) else { continue }
      let switchedPage = pageSwitchTouches.remove(id) != nil
      if tabletFlickTouches.remove(id) != nil, let alternate = originalKeysByID[id]?.tabletAlternate
      {
        holdWork?.cancel()
        key.isPressed = false
        onAction?(.text(alternate))
        consumeShift()
        originalKeysByID.removeValue(forKey: id)
        originsByID.removeValue(forKey: id)
        continue
      }
      let restoreLetters: Bool
      if case .text = key.action {
        restoreLetters = temporaryNumberTouch == id
      } else {
        restoreLetters = false
      }
      holdWork?.cancel()
      if cursorMode && id == heldTouch {
        let point = touch.location(in: self)
        onAction?(.moveCursor(CGPoint(x: point.x - cursorOriginX, y: point.y - cursorOriginY)))
        cancelTouches()
        continue
      }
      if !accentKeys.isEmpty && id == heldTouch {
        if let selectedAccent { onAction?(selectedAccent.action) }
        cancelTouches()
        continue
      }
      if deleteOwner == id { stopDeleteRepeat() }
      key.isPressed = false
      if keyAt(touch.location(in: self)) === key
        && key.action != .delete && key.action != .shift
        && !(switchedPage && [.numbers, .symbols, .letters].contains(key.action))
      {
        activate(key)
      }
      if restoreLetters && page != .letters {
        page = .letters
        rebuildKeys()
      }
      if temporaryNumberTouch == id { temporaryNumberTouch = nil }
      originalKeysByID.removeValue(forKey: id)
      originsByID.removeValue(forKey: id)
    }
  }

  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
    super.touchesCancelled(touches, with: event)
    cancelTouches()
  }

  private func startDeleteRepeat(_ id: ObjectIdentifier) {
    stopDeleteRepeat()
    deleteOwner = id
    // Schedule on the UI run loop so a held key keeps repeating during tracking.
    // The initial deletion is handled by touch-down; this timer starts later.
    let repeatTimer = Timer(timeInterval: Self.repeatInterval, repeats: true) { [weak self] timer in
      guard let self, self.deleteOwner == id,
        let key = self.touchesByID[id], key.action == .delete
      else {
        timer.invalidate()
        return
      }
      self.activate(key)
    }
    repeatTimer.fireDate = Date(timeIntervalSinceNow: Self.repeatDelay)
    deleteTimer = repeatTimer
    RunLoop.main.add(repeatTimer, forMode: .common)
  }

  private func stopDeleteRepeat() {
    deleteOwner = nil
    deleteTimer?.invalidate()
    deleteTimer = nil
  }

  private func showAccents(for key: KeyflowKey, value: String) {
    guard let lower = Self.accents[value] else { return }
    if hapticsEnabled { hapticFeedback() }
    let alternatives = shifted ? Self.uppercaseAccents[value] ?? lower.uppercased() : lower
    let base = shifted ? value.uppercased() : value
    let values =
      alternatives.contains(base)
      ? alternatives.map(String.init) : [base] + alternatives.map(String.init)
    let tablet = isTablet
    let choiceRows =
      tablet ? KeyflowTabletAccents.choices(for: value, shifted: shifted) ?? [values] : [values]
    let choices = choiceRows.flatMap { $0 }
    let initial = tablet ? KeyflowTabletAccents.initial[value] ?? base : base
    let initialValue = shifted && initial != "ß" ? initial.uppercased() : initial
    let selected = choices.firstIndex(of: initialValue) ?? 0
    let columns = choiceRows.map(\.count).max() ?? 1
    let selectedRow = choiceRows.firstIndex { $0.contains(choices[selected]) } ?? 0
    let selectedColumn = choiceRows[selectedRow].firstIndex(of: choices[selected]) ?? 0
    let leftInset = landscape ? safeInsets.left : 0
    let rightInset = landscape ? safeInsets.right : 0
    let padding: CGFloat = tablet ? 8 : 10
    let verticalPadding: CGFloat = tablet ? 1 : 10
    let desiredItemWidth: CGFloat = tablet ? 32 : 42
    let itemWidth = min(
      desiredItemWidth,
      (bounds.width - leftInset - rightInset - 8 - 2 * padding) / CGFloat(columns))
    let itemHeight: CGFloat = tablet ? 72 : 48
    let popupHeight = itemHeight * CGFloat(choiceRows.count) + 2 * verticalPadding
    let selectedOffset =
      (CGFloat(columns - choiceRows[selectedRow].count) / 2 + CGFloat(selectedColumn) + 0.5)
      * itemWidth
    let start = max(
      leftInset + 4 + padding,
      min(
        key.frame.midX - selectedOffset,
        bounds.width - rightInset - CGFloat(columns) * itemWidth - 4 - padding))
    let top = key.frame.minY - popupHeight + (tablet ? -4 : 1)
    accentItemWidth = itemWidth
    accentSource = key.frame
    accentCallout.frame = CGRect(
      x: start - padding, y: top, width: itemWidth * CGFloat(columns) + 2 * padding,
      height: popupHeight)
    accentCallout.cornerRadius = tablet ? 8 : 10
    accentCallout.bubble = accentCallout.bounds
    accentCallout.stem = .zero
    accentCallout.configure(theme.styled("preview"))
    accentCallout.isHidden = false
    bringSubviewToFront(accentCallout)

    let indicatorSize = CGSize(width: tablet ? 30 : 38, height: tablet ? 52 : 40)
    accentSelectionIndicator.bounds = CGRect(origin: .zero, size: indicatorSize)
    accentSelectionIndicator.center = CGPoint(
      x: start + selectedOffset,
      y: top + verticalPadding + (CGFloat(selectedRow) + 0.5) * itemHeight)
    accentSelectionIndicator.layer.cornerRadius = tablet ? 8 : 10
    accentSelectionIndicator.backgroundColor = UIColor(
      keyflowHex: theme.sections?["selection"]?.background ?? theme.selectedKeyBackground)
    accentSelectionIndicator.isHidden = choices.count == 1
    bringSubviewToFront(accentSelectionIndicator)

    accentKeys = choiceRows.enumerated().flatMap { rowIndex, row in
      row.enumerated().map { index, text in
        let item = self.key(text, .text(text))
        var popupTheme = theme
        popupTheme.keyBackground = "#00000000"
        popupTheme.pressedKeyBackground = "#00000000"
        item.isSelectionChoice = true
        item.theme = popupTheme
        item.frame = CGRect(
          x: start + (CGFloat(columns - row.count) / 2 + CGFloat(index)) * itemWidth,
          y: top + verticalPadding + CGFloat(rowIndex) * itemHeight, width: itemWidth,
          height: itemHeight)
        item.allowsPreview = false
        bringSubviewToFront(item)
        return item
      }
    }
    selectedAccent = accentKeys[selected]
    selectedAccent?.isPressed = choices.count > 1
    lastAccentChoices = choices
    lastAccentViolations = accentKeys.compactMap { item in
      item.layoutIfNeeded()
      return item.frame.minX >= 0 && item.frame.maxX <= bounds.width
        && accentCallout.frame.contains(item.frame) && item.labelFits
        ? nil : "Accent does not fit: \(item.caption)"
    }
    updateAccessibleKeys()
  }

  override func accessibilityPerformEscape() -> Bool {
    guard !accentKeys.isEmpty else { return false }
    cancelTouches()
    UIAccessibility.post(notification: .layoutChanged, argument: self)
    return true
  }

  private func setCursorMode(_ active: Bool) {
    guard cursorMode != active else { return }
    cursorMode = active
    UIView.animate(
      withDuration: UIAccessibility.isReduceMotionEnabled ? 0 : 0.2,
      delay: 0,
      options: [.beginFromCurrentState, .allowUserInteraction, .curveEaseOut]
    ) {
      self.rows.flatMap { $0 }.forEach { $0.hidesLegend = active }
    }
  }

  private func cancelTouches() {
    holdWork?.cancel()
    holdWork = nil
    heldTouch = nil
    setCursorMode(false)
    accentKeys.forEach { $0.removeFromSuperview() }
    accentKeys = []
    selectedAccent = nil
    accentCallout.isHidden = true
    accentSelectionIndicator.isHidden = true
    accentItemWidth = 0
    updateAccessibleKeys()
    touchesByID.values.forEach { $0.isPressed = false }
    touchesByID.removeAll()
    originalKeysByID.removeAll()
    originsByID.removeAll()
    tabletFlickTouches.removeAll()
    pageSwitchTouches.removeAll()
    temporaryNumberTouch = nil
    stopDeleteRepeat()
  }
}
