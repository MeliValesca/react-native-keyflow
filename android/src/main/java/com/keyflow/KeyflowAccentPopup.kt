package com.keyflow

import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.widget.Button

/** Owns the accent popup lifecycle, hit testing, and selection animation. */
internal class KeyflowAccentPopup(
  private val keyboard: View,
  private val geometry: KeyflowGeometry,
  private val popupHost: () -> View?,
  private val currentTheme: () -> KeyflowTheme,
  private val onVisibilityChanged: (Boolean) -> Unit,
  private val onAccessibleCommit: (String) -> Unit,
) {
  private val context
    get() = keyboard.context

  private val width
    get() = keyboard.width

  private val theme
    get() = currentTheme()

  private fun dp(value: Int) = (value * context.resources.displayMetrics.density).toInt()

  val selection
    get() = selectedAccent?.text?.toString()

  fun hasAlternatives(label: String) = accents.containsKey(label)

  private var accentPopup: android.widget.PopupWindow? = null
  private var accentChoices = emptyList<Button>()
  private var selectedAccent: Button? = null
  private var accentIndicator: android.view.View? = null
  private var accentMotion: android.animation.ValueAnimator? = null
  private var accentTarget = -1
  private var accentOriginX = 0f
  private var accentOriginY = 0f
  private var accentDragStarted = false
  private var accentPopupX = 0
  private var accentPopupY = 0
  private var accentUnit = 0
  private var accentColumns = 0
  private var accentChoiceHeight = 0
  private var accentPanelPadding = 0
  private val accents =
    mapOf(
      "a" to "åæãāâàáä",
      "e" to "ēêëèé",
      "i" to "īîïìí",
      "o" to "ōôöòóõøœ",
      "u" to "ūûüùú",
      "c" to "çćč",
      "n" to "ñń",
      "s" to "ßśš",
      "y" to "ÿý",
      "$" to "¢£€¥₹₱",
      "€" to "$¢£¥₹₱",
      "!" to "¡",
      "?" to "¿",
    )

  fun show(
    key: KeyflowKeyView,
    shifted: Boolean,
    letters: Boolean,
    accessible: Boolean = false,
  ): Boolean {
    val host = popupHost() ?: return false
    if (!host.isAttachedToWindow) return false
    val alternatives = if (!geometry.tablet && key.label == "a") "æãåāàáâä" else accents[key.label]
    val values =
      alternatives
        ?.map {
          if (shifted && letters) {
            // Kotlin follows the legacy Unicode expansion (ß -> SS), while the
            // Android keyboard presents the single capital character ẞ.
            if (it == 'ß') "ẞ" else it.uppercase()
          } else it.toString()
        }
        ?.toMutableList() ?: mutableListOf()
    key.hint?.let { values.add(if (values.size >= 4) 4 else values.size, it) }
    if (values.isEmpty()) return false
    dismiss()
    val columns = minOf(5, if (values.size <= 6) 3 else (values.size + 1) / 2, values.size)
    val unit = minOf(dp(if (geometry.tablet) 50 else 44), (width - dp(24)) / columns)
    val choiceHeight = dp(if (geometry.tablet) 50 else 44)
    val panelPadding = dp(if (geometry.tablet) 15 else 14)
    val grid =
      android.widget.GridLayout(context).apply {
        columnCount = columns
        setPadding(panelPadding, panelPadding, panelPadding, panelPadding)
      }
    val style = theme.styled("preview")
    val panel =
      android.widget.FrameLayout(context).apply {
        background =
          GradientDrawable().apply {
            setColor(style.color("keyBackground", "#FFFFFF"))
            cornerRadius = dp(32).toFloat()
          }
      }
    val indicatorSize = minOf(unit, choiceHeight)
    val indicator =
      android.view.View(context).apply {
        background =
          GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            val custom = theme.json.optJSONObject("sectionOverrides")?.optJSONObject("selection")
            setColor(
              custom?.let {
                KeyflowTheme(it).color("background", if (geometry.tablet) "#495D92" else "#475D92")
              } ?: android.graphics.Color.rgb(if (geometry.tablet) 73 else 71, 93, 146)
            )
          }
      }
    panel.addView(indicator, android.widget.FrameLayout.LayoutParams(indicatorSize, indicatorSize))
    panel.addView(
      grid,
      android.widget.FrameLayout.LayoutParams(
        android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
        android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
      ),
    )
    accentChoices =
      values.map { value ->
        Button(context).apply {
          text = value
          contentDescription = value
          setOnClickListener {
            dismiss()
            onAccessibleCommit(value)
          }
          isAllCaps = false
          isFocusable = false
          minWidth = 0
          minimumWidth = 0
          minHeight = 0
          minimumHeight = 0
          setPadding(0, 0, 0, 0)
          includeFontPadding = false
          stateListAnimator = null
          elevation = 0f
          val explicitSize =
            theme.json
              .optJSONObject("sectionOverrides")
              ?.optJSONObject("selection")
              ?.optDouble("fontSize", Double.NaN)
              ?.toFloat()
          val baseSize =
            explicitSize?.takeIf { it.isFinite() }
              ?: ((theme.section("selection")?.optDouble("fontSize", 22.0)?.toFloat()
                ?: theme.fontSize) * 24f / 22f)
          setTextSize(android.util.TypedValue.COMPLEX_UNIT_DIP, baseSize.coerceIn(12f, 32f))
          typeface = theme.styled("selection").typeface(context.assets)
          setTextColor(theme.foreground)
          background = android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT)
          grid.addView(
            this,
            android.widget.GridLayout.LayoutParams().apply {
              width = unit
              height = choiceHeight
            },
          )
        }
      }
    val nativeDefault =
      mapOf(
          "a" to "à",
          "e" to "é",
          "i" to "í",
          "o" to "ó",
          "u" to "ú",
          "c" to "ç",
          "n" to "ñ",
          "s" to "ß",
          "y" to "ÿ",
        )[key.label]
        ?.let { if (shifted) it.uppercase() else it }
    selectedAccent =
      accentChoices.firstOrNull { it.text == key.hint }
        ?: accentChoices.firstOrNull { it.text == nativeDefault }
        ?: accentChoices.first()
    val location = IntArray(2)
    key.getLocationOnScreen(location)
    accentOriginX = key.holdTouchX ?: (location[0] + key.width / 2f)
    accentOriginY = key.holdTouchY ?: (location[1] + key.height / 2f)
    accentDragStarted = false
    val origin = IntArray(2)
    keyboard.getLocationOnScreen(origin)
    val popupWidth = unit * columns + panelPadding * 2
    val popupHeight = choiceHeight * ((values.size + columns - 1) / columns) + panelPadding * 2
    val selectedIndex = accentChoices.indexOf(selectedAccent)
    val x =
      (location[0] + key.width / 2 - panelPadding - (selectedIndex % columns) * unit - unit / 2)
        .coerceIn(
          origin[0] + dp(4),
          maxOf(origin[0] + dp(4), origin[0] + width - popupWidth - dp(4)),
        )
    val y = location[1] - popupHeight - dp(4)
    accentPopupX = x
    accentPopupY = y
    accentUnit = unit
    accentColumns = columns
    accentChoiceHeight = choiceHeight
    accentPanelPadding = panelPadding
    accentIndicator = indicator
    placeAccentIndicator(selectedIndex, false)
    updateAccentSelection()
    accentPopup =
      android.widget.PopupWindow(panel, popupWidth, popupHeight, accessible).apply {
        setBackgroundDrawable(
          android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT)
        )
        isTouchable = accessible
        if (accessible)
          setOnDismissListener { if (accentPopup != null) this@KeyflowAccentPopup.dismiss() }
        elevation = dp(8).toFloat()
        showAtLocation(host, Gravity.NO_GRAVITY, x, y)
      }
    onVisibilityChanged(true)
    return true
  }

  private fun placeAccentIndicator(index: Int, animated: Boolean = true) {
    val indicator = accentIndicator ?: return
    if (index == accentTarget) return
    accentTarget = index
    accentMotion?.cancel()
    val startX = indicator.x
    val startY = indicator.y
    val endX =
      accentPanelPadding + (index % accentColumns + 0.5f) * accentUnit -
        indicator.layoutParams.width / 2f
    val endY =
      accentPanelPadding + (index / accentColumns + 0.5f) * accentChoiceHeight -
        indicator.layoutParams.height / 2f
    if (
      !animated ||
        (android.os.Build.VERSION.SDK_INT >= 26 &&
          !android.animation.ValueAnimator.areAnimatorsEnabled())
    ) {
      indicator.x = endX
      indicator.y = endY
      return
    }
    accentMotion =
      android.animation.ValueAnimator.ofFloat(0f, 1f).apply {
        duration = 100
        interpolator = android.view.animation.DecelerateInterpolator()
        addUpdateListener {
          val progress = it.animatedValue as Float
          indicator.x = startX + (endX - startX) * progress
          indicator.y = startY + (endY - startY) * progress
          updateAccentSelection()
        }
        start()
      }
  }

  fun move(rawX: Float, rawY: Float) {
    if (accentChoices.isEmpty()) return
    if (!accentDragStarted) {
      val slop = android.view.ViewConfiguration.get(context).scaledTouchSlop
      if (kotlin.math.hypot(rawX - accentOriginX, rawY - accentOriginY) <= slop) return
      accentDragStarted = true
    }
    val localX = rawX - accentPopupX - accentPanelPadding
    val localY = rawY - accentPopupY - accentPanelPadding
    val column = (localX / maxOf(1, accentUnit)).toInt().coerceIn(0, maxOf(0, accentColumns - 1))
    val row =
      (localY / maxOf(1, accentChoiceHeight))
        .toInt()
        .coerceIn(0, (accentChoices.size - 1) / maxOf(1, accentColumns))
    val index = (row * accentColumns + column).coerceAtMost(accentChoices.lastIndex)
    val rows = (accentChoices.size + accentColumns - 1) / accentColumns
    val inside =
      localX >= -accentPanelPadding &&
        localX < accentColumns * accentUnit + accentPanelPadding &&
        localY >= -accentPanelPadding &&
        localY < rows * accentChoiceHeight + accentPanelPadding
    selectedAccent = if (inside) accentChoices[index] else null
    if (inside) {
      placeAccentIndicator(index)
    } else {
      accentMotion?.cancel()
      accentMotion = null
      // Re-entry may target the same cell whose animation was interrupted.
      accentTarget = -1
    }
    accentIndicator?.visibility = if (selectedAccent == null) View.INVISIBLE else View.VISIBLE
    updateAccentSelection()
  }

  private fun updateAccentSelection() {
    accentChoices.forEach { button ->
      button.isSelected = button == selectedAccent
      val custom = theme.json.optJSONObject("sectionOverrides")?.optJSONObject("selection")
      val indicator = accentIndicator
      val index = accentChoices.indexOf(button)
      val centerX = accentPanelPadding + (index % maxOf(1, accentColumns) + 0.5f) * accentUnit
      val centerY =
        accentPanelPadding + (index / maxOf(1, accentColumns) + 0.5f) * accentChoiceHeight
      val distance =
        indicator?.let {
          kotlin.math.hypot(
            centerX - it.x - it.layoutParams.width / 2f,
            centerY - it.y - it.layoutParams.height / 2f,
          )
        } ?: Float.MAX_VALUE
      // Keep glyph contrast tied to the moving highlight, not the target cell.
      val coverage =
        if (selectedAccent == null) 0f
        else
          (1f - distance / maxOf(1f, (indicator?.layoutParams?.width ?: 0) / 2f)).coerceIn(0f, 1f)
      val selectedColor =
        custom?.let { KeyflowTheme(it).color("color", "#FFFFFF") } ?: android.graphics.Color.WHITE
      val normalColor = theme.styled("preview").foreground
      button.setTextColor(
        androidx.core.graphics.ColorUtils.blendARGB(normalColor, selectedColor, coverage)
      )
      // Native accents grow from 24dp to 32dp as the highlight reaches them.
      // Scale the glyph without relaying out the grid; cap custom fonts to
      // the available cell so wide or tall faces cannot overlap neighbours.
      val metrics = button.paint.fontMetrics
      val textWidth = button.paint.measureText(button.text.toString()).coerceAtLeast(1f)
      val textHeight = (metrics.descent - metrics.ascent).coerceAtLeast(1f)
      val available = minOf(accentUnit, accentChoiceHeight) - dp(4)
      val fitScale = minOf(4f / 3f, available / textWidth, available / textHeight)
      val baseScale = minOf(1f, fitScale)
      val scale = baseScale + (fitScale - baseScale) * coverage
      button.scaleX = scale
      button.scaleY = scale
    }
  }

  fun dismiss() {
    accentMotion?.cancel()
    accentMotion = null
    accentTarget = -1
    val popup = accentPopup
    accentPopup = null
    popup?.dismiss()
    accentChoices = emptyList()
    selectedAccent = null
    accentIndicator = null
    accentPopupX = 0
    accentPopupY = 0
    accentUnit = 0
    accentColumns = 0
    onVisibilityChanged(false)
  }
}
