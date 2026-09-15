import ExpoModulesCore
import UIKit

final class KeyflowInputView: ExpoView {
  var onKeyflowModeChange: (([String: Any]) -> Void)?
  var onKeyflowFrameChange: (([String: Any]) -> Void)?
  private var lastKeyboardFrame: CGRect?
  var onKeyflowLanguageChange: (([String: Any]) -> Void)?
  private weak var attachedEditor: (UIView & UITextInput)?
  private let cursorNavigator = KeyflowCursorNavigator()
  private var usesCustomKeyboard = true
  private var customInputSurface: UIView?
  private var customKeyboard: UIView?
  private var savedInputView: UIView?
  private var savedAccessoryView: UIView?
  private var savedAutocorrection = UITextAutocorrectionType.default
  private var savedSpellChecking = UITextSpellCheckingType.default
  private var savedLeadingBarButtonGroups: [UIBarButtonItemGroup] = []
  private var savedTrailingBarButtonGroups: [UIBarButtonItemGroup] = []

  private func synchronizeInputAssistant() {
    guard let field = attachedEditor else { return }
    field.inputAssistantItem.leadingBarButtonGroups =
      usesCustomKeyboard ? [] : savedLeadingBarButtonGroups
    field.inputAssistantItem.trailingBarButtonGroups =
      usesCustomKeyboard ? [] : savedTrailingBarButtonGroups
  }

  private func synchronizeInputSurface() {
    guard let textField = attachedEditor else { return }
    let surface = usesCustomKeyboard ? customInputSurface : nil
    let accessory = usesCustomKeyboard ? customKeyboard : savedAccessoryView
    guard textField.inputView !== surface || textField.inputAccessoryView !== accessory else {
      return
    }
    textField.keyflowSetInputViews(surface, accessory: accessory)
    if textField.isFirstResponder { requestInputReload() }
  }

  func attachInput(_ tag: Int?) throws {
    guard let tag else {
      detachInput()
      return
    }
    func findEditor(_ view: UIView) -> (UIView & UITextInput)? {
      if view is UITextField || view is UITextView { return view as? (UIView & UITextInput) }
      return view.subviews.lazy.compactMap { findEditor($0) }.first
    }
    guard let view = appContext?.findView(withTag: tag, ofType: UIView.self),
      let field = findEditor(view)
    else {
      throw NSError(
        domain: "Keyflow", code: 1,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Keyflow requires a React Native TextInput ref."
        ])
    }
    if attachedEditor !== field {
      detachInput()
      attachedEditor = field
      savedInputView = field.inputView
      savedAccessoryView = field.inputAccessoryView
      savedAutocorrection = field.keyflowAutocorrection
      savedSpellChecking = field.keyflowSpellChecking
      savedLeadingBarButtonGroups = field.inputAssistantItem.leadingBarButtonGroups
      savedTrailingBarButtonGroups = field.inputAssistantItem.trailingBarButtonGroups
      if let control = field as? UITextField {
        control.addTarget(self, action: #selector(textChanged), for: .editingChanged)
        control.addTarget(self, action: #selector(providedInputBeganEditing), for: .editingDidBegin)
        control.addTarget(self, action: #selector(providedInputEndedEditing), for: .editingDidEnd)
      } else {
        NotificationCenter.default.addObserver(self, selector: #selector(textChanged), name: UITextView.textDidChangeNotification, object: field)
        NotificationCenter.default.addObserver(self, selector: #selector(providedInputBeganEditing), name: UITextView.textDidBeginEditingNotification, object: field)
        NotificationCenter.default.addObserver(self, selector: #selector(providedInputEndedEditing), name: UITextView.textDidEndEditingNotification, object: field)
      }
    }
    synchronizeInputAssistant()
    field.keyflowSetCorrection(usesCustomKeyboard ? .no : savedAutocorrection, spellChecking: usesCustomKeyboard ? .no : savedSpellChecking)
    prepareKeyboardForPresentation()
    synchronizeInputSurface()
    updateInputContext()
  }

  private func detachInput() {
    guard let field = attachedEditor else { return }
    keyboard.cancelInteractions()
    if let control = field as? UITextField {
      control.removeTarget(self, action: #selector(textChanged), for: .editingChanged)
      control.removeTarget(self, action: #selector(providedInputBeganEditing), for: .editingDidBegin)
      control.removeTarget(self, action: #selector(providedInputEndedEditing), for: .editingDidEnd)
    } else {
      NotificationCenter.default.removeObserver(self, name: UITextView.textDidChangeNotification, object: field)
      NotificationCenter.default.removeObserver(self, name: UITextView.textDidBeginEditingNotification, object: field)
      NotificationCenter.default.removeObserver(self, name: UITextView.textDidEndEditingNotification, object: field)
    }
    cursorNavigator.reset()
    field.keyflowSetInputViews(savedInputView, accessory: savedAccessoryView)
    field.keyflowSetCorrection(savedAutocorrection, spellChecking: savedSpellChecking)
    field.inputAssistantItem.leadingBarButtonGroups = savedLeadingBarButtonGroups
    field.inputAssistantItem.trailingBarButtonGroups = savedTrailingBarButtonGroups
    if field.isFirstResponder { field.reloadInputViews() }
    attachedEditor = nil
    savedInputView = nil
    savedAccessoryView = nil
  }

  @objc private func providedInputBeganEditing() {
    prepareKeyboardForPresentation()
    synchronizeInputSurface()
    updateInputContext()
    reportCustomFrame()
  }

  @objc private func reportCustomFrame() {
    guard usesCustomKeyboard, attachedEditor?.isFirstResponder == true,
      let window = attachedEditor?.window, keyboard.window != nil
    else { return }
    let frame = keyboard.convert(keyboard.bounds, to: window)
    guard frame.height > 0, frame != lastKeyboardFrame else { return }
    lastKeyboardFrame = frame
    onKeyflowFrameChange?([
      "screenY": frame.minY, "height": frame.height, "visible": true, "source": "custom",
    ])
  }

  @objc private func keyboardFrameChanged(_ notification: Notification) {
    if usesCustomKeyboard {
      reportCustomFrame()
      return
    }
    guard attachedEditor?.isFirstResponder == true,
      let frame = (notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?
        .cgRectValue,
      let window = attachedEditor?.window
    else { return }
    onKeyflowFrameChange?([
      "screenY": frame.minY, "height": frame.height,
      "visible": frame.minY < window.bounds.maxY, "source": "system",
    ])
  }

  private func clearKeyboardFrame() {
    lastKeyboardFrame = nil
    onKeyflowFrameChange?([
      "screenY": attachedEditor?.window?.bounds.height ?? 0, "height": 0, "visible": false,
      "source": usesCustomKeyboard ? "custom" : "system",
    ])
  }

  @objc private func providedInputEndedEditing() {
    clearKeyboardFrame()
    keyboard.cancelInteractions()
    lastSpaceTime = 0
  }

  func updateInputContext() { keyboard.updateContext(beforeCursor()) }
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
    onKeyflowLanguageChange?(["language": value.language, "layout": value.layout])
    lastSpaceTime = 0
    keyboard.updateContext(beforeCursor())
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
    emptyInput.backgroundColor = .clear
    emptyInput.heightAnchor.constraint(equalToConstant: 1).isActive = true
    customInputSurface = keyboard
    customKeyboard = nil
    synchronizeInputSurface()
    keyboard.onHeightChange = { [weak self] in
      guard let self, self.attachedEditor?.isFirstResponder == true else { return }
      self.requestInputReload()
    }
    keyboard.onAction = { [weak self] action in self?.handle(action) }
    keyboard.onFrameChange = { [weak self] in
      DispatchQueue.main.async { [weak self] in self?.reportCustomFrame() }
    }
    NotificationCenter.default.addObserver(
      self, selector: #selector(keyboardFrameChanged(_:)),
      name: UIResponder.keyboardDidShowNotification, object: nil)
    NotificationCenter.default.addObserver(
      self, selector: #selector(keyboardFrameChanged(_:)),
      name: UIResponder.keyboardDidChangeFrameNotification, object: nil)
    NotificationCenter.default.addObserver(
      self, selector: #selector(keyboardFrameChanged(_:)),
      name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
  }

  deinit { NotificationCenter.default.removeObserver(self) }

  @objc private func orientationChanged() {
    guard UIDevice.current.orientation.isValidInterfaceOrientation else { return }
    // Most rotations are already handled by UIKit and updateViewport.
    // Only repair an accessory that ends up undocked after a same-size reversal;
    // an unconditional completion reload starts a second keyboard animation.
    DispatchQueue.main.async { [weak self] in
      guard let self, self.attachedEditor?.isFirstResponder == true,
        self.usesCustomKeyboard, self.customKeyboard != nil
      else { return }
      let refresh: () -> Void = { [weak self] in
        guard let self, let window = self.attachedEditor?.window,
          self.attachedEditor?.isFirstResponder == true,
          self.usesCustomKeyboard, self.customKeyboard != nil,
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
    if let window = attachedEditor?.window {
      keyboard.updateViewport(window.bounds.size, insets: window.safeAreaInsets)
    }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      attachedEditor?.resignFirstResponder()
      detachInput()
    } else if let window {
      keyboard.updateViewport(window.bounds.size, insets: window.safeAreaInsets)
    }
  }

  func cleanup() {
    detachInput()
    removeFromSuperview()
  }

  func applyProps() {
    if needsInputReload {
      needsInputReload = false
      if let textField = attachedEditor, textField.isFirstResponder {
        inputReloadCount += 1
        textField.reloadInputViews()
      }
    }
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

  func setAppearance(_ value: String) {
    keyboard.overrideUserInterfaceStyle = value == "dark" ? .dark : .light
  }

  func setKeyboardType(_ value: String) {
    keyboard.setKeyboardType(value)
    lastSpaceTime = 0
    requestInputReload()
  }

  func setHaptics(_ value: Bool) { keyboard.hapticsEnabled = value }
  func getKeyboardMetrics() -> [String: Any] {
    var result = keyboard.metrics()
    guard let textField = attachedEditor else { return result }
    result["keyboardMode"] = usesCustomKeyboard ? "custom" : "system"
    result["focused"] = textField.isFirstResponder
    result["inputReloadCount"] = inputReloadCount
    if let window = attachedEditor?.window {
      result["editorBottom"] = textField.convert(textField.bounds, to: window).maxY
      result["screenY"] = keyboard.convert(keyboard.bounds, to: window).minY
    }
    result["text"] = textField.keyflowText
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
    guard usesCustomKeyboard else { return }
    if let window = attachedEditor?.window {
      keyboard.updateViewport(window.bounds.size, insets: window.safeAreaInsets)
    }
    updateInputSurface()
    UIView.performWithoutAnimation {
      keyboard.frame.size.width = attachedEditor?.window?.bounds.width ?? bounds.width
      keyboard.setNeedsLayout()
      keyboard.layoutIfNeeded()
      keyboard.subviews.forEach { $0.layoutIfNeeded() }
    }
  }
  func focus() {
    prepareKeyboardForPresentation()
    attachedEditor?.becomeFirstResponder()
  }
  func blur() {
    keyboard.cancelInteractions()
    lastSpaceTime = 0
    attachedEditor?.resignFirstResponder()
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
    let accessory =
      translucent || (attachedEditor?.isFirstResponder == true && customKeyboard != nil)
    let surface: UIView = accessory ? emptyInput : keyboard
    guard customInputSurface !== surface else {
      synchronizeInputSurface()
      return
    }
    customInputSurface = surface
    customKeyboard = accessory ? keyboard : nil
    synchronizeInputSurface()
    keyboard.setInputSurfaceHeight(accessory ? 1 : 0)
    if attachedEditor?.isFirstResponder == true { requestInputReload() }
  }

  func setKeyboardMode(_ value: String) {
    let wantsCustom = value == "custom"
    guard usesCustomKeyboard != wantsCustom else { return }
    keyboard.reset()
    lastSpaceTime = 0
    // The remote keyboard can reuse the outgoing accessory's height while it
    // installs the system IME. Remove that contribution before requesting it.
    keyboard.setPresentationActive(wantsCustom)
    usesCustomKeyboard = wantsCustom
    lastKeyboardFrame = nil
    synchronizeInputAssistant()
    synchronizeInputSurface()
    attachedEditor?.keyflowSetCorrection(wantsCustom ? .no : savedAutocorrection, spellChecking: wantsCustom ? .no : savedSpellChecking)
    requestInputReload()
    keyboard.updateContext(beforeCursor())
  }

  private func handle(_ action: KeyflowAction) {
    guard let textField = attachedEditor, textField.keyflowEditable, textField.isFirstResponder else {
      return
    }
    switch action {
    case .beginCursorMovement:
      cursorNavigator.reset()
    case .text(let value):
      cursorNavigator.reset()
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
      cursorNavigator.move(textField, horizontal: count, vertical: 0)
    case .moveCursorVertically(let count):
      cursorNavigator.move(textField, horizontal: 0, vertical: count)
    case .delete:
      cursorNavigator.reset()
      textField.deleteBackward()
    case .submit:
      // Keep React Native's submitBehavior and onSubmitEditing event pipeline.
      if let field = textField as? UITextField {
        if field.delegate?.textFieldShouldReturn?(field) ?? true { field.resignFirstResponder() }
      } else {
        // UIKit invokes React Native's text-view delegate for newline insertion,
        // preserving submitBehavior, filters, and onSubmitEditing.
        textField.insertText("\n")
      }
    case .dismiss:
      textField.resignFirstResponder()
    case .nextLanguage:
      let index = languages.firstIndex(of: language) ?? 0
      selectLanguage(languages[(index + 1) % languages.count])
    case .system:
      setKeyboardMode("system")
      onKeyflowModeChange?(["mode": "system"])
    default: break
    }
  }

  private func beforeCursor() -> String {
    guard let textField = attachedEditor, let range = textField.selectedTextRange,
      let prefix = textField.textRange(from: textField.beginningOfDocument, to: range.start)
    else { return "" }
    return textField.text(in: prefix) ?? ""
  }

  @objc private func textChanged() { updateInputContext() }
}
