package com.keyflow

import android.app.Activity
import android.os.Bundle
import android.widget.FrameLayout

internal class KeyflowTestActivity : Activity() {
  internal val output = mutableListOf<Pair<String, String>>()
  internal lateinit var keyboard: KeyflowKeyboardView

  override fun onCreate(state: Bundle?) {
    super.onCreate(state)
    keyboard = KeyflowKeyboardView(this) { action, value -> output += action to value }
    val host = FrameLayout(this)
    host.addView(keyboard, FrameLayout.LayoutParams(-1, keyboard.panelHeight.dp()))
    keyboard.popupHost = host
    setContentView(host)
  }

  private fun Int.dp() = (this * resources.displayMetrics.density).toInt()
}
