package com.keyflow

import android.content.res.AssetManager
import android.graphics.Typeface
import com.facebook.react.common.assets.ReactFontManager
import org.json.JSONObject

internal data class KeyflowTheme(val json: JSONObject = JSONObject()) {
  fun color(name: String, fallback: String): Int {
    val color = json.optString(name, fallback)
    val hex = color.removePrefix("#")
    val value = hex.toLong(16)
    return if (hex.length == 8) ((value and 255) shl 24 or (value ushr 8)).toInt()
    else (0xFF000000 or value).toInt()
  }

  fun section(name: String) = json.optJSONObject("sections")?.optJSONObject(name)

  fun styled(name: String): KeyflowTheme {
    val style = section(name) ?: return this
    val copy = JSONObject(json.toString()).apply { remove("sections") }
    for (key in
      listOf(
        "background",
        "keyBackground",
        "specialKeyBackground",
        "deleteKeyBackground",
        "actionKeyBackground",
      )) copy.put(key, style.getString("background"))
    for (key in listOf("keyForeground", "specialKeyForeground", "actionKeyForeground")) copy.put(
      key,
      style.getString("color"),
    )
    copy.put("pressedKeyBackground", style.getString("pressedBackground"))
    for (key in listOf("fontFamily", "fontSize", "fontWeight")) copy.put(key, style.get(key))
    copy.put("keyCornerRadius", style.getDouble("cornerRadius"))
    return KeyflowTheme(copy)
  }

  fun applyText(view: android.widget.TextView, name: String, placeholder: Boolean = false) {
    val style = section(name) ?: return
    val palette = KeyflowTheme(style)
    view.setTextColor(
      android.content.res.ColorStateList(
        arrayOf(intArrayOf(android.R.attr.state_pressed), intArrayOf()),
        intArrayOf(
          palette.color("pressedColor", "#000000"),
          palette.color(if (placeholder) "placeholderColor" else "color", "#000000"),
        ),
      )
    )
    view.typeface = styled(name).typeface(view.context.assets)
    view.setTextSize(
      android.util.TypedValue.COMPLEX_UNIT_DIP,
      style.getDouble("fontSize").toFloat(),
    )
    view.setSingleLine()
    androidx.core.widget.TextViewCompat.setAutoSizeTextTypeUniformWithConfiguration(
      view,
      8,
      style.getDouble("fontSize").toInt().coerceAtLeast(8),
      1,
      android.util.TypedValue.COMPLEX_UNIT_DIP,
    )
    val density = view.resources.displayMetrics.density
    val face =
      android.graphics.drawable.GradientDrawable().apply {
        setColor(palette.color("background", "#00000000"))
        cornerRadius = style.getDouble("cornerRadius").toFloat() * density
        setStroke(
          (style.getDouble("borderWidth") * density).toInt(),
          palette.color("borderColor", "#00000000"),
        )
      }
    view.background =
      android.graphics.drawable.RippleDrawable(
        android.content.res.ColorStateList.valueOf(palette.color("pressedBackground", "#00000000")),
        face,
        null,
      )
  }

  val background
    get() = color("background", "#EEEDF4")

  val foreground
    get() = color("keyForeground", "#1A1B21")

  val material
    get() = json.optString("material", "flat")

  val radius
    get() = bounded("keyCornerRadius", 6f, 0f, 24f)

  val keyboardRadius
    get() = bounded("keyboardCornerRadius", 28f, 0f, 48f)

  val keyboardBorderWidth
    get() = bounded("keyboardBorderWidth", 0f, 0f, 3f)

  val keyboardBorderColor
    get() = color("keyboardBorderColor", "#00000000")

  val depth
    get() = bounded("keyDepth", 4f, 0f, 6f)

  val fontSize
    get() = bounded("fontSize", 22f, 12f, 32f)

  private fun bounded(name: String, fallback: Float, min: Float, max: Float): Float {
    val value = json.optDouble(name, fallback.toDouble()).toFloat()
    return if (value.isFinite()) value.coerceIn(min, max) else fallback
  }

  fun typeface(assets: AssetManager): Typeface {
    val name =
      if (json.isNull("fontFamily")) "sans-serif" else json.optString("fontFamily", "sans-serif")
    val family =
      when (name) {
        "system-rounded" -> "sans-serif-rounded"
        "system-serif" -> "serif"
        "system-monospace" -> "monospace"
        else -> name
      }
    val normal = ReactFontManager.getInstance().getTypeface(family, Typeface.NORMAL, assets)
    return when (json.optString("fontWeight")) {
      "bold" -> Typeface.create(normal, Typeface.BOLD)
      "medium" ->
        if (android.os.Build.VERSION.SDK_INT >= 28) Typeface.create(normal, 500, false)
        else Typeface.create(family + "-medium", Typeface.NORMAL)
      else -> normal
    }
  }
}
