package com.keyflow

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF

/** Monochrome paths keep action icons independent of the user's text font. */
internal object KeyflowIcons {
  fun draw(
    canvas: Canvas,
    name: String,
    cx: Float,
    cy: Float,
    size: Float,
    tint: Int,
    selected: Boolean = false,
  ) {
    val checkpoint = canvas.save()
    canvas.translate(cx - size / 2, cy - size / 2)
    canvas.scale(size / 24, size / 24)
    val p =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = tint
        style = Paint.Style.STROKE
        strokeWidth = 2f
        strokeJoin = Paint.Join.ROUND
        strokeCap = Paint.Cap.ROUND
      }
    fun path(vararg points: Float, close: Boolean = false) {
      val shape =
        Path().apply {
          moveTo(points[0], points[1])
          for (i in 2 until points.size step 2) lineTo(points[i], points[i + 1])
          if (close) close()
        }
      canvas.drawPath(shape, p)
    }
    when (name) {
      "shift",
      "shiftLocked" -> {
        val locked = name == "shiftLocked"
        if (selected || locked) p.style = Paint.Style.FILL
        val stemBottom = if (locked) 18f else 21f
        path(
          12f,
          3f,
          21f,
          12f,
          16f,
          12f,
          16f,
          stemBottom,
          8f,
          stemBottom,
          8f,
          12f,
          3f,
          12f,
          close = true,
        )
        if (locked) canvas.drawRect(8f, 21f, 16f, 23f, p)
      }
      // Gboard's tablet Caps Lock is a chevron with a detached underline,
      // distinct from the full outlined arrows used by its Shift keys.
      "capsLock" -> {
        p.strokeWidth = 2.8f
        path(6f, 12f, 12f, 6f, 18f, 12f)
        path(8f, 18f, 16f, 18f)
      }
      "tab" -> {
        path(3f, 12f, 17f, 12f)
        path(13f, 8f, 17f, 12f, 13f, 16f)
        path(21f, 6f, 21f, 18f)
      }
      "delete" -> {
        path(9f, 4f, 22f, 4f, 22f, 20f, 9f, 20f, 2f, 12f, close = true)
        path(12f, 9f, 18f, 15f)
        path(18f, 9f, 12f, 15f)
      }
      "submit" -> path(4f, 12f, 9f, 17f, 20f, 6f)
      "paste" -> {
        canvas.drawRoundRect(RectF(5f, 4f, 19f, 22f), 1f, 1f, p)
        canvas.drawRoundRect(RectF(9f, 2f, 15f, 6f), 1f, 1f, p)
        path(8f, 10f, 16f, 10f)
        path(8f, 14f, 16f, 14f)
        path(8f, 18f, 13f, 18f)
      }
      "nextLanguage" -> {
        canvas.drawCircle(12f, 12f, 9f, p)
        canvas.drawOval(RectF(8f, 3f, 16f, 21f), p)
        path(3f, 12f, 21f, 12f)
      }
      "hide" -> path(6f, 9f, 12f, 15f, 18f, 9f)
    }
    canvas.restoreToCount(checkpoint)
  }
}
