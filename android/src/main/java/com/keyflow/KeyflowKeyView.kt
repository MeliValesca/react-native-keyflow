package com.keyflow

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.InsetDrawable
import android.graphics.drawable.LayerDrawable
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.widget.Button

internal class KeyflowKeyView(
  context: Context,
  val action: String,
  var label: String,
  private val activate: () -> Unit,
) : Button(context) {
  private val density
    get() = resources.displayMetrics.density

  private val geometry = KeyflowGeometry(resources)
  var allowsPreview = true
  var padKey = false
  var padLegend: String? = null
  var hint: String? = null
  var showsHint = true
  var hasAlternatives = false
  var popupHost: View? = null
  var compact = false
  var circular = false
  var themeSection: String? = null
  var iconSize = if (action in listOf("delete", "submit")) 26f else 24f
  private var actionIcon: String? = null
  private var actionUsesText = false
  var onSlide: ((Float, Float) -> Unit)? = null
  var onSlideStart: (() -> Unit)? = null
  var onSlideEnd: (() -> Unit)? = null
  var onHold: (() -> Boolean)? = null
  var onAccessibleHold: (() -> Boolean)? = null
  var onHoldMove: ((Float, Float) -> Unit)? = null
  var onHoldEnd: ((Boolean) -> Unit)? = null
  internal var holdTouchX: Float? = null
    private set

  internal var holdTouchY: Float? = null
    private set

  private var holding = false
  private val holdKey = Runnable {
    if (isPressed && isAttachedToWindow) {
      holding = onHold?.invoke() == true
      if (holding) hidePreview()
    }
  }
  private var previewPopup: android.widget.PopupWindow? = null
  private val dismissPreview = Runnable { hidePreview() }
  private var touchX = 0f
  private var touchY = 0f
  private var sliding = false
  private val icon
    get() =
      actionIcon != null ||
        (!actionUsesText &&
          action in
            listOf("shift", "capsLock", "tab", "delete", "submit", "paste", "hide", "nextLanguage"))

  fun setActionContent(value: String, icon: String?) {
    label = value
    contentDescription = value
    actionIcon = icon
    actionUsesText = icon == null
    text = if (icon == null) value else ""
    invalidate()
  }

  private var repeating = false
  private var preferredSize = 22f
  private var keyDepth = 0f
  private var currentTheme: KeyflowTheme? = null
  private val repeatDelete =
    object : Runnable {
      override fun run() {
        if (!repeating || !isAttachedToWindow) return
        activate()
        postDelayed(this, 65)
      }
    }

  init {
    isAllCaps = false
    isFocusable = false
    minimumWidth = 0
    minimumHeight = 0
    minWidth = 0
    minHeight = 0
    setPadding(0, 0, 0, 0)
    setSingleLine()
    contentDescription =
      when (action) {
        "delete" -> "Delete"
        "shift" -> "Shift"
        "space",
        "padspace" -> "Space"
        "submit" -> "Submit"
        else -> label
      }
    text = if (icon) "" else label
    setOnClickListener { activate() }
  }

  override fun onInitializeAccessibilityNodeInfo(
    info: android.view.accessibility.AccessibilityNodeInfo
  ) {
    super.onInitializeAccessibilityNodeInfo(info)
    if (hasAlternatives) {
      info.addAction(
        android.view.accessibility.AccessibilityNodeInfo.AccessibilityAction.ACTION_LONG_CLICK
      )
      info.isLongClickable = true
    }
  }

  override fun performAccessibilityAction(action: Int, arguments: android.os.Bundle?): Boolean {
    if (
      action == android.view.accessibility.AccessibilityNodeInfo.ACTION_LONG_CLICK &&
        hasAlternatives
    ) {
      return onAccessibleHold?.invoke() == true
    }
    return super.performAccessibilityAction(action, arguments)
  }

  private fun pressedColors(pressed: Int, normal: Int) =
    ColorStateList(
      arrayOf(intArrayOf(android.R.attr.state_pressed), intArrayOf()),
      intArrayOf(pressed, normal),
    )

  fun applyTheme(sourceTheme: KeyflowTheme) {
    val baseSection =
      themeSection
        ?: when (action) {
          "delete" -> "deleteKey"
          "submit" -> "returnKey"
          "letter" ->
            if (!padKey && !geometry.tablet && label in listOf(",", ".")) "specialKeys" else "keys"
          "space" -> "keys"
          "padpunct" -> "keys"
          else -> "specialKeys"
        }
    val section = if (isSelected && action == "capsLock") "selection" else baseSection
    val theme = sourceTheme.styled(section)
    currentTheme = sourceTheme
    val special =
      if (padKey) action in listOf("text", "padspace", "delete", "submit")
      else action !in listOf("letter", "space") || (!geometry.tablet && label in listOf(",", "."))
    val colorKey =
      when (action) {
        "submit" -> "actionKeyBackground"
        "delete" -> "deleteKeyBackground"
        else -> if (special) "specialKeyBackground" else "keyBackground"
      }
    val fill = theme.color(colorKey, if (special) "#DDE3EA" else "#FFFFFF")
    val foregroundKey =
      if (compact) "keyForeground"
      else
        when (action) {
          "submit" -> "actionKeyForeground"
          else -> if (special) "specialKeyForeground" else "keyForeground"
        }
    setTextColor(theme.color(foregroundKey, "#202124"))
    sourceTheme.section(section)?.let { style ->
      val palette = KeyflowTheme(style)
      setTextColor(
        ColorStateList(
          arrayOf(intArrayOf(android.R.attr.state_pressed), intArrayOf()),
          intArrayOf(
            palette.color("pressedColor", "#202124"),
            palette.color(if (icon) "iconColor" else "color", "#202124"),
          ),
        )
      )
    }
    preferredSize =
      when (action) {
        "letter" ->
          if (label in listOf(",", ".")) 22f else theme.fontSize * geometry.letterSize / 22f
        "numbers",
        "letters" -> 16f + (geometry.letterSize - 22f) / 3f
        else -> 16f
      }
    if (padKey)
      preferredSize =
        theme.fontSize *
          (when (label) {
            "123",
            "* #" -> 20f
            "Pause",
            "Wait" -> 24f
            else -> if (geometry.landscape) 28f else geometry.letterSize
          }) / 22f
    sourceTheme.json
      .optJSONObject("sectionOverrides")
      ?.optJSONObject(section)
      ?.takeIf { it.has("fontSize") }
      ?.let { preferredSize = it.getDouble("fontSize").toFloat() }
    typeface = theme.typeface(context.assets)
    keyDepth = if (theme.material == "raised") theme.depth else 0f
    val sectionRadiusWasCustomized =
      sourceTheme.json
        .optJSONObject("sectionOverrides")
        ?.optJSONObject(section)
        ?.has("cornerRadius") == true
    val faceRadius =
      if (geometry.tablet && theme.radius == 6f && !sectionRadiusWasCustomized) 12f
      else theme.radius
    includeFontPadding = false
    setPadding(0, if (label in listOf(",", ".")) (6 * density).toInt() else 0, 0, 0)
    if (padLegend != null) setPadding(0, 0, (14 * density).toInt(), 0)
    fitLabel()
    val face =
      GradientDrawable().apply {
        cornerRadius =
          if (
            (action == "submit" ||
              (!geometry.tablet && (padKey || action in listOf("numbers", "letters")))) &&
              theme.material == "flat"
          )
            minOf(height / 2f, faceRadius * height / 12f)
          else minOf(faceRadius * density, maxOf(0f, (width - 4 * density) / 2), height / 2f)
        // Raised keys use the same solid theme fill as iOS. Depth belongs to
        // the shadow below; a highlight gradient changes the configured color
        // (especially on return/delete keys) and adds an unrequested border.
        setColor(pressedColors(theme.color("pressedKeyBackground", "#C4C7C5"), fill))
      }
    sourceTheme
      .section(section)
      ?.takeIf {
        sourceTheme.json
          .optJSONObject("sectionOverrides")
          ?.optJSONObject(section)
          ?.has("borderWidth") == true
      }
      ?.let { style ->
        val borderWidth = (style.optDouble("borderWidth", 0.0) * density).toInt()
        val borderColor = KeyflowTheme(style).color("borderColor", "#00000000")
        face.setStroke(borderWidth, borderColor)
      }
    val gutter = (geometry.horizontalGutter * density).toInt()
    val vertical = (geometry.verticalGutter * density).toInt()
    background =
      if (compact && sourceTheme.section(section) != null) {
        val style = sourceTheme.section(section)!!
        val palette = KeyflowTheme(style)
        val diameter = minOf(width.toFloat(), height.toFloat(), 34 * density)
        InsetDrawable(
          GradientDrawable().apply {
            setColor(
              pressedColors(
                palette.color("pressedBackground", "#00000000"),
                palette.color("background", "#00000000"),
              )
            )
            cornerRadius = minOf(style.getDouble("cornerRadius").toFloat() * density, diameter / 2)
            setStroke(
              (style.getDouble("borderWidth") * density).toInt(),
              palette.color("borderColor", "#00000000"),
            )
          },
          maxOf(0, ((width - diameter) / 2).toInt()),
          maxOf(0, ((height - diameter) / 2).toInt()),
          maxOf(0, ((width - diameter) / 2).toInt()),
          maxOf(0, ((height - diameter) / 2).toInt()),
        )
      } else if (compact) {
        if (circular && (action == "back" || isSelected)) {
          val diameter = (if (action == "back") 34 else 32) * density
          InsetDrawable(
            GradientDrawable().apply {
              shape = GradientDrawable.OVAL
              setColor(
                theme.color(
                  if (action == "back") "keyBackground" else "actionKeyBackground",
                  "#FFFFFF",
                )
              )
            },
            maxOf(0, ((width - diameter) / 2).toInt()),
            maxOf(0, ((height - diameter) / 2).toInt()),
            maxOf(0, ((width - diameter) / 2).toInt()),
            maxOf(0, ((height - diameter) / 2).toInt()),
          )
        } else android.graphics.drawable.ColorDrawable(Color.TRANSPARENT)
      } else if (theme.material == "raised") {
        val base =
          GradientDrawable().apply {
            setColor(theme.color("keyShadow", "#002941"))
            cornerRadius =
              if (
                (action == "submit" ||
                  (!geometry.tablet && (padKey || action in listOf("numbers", "letters")))) &&
                  theme.material == "flat"
              )
                minOf(height / 2f, faceRadius * height / 12f)
              else minOf(faceRadius * density, maxOf(0f, (width - 4 * density) / 2), height / 2f)
          }
        LayerDrawable(
            arrayOf(
              InsetDrawable(base, gutter, vertical, gutter, vertical),
              InsetDrawable(
                face,
                gutter,
                vertical,
                gutter,
                vertical + (theme.depth * density).toInt(),
              ),
            )
          )
          .apply { paddingMode = LayerDrawable.PADDING_MODE_STACK }
      } else
        InsetDrawable(
          face,
          gutter,
          vertical,
          gutter,
          if (padKey && !geometry.landscape) 0 else vertical,
        )
    foreground =
      object : android.graphics.drawable.Drawable() {
        override fun draw(canvas: Canvas) {
          // Single-line TextView uses a large internal horizontal scroll origin.
          // Foreground artwork belongs to the key face, not its text layout.
          val checkpoint = canvas.save()
          canvas.translate(scrollX.toFloat(), scrollY.toFloat())

          if (icon)
            KeyflowIcons.draw(
              canvas,
              if (action == "shift" && isActivated) "shiftLocked" else actionIcon ?: action,
              bounds.exactCenterX(),
              bounds.exactCenterY() - keyDepth * density / 2,
              (sourceTheme.json
                .optJSONObject("sectionOverrides")
                ?.optJSONObject(section)
                ?.optDouble("iconSize", iconSize.toDouble())
                ?.toFloat() ?: iconSize) * density,
              currentTextColor,
              isSelected,
            )
          if (padKey && action == "padspace") {
            val pen =
              Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = currentTextColor
                strokeWidth = 1.5f * density
                style = Paint.Style.STROKE
              }
            val cx = bounds.exactCenterX()
            val cy = bounds.exactCenterY()
            canvas.drawLines(
              floatArrayOf(
                cx - 7 * density,
                cy - 2 * density,
                cx - 7 * density,
                cy + 2 * density,
                cx - 7 * density,
                cy + 2 * density,
                cx + 7 * density,
                cy + 2 * density,
                cx + 7 * density,
                cy + 2 * density,
                cx + 7 * density,
                cy - 2 * density,
              ),
              pen,
            )
          }
          padLegend?.let {
            val pen =
              Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = currentTextColor
                textSize = 12 * density
                typeface = theme.typeface(context.assets)
                textAlign = Paint.Align.LEFT
              }
            canvas.drawText(
              it,
              bounds.exactCenterX() + 13 * density,
              bounds.exactCenterY() + 4 * density,
              pen,
            )
          }
          hint
            ?.takeIf { showsHint }
            ?.let {
              val pen =
                Paint(Paint.ANTI_ALIAS_FLAG).apply {
                  color = currentTextColor
                  textSize = (if (geometry.tablet) 15 else 10) * density
                  typeface = theme.typeface(context.assets)
                  textAlign = Paint.Align.RIGHT
                }
              // Keep the hint inside the key face. A fixed baseline placed the top of
              // tall/custom-font digits on the face border (and sometimes above it).
              val faceTop = bounds.top + geometry.verticalGutter * density
              // Leave enough clearance for custom glyph overshoot and thick theme
              // borders. FontMetrics.ascent alone is too optimistic for outlined
              // and decorative fonts, which made 1–0 touch the top edge.
              val hintTopInset = (if (geometry.tablet) 5f else 6f) * density
              val baseline = faceTop + hintTopInset - pen.fontMetrics.ascent
              val rightInset = (geometry.horizontalGutter + if (geometry.tablet) 8 else 3) * density
              canvas.drawText(it, bounds.right - rightInset, baseline, pen)
            }
          canvas.restoreToCount(checkpoint)
        }

        override fun setAlpha(alpha: Int) {}

        override fun setColorFilter(filter: android.graphics.ColorFilter?) {}

        override fun getOpacity() = android.graphics.PixelFormat.TRANSLUCENT
      }
    stateListAnimator = null
  }

  fun labelFits(): Boolean {
    padLegend?.let { legend ->
      val pen =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
          textSize = 12 * density
          typeface = paint.typeface
        }
      if (
        width / 2f + 13 * density + pen.measureText(legend) > width + 1 ||
          pen.fontMetrics.bottom - pen.fontMetrics.top > height - 4 * density
      )
        return false
    }
    if (icon) return width >= 24 * density && height >= 24 * density
    val metrics = paint.fontMetrics
    val verticalInset = if (padKey) (if (geometry.landscape) 4 else 6) else 10
    val faceWidth = width - 2 * geometry.horizontalGutter * density
    val horizontalInset = KeyflowLabelBounds.horizontalInsetDp(action) * density
    return paint.measureText(text.toString()) <= faceWidth - horizontalInset + 1 &&
      metrics.bottom - metrics.top <= height - verticalInset * density + 1
  }

  private fun fitLabel() {
    setTextSize(android.util.TypedValue.COMPLEX_UNIT_DIP, preferredSize)
    if (width <= 0 || height <= 0) return
    // The drawable is inset by the row gutter. Page labels such as ?123/ABC
    // must fit the visible rounded face rather than the containing row cell.
    val faceWidth = width - 2 * geometry.horizontalGutter * density
    val horizontalInset = KeyflowLabelBounds.horizontalInsetDp(action)
    val availableWidth = maxOf(1f, faceWidth - horizontalInset * density)
    val verticalInset = if (padKey) (if (geometry.landscape) 4 else 6) else 12
    val availableHeight = maxOf(1f, height - (verticalInset + keyDepth) * density)
    val metrics = paint.fontMetrics
    val scale =
      minOf(
        1f,
        availableWidth / maxOf(1f, paint.measureText(text.toString())),
        availableHeight / maxOf(1f, metrics.bottom - metrics.top),
      )
    setTextSize(android.util.TypedValue.COMPLEX_UNIT_PX, preferredSize * density * scale)
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    currentTheme?.let { applyTheme(it) }
  }

  override fun onTextChanged(text: CharSequence?, start: Int, lengthBefore: Int, lengthAfter: Int) {
    super.onTextChanged(text, start, lengthBefore, lengthAfter)
    if (preferredSize > 0f) fitLabel()
  }

  override fun onDraw(canvas: Canvas) {
    // Roboto's j has a negative left bearing. Gboard optically centers this
    // glyph rather than its advance box; retain custom fonts' own placement.
    val defaultFont = currentTheme?.styled("keys")?.json?.isNull("fontFamily") == true
    val caption = text.toString()
    val opticalJ = action == "letter" && caption == "j" && defaultFont
    val lowercase =
      action == "letter" && caption.length == 1 && caption[0].isLowerCase() && defaultFont
    val checkpoint = canvas.save()
    val baselineOffset =
      when {
        !lowercase || caption == "g" -> 0f
        caption == "j" -> -textSize * 2 / 28
        else -> -textSize * 3 / 26
      }
    canvas.translate(if (opticalJ) textSize * 3 / 28 else 0f, baselineOffset)
    super.onDraw(canvas)
    canvas.restoreToCount(checkpoint)
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (action == "letter") {
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> showPreview()
        MotionEvent.ACTION_MOVE ->
          if (event.x < 0 || event.x > width || event.y < 0 || event.y > height) hidePreview()
        MotionEvent.ACTION_UP -> postDelayed(dismissPreview, 80)
        MotionEvent.ACTION_CANCEL -> hidePreview()
      }
    }
    if (onHold != null) {
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          holdTouchX = event.rawX
          holdTouchY = event.rawY
          holding = false
          postDelayed(holdKey, ViewConfiguration.getLongPressTimeout().toLong())
        }
        MotionEvent.ACTION_MOVE -> {
          if (holding) {
            onHoldMove?.invoke(event.rawX, event.rawY)
            return true
          }
          if (event.x < 0 || event.x > width || event.y < 0 || event.y > height)
            removeCallbacks(holdKey)
        }
        MotionEvent.ACTION_UP,
        MotionEvent.ACTION_CANCEL -> {
          removeCallbacks(holdKey)
          if (holding) {
            if (event.actionMasked == MotionEvent.ACTION_UP) {
              onHoldMove?.invoke(event.rawX, event.rawY)
            }
            holding = false
            isPressed = false
            onHoldEnd?.invoke(event.actionMasked == MotionEvent.ACTION_UP)
            return true
          }
        }
      }
    }
    if (action == "space" && onSlide != null) {
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          touchX = event.x
          touchY = event.y
          onSlideStart?.invoke()
          sliding = false
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = event.x - touchX
          val dy = event.y - touchY
          val slop = ViewConfiguration.get(context).scaledTouchSlop
          if (sliding || kotlin.math.hypot(dx, dy) > slop) {
            sliding = true
            onSlide?.invoke(dx, dy)
            isPressed = true
          }
        }
        MotionEvent.ACTION_UP ->
          if (sliding) {
            onSlide?.invoke(event.x - touchX, event.y - touchY)
            onSlideEnd?.invoke()
            sliding = false
            isPressed = false
            return true
          }
        MotionEvent.ACTION_CANCEL -> {
          onSlideEnd?.invoke()
          sliding = false
        }
      }
      if (sliding) return true
    }
    if (action != "delete") {
      val handled = super.onTouchEvent(event)
      // View normally keeps a tap pressed briefly after ACTION_UP. Keyboard
      // feedback ends at release, without a ripple or delayed pressed state.
      if (
        event.actionMasked == MotionEvent.ACTION_UP ||
          event.actionMasked == MotionEvent.ACTION_CANCEL
      )
        isPressed = false
      return handled
    }
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        isPressed = true
        performClick()
        repeating = true
        postDelayed(repeatDelete, 500)
      }
      MotionEvent.ACTION_MOVE ->
        if (event.x < 0 || event.x > width || event.y < 0 || event.y > height) cancelRepeat()
      MotionEvent.ACTION_UP,
      MotionEvent.ACTION_CANCEL -> cancelRepeat()
    }
    return true
  }

  private fun showPreview() {
    if (!allowsPreview) return
    hidePreview()
    val source = currentTheme ?: return
    val host = popupHost ?: return
    if (!isAttachedToWindow || !host.isAttachedToWindow || host.windowToken == null) return
    val style = source.styled("preview")
    val size = (58 * density).toInt()
    val popupText = text.toString()
    val content =
      object : View(context) {
          private val pen = Paint(Paint.ANTI_ALIAS_FLAG)

          override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            pen.color = style.foreground
            pen.typeface = style.typeface(context.assets)
            val override = source.json.optJSONObject("sectionOverrides")?.optJSONObject("preview")
            pen.textSize =
              (override?.optDouble("fontSize", 28.0)?.toFloat() ?: (style.fontSize * 28 / 22)) *
                density
            pen.textSize *=
              minOf(1f, (width - 12 * density) / maxOf(1f, pen.measureText(popupText)))
            pen.textAlign = Paint.Align.CENTER
            canvas.drawText(
              popupText,
              width / 2f,
              height / 2f - (pen.ascent() + pen.descent()) / 2,
              pen,
            )
            if (hasAlternatives || hint != null) {
              for (offset in -1..1) canvas.drawCircle(
                width / 2f + offset * 4 * density,
                height - 8 * density,
                density,
                pen,
              )
            }
          }
        }
        .apply {
          val override = source.json.optJSONObject("sectionOverrides")?.optJSONObject("preview")
          val radius = (override?.optDouble("cornerRadius", 29.0)?.toFloat() ?: 29f) * density
          background =
            GradientDrawable()
              .apply {
                setColor(style.color("keyBackground", "#FFFFFF"))
                cornerRadius = radius
              }
              .apply {
                if (override?.has("borderWidth") == true)
                  source.section("preview")?.let { section ->
                    val width = (section.optDouble("borderWidth", 0.0) * density).toInt()
                    val color = KeyflowTheme(section).color("borderColor", "#00000000")
                    setStroke(width, color)
                  }
              }
        }
    val location = IntArray(2)
    getLocationOnScreen(location)
    val screenWidth = resources.displayMetrics.widthPixels
    val previewBackground = content.background
    content.background = null
    previewPopup =
      android.widget.PopupWindow(content, size, size, false).apply {
        setBackgroundDrawable(previewBackground)
        isTouchable = false
        elevation = 4 * density
        showAtLocation(
          host,
          android.view.Gravity.NO_GRAVITY,
          (location[0] + this@KeyflowKeyView.width / 2 - size / 2).coerceIn(
            0,
            maxOf(0, screenWidth - size),
          ),
          location[1] - size,
        )
      }
  }

  private fun hidePreview() {
    removeCallbacks(dismissPreview)
    previewPopup?.dismiss()
    previewPopup = null
  }

  fun cancelRepeat() {
    repeating = false
    isPressed = false
    hidePreview()
    removeCallbacks(repeatDelete)
    removeCallbacks(holdKey)
    if (holding) {
      holding = false
      onHoldEnd?.invoke(false)
    }
  }

  override fun onDetachedFromWindow() {
    cancelRepeat()
    super.onDetachedFromWindow()
  }
}
