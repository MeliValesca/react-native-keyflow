package com.keyflow

internal fun keyboardField(keyboard: KeyflowKeyboardView, name: String): Any? {
  val owner =
    if (name.startsWith("accent") || name == "selectedAccent") {
      KeyflowKeyboardView::class
        .java
        .getDeclaredField("accentPopup")
        .apply { isAccessible = true }
        .get(keyboard)
    } else keyboard
  return owner.javaClass.getDeclaredField(name).apply { isAccessible = true }.get(owner)
}
