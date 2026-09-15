package com.keyflow

import android.content.Context
import android.content.res.Configuration
import android.graphics.drawable.GradientDrawable
import android.view.HapticFeedbackConstants
import android.widget.LinearLayout
import kotlin.math.roundToInt

internal class KeyflowKeyboardView(
  context: Context,
  private val onAction: (String, String) -> Unit,
) : LinearLayout(context) {
  private val geometry = KeyflowGeometry(resources)
  var popupHost: android.view.View? = null
    set(value) {
      field = value
      keys.forEach { it.popupHost = value }
    }

  var onHeightChange: (() -> Unit)? = null
  private var keyboardType = "default"
  private var language = KeyflowLanguage.english
  private var canSwitchLanguage = false
  var showSecondaryKeyLabels = true
    set(value) {
      if (field == value) return
      field = value
      keys.forEach {
        it.showsHint = value
        it.invalidate()
      }
    }

  fun setLanguage(value: KeyflowLanguage, canSwitch: Boolean) {
    if (language == value && canSwitchLanguage == canSwitch) return
    language = value
    canSwitchLanguage = canSwitch
    page = "letters"
    caps = false
    manualShift = false
    lastShift = 0L
    rebuild()
  }

  private val isPad
    get() = keyboardType != "default"

  val panelHeight
    get() =
      (if (isPad) 0 else geometry.toolbarHeight) + 4 * geometry.rowHeight + geometry.bottomInset

  fun setKeyboardType(type: String) {
    if (type == keyboardType) return
    keyboardType = type
    reset()
    toolbar.visibility = if (isPad) GONE else VISIBLE
    onHeightChange?.invoke()
  }

  private val density
    get() = resources.displayMetrics.density

  private val keys = mutableListOf<KeyflowKeyView>()
  private val rows = LinearLayout(context)
  private val toolbar = LinearLayout(context)
  private val accentPopup =
    KeyflowAccentPopup(
      this,
      geometry,
      { popupHost },
      { theme },
      { visible ->
        rows.alpha = if (visible) 0.38f else 1f
        toolbar.alpha = if (visible) 0.38f else 1f
      },
      { value -> onAction("text", value) },
    )
  private val refreshGeometry = Runnable {
    toolbar.layoutParams.height = dp(geometry.toolbarHeight)
    setPadding(0, 0, 0, dp(geometry.bottomInset))
    rebuild()
    requestLayout()
    invalidate()
    onHeightChange?.invoke()
  }
  private var page = "letters"

  fun updateContext(before: String) {
    if (caps) return
    manualShift = false
    shifted =
      before.isEmpty() ||
        before.endsWith("\n") ||
        (before.endsWith(" ") && before.trimEnd().lastOrNull() in listOf('.', '!', '?'))
    applyCase()
  }

  private var shifted = true
  private var manualShift = false
  private var caps = false
  private var lastShift = 0L
  var hapticsEnabled = false
  var theme = KeyflowTheme()
    set(value) {
      field = value
      styleKeys()
    }

  init {
    orientation = VERTICAL
    elevation = 0f
    setPadding(0, 0, 0, dp(geometry.bottomInset))
    toolbar.orientation = HORIZONTAL
    toolbar.isBaselineAligned = false
    addView(toolbar, LayoutParams(LayoutParams.MATCH_PARENT, dp(geometry.toolbarHeight)))
    rows.orientation = VERTICAL
    addView(rows, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
    rebuild()
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    if (w != oldw && oldw > 0) {
      if (geometry.tablet) {
        // Tablet geometry is based on the stable short edge. LinearLayout
        // weights are laid out by the parent with the new window width, so any
        // explicit work here only adds a visible hitch to system rotation.
        return
      }
      scheduleGeometryRefresh()
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    if (geometry.tablet) {
      return
    }
    scheduleGeometryRefresh()
  }

  private fun scheduleGeometryRefresh() {
    // Android delivers both a configuration callback and one or more size
    // callbacks during rotation. Coalesce them into the next frame so the
    // keyboard is rebuilt once against the committed window bounds.
    removeCallbacks(refreshGeometry)
    postOnAnimation(refreshGeometry)
  }

  private fun dp(value: Int) = (value * density).toInt()

  private fun makeKey(label: String, action: String, value: String = label): KeyflowKeyView {
    val key =
      KeyflowKeyView(context, action, label) {
        if (hapticsEnabled) performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
        when (action) {
          "shift" -> {
            val now = android.os.SystemClock.uptimeMillis()
            if (geometry.tablet) {
              manualShift = !manualShift
              shifted = caps || manualShift
            } else if (now - lastShift < 300) {
              caps = true
              shifted = true
            } else {
              caps = false
              shifted = !shifted
            }
            if (!geometry.tablet) manualShift = shifted && !caps
            lastShift = now
            applyCase()
          }
          "capsLock" -> {
            caps = !caps
            shifted = caps || manualShift
            applyCase()
          }
          "numbers",
          "symbols",
          "letters" -> {
            page = action
            rebuild()
          }
          "letter" -> {
            val output = resolvedLetter(value)
            consumeShift()
            onAction("text", output)
          }
          "padspace" -> onAction("text", " ")
          "padpunct" -> onAction("text", value)
          "space" -> {
            onAction("text", " ")
            if (page != "letters") {
              page = "letters"
              rebuild()
            }
          }
          else -> onAction(action, value)
        }
      }
    if (action == "space") key.onSlideStart = { onAction("cursorStart", "") }
    if (action == "space") key.onSlideEnd = { onAction("cursorEnd", "") }
    if (action == "space")
      key.onSlide = { horizontal, vertical -> onAction("cursor", "$horizontal,$vertical") }
    if (action == "letter") {
      key.hasAlternatives = accentPopup.hasAlternatives(label)
      key.onHold = {
        accentPopup.show(key, shifted, page == "letters").also { shown ->
          if (shown && hapticsEnabled) performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
        }
      }
      key.onAccessibleHold = {
        accentPopup.show(key, shifted, page == "letters", accessible = true).also { shown ->
          if (shown && hapticsEnabled) performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
        }
      }
      key.onHoldMove = { x, y ->
        val previous = accentPopup.selection
        accentPopup.move(x, y)
        if (hapticsEnabled && accentPopup.selection != null && accentPopup.selection != previous) {
          performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
        }
      }
      key.onHoldEnd = { commit ->
        val choice = accentPopup.selection
        accentPopup.dismiss()
        if (commit && choice != null) {
          consumeShift()
          onAction("text", choice)
        }
      }
    }
    if (isPad && keyboardType == "phone-pad" && label == "0") {
      key.hasAlternatives = true
      key.onHold = {
        if (hapticsEnabled) performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
        true
      }
      key.onAccessibleHold = {
        onAction("text", "+")
        true
      }
      key.onHoldEnd = { commit -> if (commit) onAction("text", "+") }
    }
    key.allowsPreview = !isPad
    key.showsHint = showSecondaryKeyLabels
    key.popupHost = popupHost
    key.applyTheme(theme)
    keys.add(key)
    return key
  }

  private fun chars(value: String) = value.map { makeKey(it.toString(), "letter") }

  private fun spacer() = makeKey("", "spacer").apply { visibility = INVISIBLE }

  private fun addRow(items: List<KeyflowKeyView>, inset: Int = 0, weights: List<Float>? = null) {
    val row =
      LinearLayout(context).apply {
        orientation = HORIZONTAL
        isBaselineAligned = false
        val edge =
          when {
            geometry.tablet -> if (geometry.landscape) 10 else 7
            geometry.landscape -> 0
            else -> 2
          }
        setPadding(dp(inset + edge), 0, dp(inset + edge), 0)
      }
    val rowHeight =
      geometry.rowHeight -
        if (
          !geometry.tablet &&
            !geometry.landscape &&
            rows.childCount == 0 &&
            resources.configuration.screenWidthDp >= 360
        )
          1
        else 0
    items.forEachIndexed { index, key ->
      row.addView(key, LayoutParams(0, dp(rowHeight), weights?.get(index) ?: 1f))
    }
    rows.addView(row, LayoutParams(LayoutParams.MATCH_PARENT, dp(rowHeight)))
  }

  private fun rebuild() {
    // A hidden pad can rotate before the QWERTY toolbar is shown again.
    toolbar.layoutParams?.let { params ->
      params.height = dp(geometry.toolbarHeight)
      toolbar.layoutParams = params
    }
    setPadding(0, 0, 0, dp(geometry.bottomInset))
    cancelTouches()
    keys.clear()
    rows.removeAllViews()
    if (isPad) {
      val decimal = java.text.DecimalFormatSymbols.getInstance().decimalSeparator.toString()
      val phoneSymbols = keyboardType == "phone-pad" && page == "symbols"
      if (phoneSymbols) {
        addRow(chars("(/)") + makeKey("−", "text", "-"))
        addRow(
          listOf(
            makeKey("N", "letter"),
            makeKey("Pause", "padpunct", ","),
            makeKey(",", "letter"),
            makeKey("", "padspace", " "),
          )
        )
        addRow(
          listOf(
            makeKey("*", "letter"),
            makeKey("Wait", "padpunct", ";"),
            makeKey("#", "letter"),
            makeKey("Delete", "delete"),
          )
        )
      } else {
        addRow(chars("123") + makeKey("−", "text", "-"))
        addRow(chars("456") + makeKey("", "padspace", " "))
        addRow(chars("789") + makeKey("Delete", "delete"))
      }
      val first =
        if (keyboardType == "phone-pad")
          makeKey(if (phoneSymbols) "123" else "* #", if (phoneSymbols) "letters" else "symbols")
            .apply { themeSection = "keys" }
        else makeKey(",", "padpunct", ",")
      addRow(
        listOf(
          first,
          makeKey(if (phoneSymbols) "+" else "0", "letter"),
          makeKey(decimal, "letter"),
          makeKey("Submit", "submit"),
        )
      )
      val subtitles =
        mapOf(
          "2" to "ABC",
          "3" to "DEF",
          "4" to "GHI",
          "5" to "JKL",
          "6" to "MNO",
          "7" to "PQRS",
          "8" to "TUV",
          "9" to "WXYZ",
          "0" to "+",
        )
      keys.forEach { item ->
        item.padKey = true
        if (keyboardType == "phone-pad") item.padLegend = subtitles[item.label]
      }
    } else if (geometry.tablet) {
      when (page) {
        "letters" -> {
          val first = chars(language.letterRows[0])
          first.forEachIndexed { i, key -> key.hint = ((i + 1) % 10).toString() }
          val wide = geometry.landscape
          addRow(
            listOf(makeKey("Tab", "tab", "\t")) + first + makeKey("Delete", "delete"),
            weights =
              listOf(if (wide) 1.1765f else 1.05f) +
                List(first.size) { 1f } +
                if (wide) 1.1765f else 1.05f,
          )
          addRow(
            listOf(makeKey("Caps Lock", "capsLock")) +
              chars(language.letterRows[1]) +
              makeKey("Submit", "submit"),
            weights =
              listOf(if (wide) 1.4216f else 1.3f) +
                List(language.letterRows[1].length) { 1f } +
                if (wide) 1.9314f else 1.8f,
          )
          addRow(
            listOf(makeKey("Shift", "shift")) +
              chars(language.letterRows[2]) +
              listOf(makeKey(",", "letter"), makeKey(".", "letter"), makeKey("Shift", "shift")),
            weights =
              listOf(if (wide) 1.9118f else 1.8f) +
                List(language.letterRows[2].length + 2) { 1f } +
                if (wide) 1.4412f else 1.35f,
          )
        }
        "numbers" -> {
          val wide = geometry.landscape
          addRow(
            listOf(makeKey("Tab", "tab", "\t")) + chars("1234567890") + makeKey("Delete", "delete"),
            weights =
              listOf(if (wide) 1.1765f else 1.05f) + List(10) { 1f } + if (wide) 1.1765f else 1.05f,
          )
          addRow(
            listOf(makeKey("Caps Lock", "capsLock")) +
              chars("@#${language.currency}_&-+()/") +
              makeKey("Submit", "submit"),
            weights =
              listOf(if (wide) 1.4216f else 1.3f) + List(10) { 1f } + if (wide) 1.9314f else 1.8f,
          )
          addRow(
            listOf(makeKey("=\\<", "symbols")) +
              chars("*\"':;!?") +
              listOf(makeKey(",", "letter"), makeKey(".", "letter"), makeKey("=\\<", "symbols")),
            weights =
              listOf(if (wide) 1.9118f else 1.8f) + List(9) { 1f } + if (wide) 1.4412f else 1.35f,
          )
        }
        else -> {
          val wide = geometry.landscape
          addRow(
            listOf(makeKey("Tab", "tab", "\t")) + chars("~`|•√π÷×§∆") + makeKey("Delete", "delete"),
            weights =
              listOf(if (wide) 1.1765f else 1.05f) + List(10) { 1f } + if (wide) 1.1765f else 1.05f,
          )
          addRow(
            listOf(makeKey("Caps Lock", "capsLock")) +
              chars("£¢€¥^°={}\\") +
              makeKey("Submit", "submit"),
            weights =
              listOf(if (wide) 1.4216f else 1.3f) + List(10) { 1f } + if (wide) 1.9314f else 1.8f,
          )
          addRow(
            listOf(makeKey("?123", "numbers")) +
              chars("%©®™✓[]") +
              listOf(makeKey(",", "letter"), makeKey(".", "letter"), makeKey("?123", "numbers")),
            weights =
              listOf(if (wide) 1.9118f else 1.8f) + List(9) { 1f } + if (wide) 1.4412f else 1.35f,
          )
        }
      }
      val pageLabel = if (page == "letters") "?123" else "ABC"
      val pageAction = if (page == "letters") "numbers" else "letters"
      // Do not reserve dead tablet slots for unsupported emoji or microphone
      // controls. Give that room to the space bar while keeping the available
      // actions in the same order and preserving the row's native total width.
      if (canSwitchLanguage) {
        addRow(
          listOf(
            makeKey(pageLabel, pageAction),
            makeKey("Next language", "nextLanguage"),
            makeKey("", "space"),
            makeKey(pageLabel, pageAction),
          ),
          weights =
            if (geometry.landscape) listOf(1.4559f, 1.4559f, 8.4363f, 1.0049f)
            else listOf(1.35f, 1.35f, 8.1f, 1f),
        )
      } else {
        addRow(
          listOf(
            makeKey(pageLabel, pageAction),
            makeKey("", "space"),
            makeKey(pageLabel, pageAction),
          ),
          weights =
            if (geometry.landscape) listOf(1.4559f, 9.8921f, 1.0049f) else listOf(1.35f, 9.45f, 1f),
        )
      }
    } else {
      when (page) {
        "letters" -> {
          val first = chars(language.letterRows[0])
          first.forEachIndexed { i, key -> key.hint = ((i + 1) % 10).toString() }
          addRow(first)
          addRow(
            chars(language.letterRows[1]),
            (resources.configuration.screenWidthDp * (10 - language.letterRows[1].length) / 20f)
              .roundToInt(),
          )
          addRow(
            listOf(makeKey("Shift", "shift")) +
              chars(language.letterRows[2]) +
              makeKey("Delete", "delete"),
            weights = listOf(1.5f) + List(language.letterRows[2].length) { 1f } + 1.5f,
          )
        }
        "numbers" -> {
          addRow(chars("1234567890"))
          addRow(chars("@#${language.currency}_&-+()/"))
          addRow(
            listOf(makeKey("=\\<", "symbols")) + chars("*\"':;!?") + makeKey("Delete", "delete"),
            weights = listOf(1.5f) + List(7) { 1f } + 1.5f,
          )
        }
        else -> {
          addRow(chars("~`|•√π÷×§∆"))
          addRow(chars("£¢€¥^°={}\\"))
          addRow(
            listOf(makeKey("?123", "numbers")) + chars("%©®™✓[]") + makeKey("Delete", "delete"),
            weights = listOf(1.5f) + List(7) { 1f } + 1.5f,
          )
        }
      }
      val bottom =
        mutableListOf(
          makeKey(
            if (page == "letters") "?123" else "ABC",
            if (page == "letters") "numbers" else "letters",
          ),
          makeKey(",", "letter"),
          makeKey("", "space"),
          makeKey(".", "letter"),
          makeKey("Submit", "submit"),
        )
      if (canSwitchLanguage) bottom.add(2, makeKey("Next language", "nextLanguage"))
      addRow(
        bottom,
        weights =
          if (canSwitchLanguage) listOf(1.5f, 1f, 1f, 4f, 1f, 1.5f)
          else listOf(1.5f, 1f, 5f, 1f, 1.5f),
      )
    }
    applyCase()
    styleKeys()
  }

  private fun resolvedLetter(value: String): String {
    if (page != "letters") return value
    if (geometry.tablet && manualShift) {
      if (value == ",") return "<"
      if (value == ".") return ">"
    }
    return if (shifted) value.uppercase() else value
  }

  private fun consumeShift() {
    manualShift = false
    shifted = caps
    applyCase()
  }

  private fun applyCase() {
    keys.forEach { key ->
      if (key.action == "letter" && page == "letters") {
        key.text = resolvedLetter(key.label)
        key.contentDescription = key.text
      }
      if (key.action == "shift") {
        key.text = ""
        // Gboard distinguishes explicit Shift from automatic sentence case on
        // tablets: manual Shift fills the arrows, automatic case selects Caps.
        key.isSelected = shifted && (!geometry.tablet || manualShift)
        key.isActivated = caps && !geometry.tablet
        key.applyTheme(theme)
        key.invalidate()
        key.contentDescription =
          if (!geometry.tablet && caps) "Caps lock on"
          else if (key.isSelected) "Shift on" else "Shift off"
      }
      if (key.action == "capsLock") {
        key.text = ""
        key.isSelected = caps || (shifted && !manualShift)
        key.applyTheme(theme)
        key.invalidate()
        key.contentDescription =
          if (caps) "Caps lock on"
          else if (shifted) "Sentence capitalization on" else "Caps lock off"
      }
    }
  }

  private fun styleKeys() {
    background = GradientDrawable().apply { setColor(theme.background) }
    keys.forEach { it.applyTheme(theme) }
    updateToolbar()
  }

  private fun updateToolbar() {
    toolbar.removeAllViews()
    val actions =
      if (geometry.tablet) {
        listOf(null, null, null, null, null, null, null, "paste" to "Paste", null)
      } else listOf("paste" to "Paste", "hide" to "Hide")
    actions.forEach { entry ->
      val view =
        if (entry == null) android.view.View(context)
        else
          KeyflowKeyView(context, entry.first, entry.second) { onAction(entry.first, "") }
            .apply {
              compact = true
              themeSection = "toolbar"
              applyTheme(theme)
              contentDescription = entry.second
            }
      toolbar.addView(view, LayoutParams(0, LayoutParams.MATCH_PARENT, 1f))
    }
  }

  fun metrics(): Map<String, Any> {
    val failures = mutableListOf<String>()
    val origin = IntArray(2)
    getLocationOnScreen(origin)
    val rectangles =
      keys.map { key ->
        val location = IntArray(2)
        key.getLocationOnScreen(location)
        android.graphics.Rect(
          location[0] - origin[0],
          location[1] - origin[1],
          location[0] - origin[0] + key.width,
          location[1] - origin[1] + key.height,
        )
      }
    if (isAttachedToWindow)
      keys.forEachIndexed { index, key ->
        if (!android.graphics.Rect(0, 0, width, height).contains(rectangles[index]))
          failures.add("Outside keyboard: ${key.label} ${rectangles[index]} in ${width}x${height}")
        if (!key.labelFits()) failures.add("Label overflow: ${key.label}")
        if (
          rectangles.drop(index + 1).any { android.graphics.Rect.intersects(it, rectangles[index]) }
        )
          failures.add("Overlapping key: ${key.label} ${rectangles[index]}")
      }
    return mapOf(
      "keyFrames" to
        keys
          .filter { it.visibility == VISIBLE }
          .map { key ->
            val point = IntArray(2)
            key.getLocationOnScreen(point)
            mapOf(
              "label" to (if (key.action == "padspace") "Space" else key.label),
              "x" to point[0] / density,
              "y" to point[1] / density,
              "width" to key.width / density,
              "height" to key.height / density,
            )
          },
      "screenY" to origin[1] / density,
      "width" to width / density,
      "height" to height / density,
      "keyCount" to keys.size,
      "violations" to failures,
      "fonts" to listOf(theme.json.optString("fontFamily", "sans-serif")),
      "keyboardType" to keyboardType,
      "landscape" to geometry.landscape,
      "keyboardPage" to page,
    )
  }

  fun cancelTouches() {
    keys.forEach { it.cancelRepeat() }
    accentPopup.dismiss()
  }

  fun reset() {
    cancelTouches()
    shifted = true
    caps = false
    manualShift = false
    lastShift = 0
    page = "letters"
    rebuild()
  }
}
