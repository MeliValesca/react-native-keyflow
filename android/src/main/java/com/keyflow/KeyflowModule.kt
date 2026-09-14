package com.keyflow

import android.view.View
import android.view.ViewGroup
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KeyflowModule : Module() {
  private val controllers = mutableMapOf<String, KeyflowInputView>()

  private fun controller(id: String): KeyflowInputView {
    controllers[id]?.let {
      return it
    }
    val context = checkNotNull(appContext.reactContext) { "React context is unavailable" }
    val controller = KeyflowInputView(context, appContext)
    controller.alpha = 0f
    controller.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
    controller.onKeyflowModeChange = { sendEvent("onKeyflowModeChange", it + ("id" to id)) }
    controller.onKeyflowLanguageChange = { sendEvent("onKeyflowLanguageChange", it + ("id" to id)) }
    controller.onKeyflowHeightChange = { sendEvent("onKeyflowHeightChange", it + ("id" to id)) }
    controller.onKeyflowFrameChange = { sendEvent("onKeyflowFrameChange", it + ("id" to id)) }
    val activity = checkNotNull(appContext.currentActivity) { "Activity is unavailable" }
    activity.addContentView(controller, ViewGroup.LayoutParams(1, 1))
    controllers[id] = controller
    return controller
  }

  override fun definition() = ModuleDefinition {
    Name("Keyflow")
    Events(
      "onKeyflowModeChange",
      "onKeyflowHeightChange",
      "onKeyflowFrameChange",
      "onKeyflowLanguageChange",
    )
    AsyncFunction("attachInput") { id: String, tag: Int -> controller(id).attachInput(tag) }
      .runOnQueue(Queues.MAIN)
    AsyncFunction("configure") {
        id: String,
        mode: String,
        type: String,
        appearance: String,
        theme: String,
        languages: String,
        haptics: Boolean,
        secondaryLabels: Boolean ->
        controller(id).apply {
          setMode(mode)
          setKeyboardType(type)
          theme(theme)
          setLanguages(languages)
          haptics(haptics)
          showSecondaryKeyLabels(secondaryLabels)
        }
        Unit
      }
      .runOnQueue(Queues.MAIN)
    AsyncFunction("updateInputContext") { id: String ->
        controllers[id]?.updateInputContext()
        Unit
      }
      .runOnQueue(Queues.MAIN)
    AsyncFunction("getKeyboardMetrics") { id: String ->
        controllers[id]?.getKeyboardMetrics() ?: emptyMap<String, Any>()
      }
      .runOnQueue(Queues.MAIN)
    AsyncFunction("destroy") { id: String ->
        controllers.remove(id)?.cleanup()
        Unit
      }
      .runOnQueue(Queues.MAIN)
    OnDestroy {
      controllers.values.forEach { it.cleanup() }
      controllers.clear()
    }
  }
}
