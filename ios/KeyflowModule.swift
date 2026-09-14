import ExpoModulesCore

public class KeyflowModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Keyflow")
    View(KeyflowInputView.self) {
      Events(
        "onKeyflowTextChange", "onKeyflowSubmit", "onKeyflowModeChange", "onKeyflowLanguageChange")
      Prop("defaultValue", "") { (view: KeyflowInputView, value: String) in
        view.initialValue = value
      }
      Prop("placeholder", "") { (view: KeyflowInputView, value: String) in
        view.setPlaceholder(value)
      }
      Prop("inputAccessibilityLabel", "Text input") { (view: KeyflowInputView, value: String) in
        view.setInputLabel(value)
      }
      Prop("autoFocus", false) { (view: KeyflowInputView, value: Bool) in view.autoFocus = value }
      Prop("autoCorrect", true) { (view: KeyflowInputView, value: Bool) in view.autoCorrect = value
      }
      Prop("editable", true) { (view: KeyflowInputView, value: Bool) in view.setEnabled(value) }
      Prop("hapticsEnabled", false) { (view: KeyflowInputView, value: Bool) in
        view.setHaptics(value)
      }
      Prop("showSecondaryKeyLabels", true) { (view: KeyflowInputView, value: Bool) in
        view.showSecondaryKeyLabels = value
      }
      Prop("languagesJSON", "") { (view: KeyflowInputView, value: String) in
        view.setLanguages(value)
      }
      Prop("keyboardType", "default") { (view: KeyflowInputView, value: String) in
        view.setKeyboardType(value)
      }
      Prop("keyboardMode", "custom") { (view: KeyflowInputView, value: String) in
        view.setKeyboardMode(value)
      }
      Prop("keyboardAppearance", "light") { (view: KeyflowInputView, value: String) in
        view.setAppearance(value)
      }
      Prop("themeJSON") { (view: KeyflowInputView, value: String) in view.setTheme(value) }
      OnViewDidUpdateProps { (view: KeyflowInputView) in view.applyProps() }
      AsyncFunction("getKeyboardMetrics") { (view: KeyflowInputView) in view.getKeyboardMetrics() }
      AsyncFunction("focus") { (view: KeyflowInputView) in view.focus() }
      AsyncFunction("setKeyboardMode") { (view: KeyflowInputView, mode: String) in
        view.setKeyboardMode(mode)
        view.applyProps()
      }
      AsyncFunction("blur") { (view: KeyflowInputView) in view.blur() }
    }
  }
}
