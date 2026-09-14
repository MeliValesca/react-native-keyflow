import ExpoModulesCore
import UIKit

private final class KeyflowEditor: UITextField {
  var usesCustomKeyboard = true
  var customInputSurface: UIView?
  var customKeyboard: UIView?
  // UIKit can query either property while changing the input set. Resolve both
  // from one mode flag so it never combines the system IME with our accessory.
  override var inputView: UIView? {
    get { usesCustomKeyboard ? customInputSurface : nil }
    set { super.inputView = newValue }
  }
  override var inputAccessoryView: UIView? {
    get { usesCustomKeyboard ? customKeyboard : nil }
    set { super.inputAccessoryView = newValue }
  }
}

final class KeyflowInputView: ExpoView, UITextFieldDelegate {
  let onKeyflowTextChange = EventDispatcher()
  let onKeyflowSubmit = EventDispatcher()
  let onKeyflowModeChange = EventDispatcher()
  let onKeyflowLanguageChange = EventDispatcher()
  private let textField = KeyflowEditor()
  private let keyboard = KeyflowKeyboardView()
  // Keep a nonzero transparent input surface. A zero-height input view makes
  // UIKit report keyboardDidHide on subsequent accessory presentations.
  private let emptyInput = UIView(frame: CGRect(x: 0, y: 0, width: 390, height: 1))
  private var languagesJSON = ""
  private var languages: [KeyflowLanguage] = [.english]
  private var language = KeyflowLanguage.english
  private var hasResolvedLanguage = false
  func setLanguages(_ json: String) {
    languagesJSON = json
    refreshLanguages()
  }
  @objc private func refreshLanguages() {
    let active = UITextInputMode.activeInputModes.compactMap { $0.primaryLanguage }
    let resolved = KeyflowLanguage.resolve(
      json: languagesJSON, preferred: active.isEmpty ? Locale.preferredLanguages : active)
    let next =
      hasResolvedLanguage
      ? (resolved.first { $0.base == language.base } ?? resolved[0]) : resolved[0]
    hasResolvedLanguage = true
    languages = resolved
    selectLanguage(next)
  }
  private func selectLanguage(_ value: KeyflowLanguage) {
    let changed = language != value
    language = value
    keyboard.setLanguage(value, canSwitch: languages.count > 1)
    guard changed else { return }
    onKeyflowLanguageChange(["language": value.language, "layout": value.layout])
    lastSpaceTime = 0
    keyboard.updateContext(beforeCursor())
  }
  private var appliedInitialValue = false
  var initialValue = ""
  var autoFocus = false
  private var didAutoFocus = false
  private var autoFocusScheduled = false
  var autoCorrect = true {
    didSet {
      if !textField.usesCustomKeyboard {
        textField.autocorrectionType = autoCorrect ? .default : .no
      }
    }
  }
  // Shared API parity. iOS does not draw Android-style secondary legends.
  var showSecondaryKeyLabels = true
  private var lastSpaceTime: TimeInterval = 0
  private var needsInputReload = false
  private var reloadScheduled = false
  private var inputReloadCount = 0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    NotificationCenter.default.addObserver(
      self, selector: #selector(orientationChanged),
      name: UIDevice.orientationDidChangeNotification, object: nil)
    NotificationCenter.default.addObserver(
      self, selector: #selector(refreshLanguages),
      name: UIApplication.willEnterForegroundNotification, object: nil)
    textField.delegate = self
    textField.font = .systemFont(ofSize: 18)
    textField.borderStyle = .roundedRect
    textField.autocorrectionType = .no
    textField.spellCheckingType = .no
    emptyInput.backgroundColor = .clear
    emptyInput.heightAnchor.constraint(equalToConstant: 1).isActive = true
    textField.customInputSurface = keyboard
    textField.customKeyboard = nil
    textField.inputAssistantItem.leadingBarButtonGroups = []
    textField.inputAssistantItem.trailingBarButtonGroups = []
    textField.accessibilityIdentifier = "keyflow-input"
    textField.addTarget(self, action: #selector(textChanged), for: .editingChanged)
    addSubview(textField)
    keyboard.onHeightChange = { [weak self] in
      guard let self, self.textField.isFirstResponder else { return }
      self.requestInputReload()
    }
    keyboard.onAction = { [weak self] action in self?.handle(action) }
  }

  deinit { NotificationCenter.default.removeObserver(self) }

  @objc private func orientationChanged() {
    guard UIDevice.current.orientation.isValidInterfaceOrientation else { return }
    // Most rotations are already handled by UIKit and updateViewport.
    // Only repair an accessory that ends up undocked after a same-size reversal;
    // an unconditional completion reload starts a second keyboard animation.
    DispatchQueue.main.async { [weak self] in
      guard let self, self.textField.isFirstResponder,
        self.textField.usesCustomKeyboard, self.textField.customKeyboard != nil
      else { return }
      let refresh: () -> Void = { [weak self] in
        guard let self, let window = self.window, self.textField.isFirstResponder,
          self.textField.usesCustomKeyboard, self.textField.customKeyboard != nil,
          self.keyboard.window != nil
        else { return }
        let frame = self.keyboard.convert(self.keyboard.bounds, to: window)
        let targetBottom = window.bounds.maxY - self.emptyInput.bounds.height
        // Use final on-screen geometry, including host transforms. In the
        // common path there is nothing to reload or synchronously lay out.
        guard abs(frame.maxY - targetBottom) > 1 || abs(frame.width - window.bounds.width) > 1
        else { return }
        self.prepareKeyboardForPresentation()
        self.requestInputReload()
      }
      var responder: UIResponder? = self
      while let current = responder {
        if let controller = current as? UIViewController,
          let coordinator = controller.transitionCoordinator,
          coordinator.animate(alongsideTransition: nil, completion: { _ in refresh() })
        {
          return
        }
        responder = current.next
      }
      refresh()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if let window { keyboard.updateViewport(window.bounds.size, insets: window.safeAreaInsets) }
    textField.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      textField.resignFirstResponder()
    } else {
      if let window { keyboard.updateViewport(window.bounds.size, insets: window.safeAreaInsets) }
      focusIfNeeded()
    }
  }

  func applyProps() {
    if !appliedInitialValue {
      appliedInitialValue = true
      textField.text = initialValue
    }
    if needsInputReload {
      needsInputReload = false
      if textField.isFirstResponder {
        inputReloadCount += 1
        textField.reloadInputViews()
      }
    }
    focusIfNeeded()
  }

  private func requestInputReload() {
    needsInputReload = true
    guard !reloadScheduled else { return }
    reloadScheduled = true
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.reloadScheduled = false
      self.applyProps()
    }
  }

  private func focusIfNeeded() {
    guard autoFocus, appliedInitialValue, !didAutoFocus, !autoFocusScheduled, window != nil else {
      return
    }
    autoFocusScheduled = true
    // Coalesce props before focus. Do not compete with a navigation snapshot.
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      let present: () -> Void = { [weak self] in
        guard let self else { return }
        self.autoFocusScheduled = false
        guard self.autoFocus, !self.didAutoFocus, self.window != nil else { return }
        self.prepareKeyboardForPresentation()
        self.didAutoFocus = self.textField.becomeFirstResponder()
      }
      var responder: UIResponder? = self
      while let current = responder {
        if let controller = current as? UIViewController,
          let coordinator = controller.transitionCoordinator,
          coordinator.animate(alongsideTransition: nil, completion: { _ in present() })
        {
          return
        }
        responder = current.next
      }
      present()
    }
  }

  func setAppearance(_ value: String) {
    let appearance: UIKeyboardAppearance = value == "dark" ? .dark : .light
    keyboard.overrideUserInterfaceStyle = value == "dark" ? .dark : .light
    guard textField.keyboardAppearance != appearance else { return }
    textField.keyboardAppearance = appearance
    requestInputReload()
  }

  func setPlaceholder(_ value: String) { textField.placeholder = value }
  func setInputLabel(_ value: String) { textField.accessibilityLabel = value }
  func setEnabled(_ value: Bool) {
    textField.isEnabled = value
    if !value { textField.resignFirstResponder() }
    alpha = value ? 1 : 0.5
  }
  func setKeyboardType(_ value: String) {
    let type: UIKeyboardType
    switch value {
    case "number-pad": type = .numberPad
    case "decimal-pad": type = .decimalPad
    case "phone-pad": type = .phonePad
    default: type = .default
    }
    guard textField.keyboardType != type else { return }
    textField.keyboardType = type
    keyboard.setKeyboardType(value)
    lastSpaceTime = 0
    requestInputReload()
  }

  func setHaptics(_ value: Bool) { keyboard.hapticsEnabled = value }
  func getKeyboardMetrics() -> [String: Any] {
    var result = keyboard.metrics()
    result["keyboardMode"] = textField.inputView == nil ? "system" : "custom"
    result["focused"] = textField.isFirstResponder
    result["inputReloadCount"] = inputReloadCount
    if let window {
      result["editorBottom"] = textField.convert(textField.bounds, to: window).maxY
      result["screenY"] = keyboard.convert(keyboard.bounds, to: window).minY
    }
    result["text"] = textField.text ?? ""
    result["keyboardLanguage"] = language.language
    result["keyboardLayout"] = language.layout
    result["availableKeyboardLanguages"] = languages.map { $0.language }
    if let range = textField.selectedTextRange {
      result["selectionStart"] = textField.offset(
        from: textField.beginningOfDocument, to: range.start)
      result["selectionEnd"] = textField.offset(from: textField.beginningOfDocument, to: range.end)
    }
    return result
  }
  private func prepareKeyboardForPresentation() {
    refreshLanguages()
    guard textField.usesCustomKeyboard else { return }
    updateInputSurface()
    UIView.performWithoutAnimation {
      keyboard.frame.size.width = window?.bounds.width ?? bounds.width
      keyboard.setNeedsLayout()
      keyboard.layoutIfNeeded()
      keyboard.subviews.forEach { $0.layoutIfNeeded() }
    }
  }
  func textFieldShouldBeginEditing(_ textField: UITextField) -> Bool {
    prepareKeyboardForPresentation()
    return true
  }
  func focus() {
    prepareKeyboardForPresentation()
    textField.becomeFirstResponder()
  }
  func blur() {
    keyboard.cancelInteractions()
    lastSpaceTime = 0
    textField.resignFirstResponder()
  }

  func setTheme(_ json: String) {
    guard let data = json.data(using: .utf8) else { return }
    do {
      let theme = try JSONDecoder().decode(KeyflowTheme.self, from: data)
      guard keyboard.theme != theme else { return }
      // UIKit owns input-view presentation. Cross-dissolving the entire panel
      // creates a snapshot and disrupts keyboard transitions.
      keyboard.theme = theme
      updateInputSurface()
    } catch {
      NSLog("Keyflow: invalid keyboard theme: %@", error.localizedDescription)
    }
  }

  private func updateInputSurface() {
    let theme = keyboard.theme
    // UIKit adds a backdrop behind input views. Translucent themes need an
    // accessory so the app remains visible underneath. Keep that host through
    // the current focus session, even when both opacity sliders reach 100%:
    // swapping back mid-drag loses keyboard-avoidance notifications.
    // On the next presentation an opaque theme can use the normal input view.
    let translucent = [
      theme.background, theme.keyBackground, theme.specialKeyBackground,
      theme.deleteKeyBackground, theme.actionKeyBackground,
    ].contains {
      UIColor(keyflowHex: $0).cgColor.alpha < 1
    }
    let accessory = translucent || (textField.isFirstResponder && textField.customKeyboard != nil)
    let surface: UIView = accessory ? emptyInput : keyboard
    guard textField.customInputSurface !== surface else { return }
    textField.customInputSurface = surface
    textField.customKeyboard = accessory ? keyboard : nil
    keyboard.setInputSurfaceHeight(accessory ? 1 : 0)
    if textField.isFirstResponder { requestInputReload() }
  }

  func setKeyboardMode(_ value: String) {
    let wantsCustom = value == "custom"
    guard (textField.inputView != nil) != wantsCustom else { return }
    let selection = textField.selectedTextRange
    keyboard.reset()
    lastSpaceTime = 0
    // The remote keyboard can reuse the outgoing accessory's height while it
    // installs the system IME. Remove that contribution before requesting it.
    keyboard.setPresentationActive(wantsCustom)
    textField.usesCustomKeyboard = wantsCustom
    textField.autocorrectionType = wantsCustom || !autoCorrect ? .no : .default
    textField.spellCheckingType = wantsCustom ? .no : .default
    requestInputReload()
    textField.selectedTextRange = selection
    keyboard.updateContext(beforeCursor())
  }

  private func handle(_ action: KeyflowAction) {
    guard textField.isEnabled else { return }
    switch action {
    case .text(let value):
      let now = CACurrentMediaTime()
      let before = beforeCursor()
      if value == " ", textField.selectedTextRange?.isEmpty == true, now - lastSpaceTime < 0.7,
        before.hasSuffix(" "), let previous = before.dropLast().last,
        previous.isLetter || previous.isNumber
      {
        textField.deleteBackward()
        textField.insertText(". ")
        lastSpaceTime = 0
      } else {
        textField.insertText(value)
        lastSpaceTime = value == " " ? now : 0
      }
    case .moveCursor(let count):
      guard let selection = textField.selectedTextRange else { return }
      let text = (textField.text ?? "") as NSString
      var offset = textField.offset(from: textField.beginningOfDocument, to: selection.start)
      for _ in 0..<abs(count) {
        if count < 0 && offset > 0 {
          offset = text.rangeOfComposedCharacterSequence(at: offset - 1).location
        } else if count > 0 && offset < text.length {
          offset = NSMaxRange(text.rangeOfComposedCharacterSequence(at: offset))
        }
      }
      if let position = textField.position(from: textField.beginningOfDocument, offset: offset) {
        textField.selectedTextRange = textField.textRange(from: position, to: position)
      }
    case .delete:
      textField.deleteBackward()
    case .submit:
      onKeyflowSubmit(["text": textField.text ?? ""])
      textField.resignFirstResponder()
    case .dismiss:
      textField.resignFirstResponder()
    case .nextLanguage:
      let index = languages.firstIndex(of: language) ?? 0
      selectLanguage(languages[(index + 1) % languages.count])
    case .system:
      setKeyboardMode("system")
      onKeyflowModeChange(["mode": "system"])
    default: break
    }
  }

  private func beforeCursor() -> String {
    guard let range = textField.selectedTextRange,
      let prefix = textField.textRange(from: textField.beginningOfDocument, to: range.start)
    else { return "" }
    return textField.text(in: prefix) ?? ""
  }

  @objc private func textChanged() {
    keyboard.updateContext(beforeCursor())
    let selection = textField.selectedTextRange
    let start =
      selection.map { textField.offset(from: textField.beginningOfDocument, to: $0.start) } ?? 0
    let end =
      selection.map { textField.offset(from: textField.beginningOfDocument, to: $0.end) } ?? start
    onKeyflowTextChange([
      "text": textField.text ?? "", "selectionStart": start, "selectionEnd": end,
    ])
  }

  func textFieldDidChangeSelection(_ textField: UITextField) {
    keyboard.updateContext(beforeCursor())
  }

  func textFieldShouldReturn(_ textField: UITextField) -> Bool {
    onKeyflowSubmit(["text": textField.text ?? ""])
    textField.resignFirstResponder()
    return true
  }
}
