import ExpoModulesCore

public class KeyflowModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Keyflow")
    View(KeyflowInputView.self) {
      Events(
        "onKeyflowModeChange", "onKeyflowLanguageChange", "onKeyflowFrameChange")
      AsyncFunction("attachInput") { (view: KeyflowInputView, tag: Int?) in
        try view.attachInput(tag)
      }
      AsyncFunction("updateInputContext") { (view: KeyflowInputView) in
        view.updateInputContext()
      }
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
