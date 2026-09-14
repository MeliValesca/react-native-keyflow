package com.keyflow

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KeyflowModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Keyflow")
    View(KeyflowInputView::class) {
      Events(
        "onKeyflowTextChange",
        "onKeyflowSubmit",
        "onKeyflowModeChange",
        "onKeyflowHeightChange",
        "onKeyflowFrameChange",
        "onKeyflowLanguageChange",
      )
      Prop("defaultValue") { view: KeyflowInputView, value: String -> view.initialValue(value) }
      Prop("placeholder") { view: KeyflowInputView, value: String -> view.placeholder(value) }
      Prop("inputAccessibilityLabel") { view: KeyflowInputView, value: String -> view.label(value) }
      Prop("autoFocus") { view: KeyflowInputView, value: Boolean -> view.autoFocus = value }
      Prop("autoCorrect") { view: KeyflowInputView, value: Boolean -> view.autoCorrect = value }
      Prop("editable") { view: KeyflowInputView, value: Boolean -> view.editable(value) }
      Prop("hapticsEnabled") { view: KeyflowInputView, value: Boolean -> view.haptics(value) }
      Prop("showSecondaryKeyLabels", true) { view: KeyflowInputView, value: Boolean ->
        view.showSecondaryKeyLabels(value)
      }
      Prop("languagesJSON") { view: KeyflowInputView, value: String -> view.setLanguages(value) }
      Prop("keyboardType") { view: KeyflowInputView, value: String -> view.setKeyboardType(value) }
      Prop("keyboardMode") { view: KeyflowInputView, value: String -> view.setMode(value) }
      Prop("themeJSON") { view: KeyflowInputView, value: String -> view.theme(value) }
      AsyncFunction("getKeyboardMetrics") { view: KeyflowInputView -> view.getKeyboardMetrics() }
      AsyncFunction("focus") { view: KeyflowInputView -> view.focus() }
      AsyncFunction("setKeyboardMode") { view: KeyflowInputView, mode: String ->
        view.setMode(mode)
      }
      AsyncFunction("blur") { view: KeyflowInputView -> view.blur() }
    }
  }
}
