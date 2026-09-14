package com.keyflow

import android.animation.ValueAnimator
import android.graphics.Color
import android.view.View
import android.widget.Button
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** These tests run unchanged in the phone and tablet CI jobs. */
@RunWith(AndroidJUnit4::class)
class KeyflowAccentInteractionTest {
  private class Popup(val activity: KeyflowTestActivity) {
    val keyboard = activity.keyboard
    val key
      get() =
        (field("keys") as List<*>).filterIsInstance<KeyflowKeyView>().first { it.label == "a" }

    fun field(name: String): Any? = keyboardField(keyboard, name)

    val choices
      get() = (field("accentChoices") as List<*>).filterIsInstance<Button>()

    val selected
      get() = field("selectedAccent") as Button

    val indicator
      get() = field("accentIndicator") as View

    val motion
      get() = field("accentMotion") as? ValueAnimator

    fun hold() {
      assertTrue("Accent popup must open", key.onHold?.invoke() == true)
    }

    fun move(column: Float, row: Float) {
      key.onHoldMove?.invoke(
        (field("accentPopupX") as Int) +
          (field("accentPanelPadding") as Int) +
          column * (field("accentUnit") as Int),
        (field("accentPopupY") as Int) +
          (field("accentPanelPadding") as Int) +
          row * (field("accentChoiceHeight") as Int),
      )
    }
  }

  private fun popup(check: (Popup) -> Unit) {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      scenario.onActivity { activity ->
        val popup = Popup(activity)
        try {
          popup.hold()
          check(popup)
        } finally {
          activity.keyboard.cancelTouches()
        }
      }
    }
  }

  @Test
  fun stationaryMoveAfterHoldKeepsInitialAccentSelected() = popup { p ->
    val selected = p.selected
    val location = IntArray(2)
    p.key.getLocationOnScreen(location)
    repeat(5) {
      p.key.onHoldMove!!.invoke(location[0] + p.key.width / 2f, location[1] + p.key.height / 2f)
    }
    assertSame(selected, p.selected)
    assertEquals(View.VISIBLE, p.indicator.visibility)
    assertEquals(Color.WHITE, p.selected.currentTextColor)
  }

  @Test
  fun offCenterHoldUsesTheActualTouchOrigin() = popup { p ->
    p.keyboard.cancelTouches()
    val time = android.os.SystemClock.uptimeMillis()
    val down =
      android.view.MotionEvent.obtain(time, time, android.view.MotionEvent.ACTION_DOWN, 4f, 4f, 0)
    try {
      p.key.onTouchEvent(down)
      p.hold()
      val selected = p.selected
      p.key.onHoldMove!!.invoke(down.rawX, down.rawY)
      assertSame("A stationary off-center hold must not cancel", selected, p.selected)
      assertEquals(View.VISIBLE, p.indicator.visibility)
    } finally {
      down.recycle()
    }
  }

  @Test
  fun cancelledSelectionRestoresReadableGlyphs() = popup { p ->
    p.move(0.5f, -10f)
    assertEquals(View.INVISIBLE, p.indicator.visibility)
    p.choices.forEach {
      assertEquals(p.keyboard.theme.foreground, it.currentTextColor)
      assertEquals(1f, it.scaleX, 0.01f)
    }
  }

  @Test
  fun heldAccentUsesNativeEnlargement() = popup { p ->
    val density = p.activity.resources.displayMetrics.density
    assertEquals(
      "Selected glyph is 32dp",
      32f,
      p.selected.textSize * p.selected.scaleX / density,
      0.5f,
    )
    p.choices
      .filter { it != p.selected }
      .forEach {
        assertEquals("Unselected glyph is 24dp", 24f, it.textSize * it.scaleX / density, 0.5f)
      }
  }

  @Test
  fun heldAccentUsesNativeHighlightDiameter() = popup { p ->
    val tablet = p.activity.resources.configuration.smallestScreenWidthDp >= 600
    assertEquals(
      if (tablet) 50f else 44f,
      p.indicator.layoutParams.width / p.activity.resources.displayMetrics.density,
      1f,
    )
  }

  @Test
  fun heldAccentUsesNativeHighlightColor() = popup { p ->
    val tablet = p.activity.resources.configuration.smallestScreenWidthDp >= 600
    val background = p.indicator.background as android.graphics.drawable.GradientDrawable
    assertEquals(Color.rgb(if (tablet) 73 else 71, 93, 146), background.color!!.defaultColor)
  }

  @Test
  fun accentOrderMatchesTheDeviceReference() = popup { p ->
    val tablet = p.activity.resources.configuration.smallestScreenWidthDp >= 600
    assertEquals(
      (if (tablet) "ÅÆÃĀÂÀÁÄ" else "ÆÃÅĀÀÁÂÄ").map { it.toString() },
      p.choices.map { it.text.toString() },
    )
  }

  @Test
  fun heldAccentHasWhiteTextAndDarkUnselectedText() = popup { p ->
    assertEquals(Color.WHITE, p.selected.currentTextColor)
    p.choices
      .filter { it != p.selected }
      .forEach { assertEquals(p.keyboard.theme.foreground, it.currentTextColor) }
  }

  @Test
  fun draggedAccentEnlargesAndPreviousAccentShrinks() = popup { p ->
    val previous = p.selected
    p.move(0.5f, 0.5f)
    p.motion!!.end()
    assertNotSame(previous, p.selected)
    assertEquals(1f, previous.scaleX, 0.01f)
    assertEquals(4f / 3f, p.selected.scaleX, 0.01f)
    assertEquals(Color.WHITE, p.selected.currentTextColor)
  }

  @Test
  fun glyphScaleAndColorHaveIntermediateAnimationFrames() = popup { p ->
    p.move(0.5f, 0.5f)
    p.motion!!.end()
    p.move(1.5f, 0.5f)
    val target = p.selected
    p.motion!!.currentPlayTime = 50
    assertTrue("Scale must interpolate", target.scaleX > 1f && target.scaleX < 4f / 3f)
    assertNotEquals("Color must interpolate", Color.WHITE, target.currentTextColor)
    assertNotEquals(
      "Color must leave unselected state",
      p.keyboard.theme.foreground,
      target.currentTextColor,
    )
  }

  private fun diagonal(startRow: Float, endRow: Float) = popup { p ->
    p.move(0.5f, startRow)
    p.motion?.end()
    val startX = p.indicator.x
    val startY = p.indicator.y
    p.move(1.5f, endRow)
    p.motion!!.currentPlayTime = 50
    val xProgress = (p.indicator.x - startX) / (p.field("accentUnit") as Int)
    val yProgress =
      (p.indicator.y - startY) / ((endRow - startRow) * (p.field("accentChoiceHeight") as Int))
    assertTrue("Diagonal has intermediate X", xProgress > 0f && xProgress < 1f)
    assertEquals("Both axes advance together", xProgress, yProgress, 0.01f)
  }

  @Test fun downwardDiagonalMovesBothAxesTogether() = diagonal(0.5f, 1.5f)

  @Test fun upwardDiagonalMovesBothAxesTogether() = diagonal(1.5f, 0.5f)

  @Test
  fun dragReleaseCommitsOnlyTheSelectedAccent() = popup { p ->
    p.move(0.5f, 0.5f)
    val expected = p.selected.text.toString()
    p.key.onHoldEnd!!.invoke(true)
    assertEquals(listOf("text" to expected), p.activity.output)
    assertNull(p.field("accentPopup"))
  }

  @Test
  fun dragCancellationDoesNotCommitAnAccent() = popup { p ->
    p.move(0.5f, -10f)
    p.key.onHoldEnd!!.invoke(true)
    assertTrue(p.activity.output.isEmpty())
    assertNull(p.field("accentPopup"))
  }

  @Test fun dragOutsideLeftClearsSelection() = assertOutside(-10f, 0.5f)

  @Test fun dragOutsideRightClearsSelection() = assertOutside(100f, 0.5f)

  @Test fun dragOutsideTopClearsSelection() = assertOutside(0.5f, -10f)

  @Test fun dragOutsideBottomClearsSelection() = assertOutside(0.5f, 100f)

  @Test fun dragOutsideDiagonalClearsSelection() = assertOutside(-10f, -10f)

  private fun assertOutside(column: Float, row: Float) = popup { p ->
    p.move(0.5f, 0.5f)
    val popup = p.field("accentPopup") as android.widget.PopupWindow
    val originX = (p.field("accentPopupX") as Int).toFloat()
    val originY = (p.field("accentPopupY") as Int).toFloat()
    val padding = (p.field("accentPanelPadding") as Int).toFloat()
    // Probe the actual edge, not a distant point outside any generous tolerance.
    val x =
      when {
        column < 0 -> originX - 1f
        column >= 100 -> originX + popup.width
        else -> originX + padding + column * (p.field("accentUnit") as Int)
      }
    val y =
      when {
        row < 0 -> originY - 1f
        row >= 100 -> originY + popup.height
        else -> originY + padding + row * (p.field("accentChoiceHeight") as Int)
      }
    p.key.onHoldMove!!.invoke(x, y)
    assertNull(
      "Outside drag must clear selection while the finger is down",
      p.field("selectedAccent"),
    )
    assertEquals(View.INVISIBLE, p.indicator.visibility)
    assertNull("Outside drag must stop the moving highlight", p.motion)
    p.key.onHoldEnd!!.invoke(true)
    assertTrue("Outside release must not insert an accent", p.activity.output.isEmpty())
  }

  @Test
  fun reenteringPopupResumesInterruptedSelection() = popup { p ->
    p.move(0.5f, 0.5f)
    p.motion?.end()
    p.move(1.5f, 0.5f)
    p.motion!!.currentPlayTime = 30
    p.move(-10f, 0.5f)
    p.move(1.5f, 0.5f)
    assertEquals(View.VISIBLE, p.indicator.visibility)
    assertSame(p.choices[1], p.selected)
    assertNotNull("Re-entry restarts the interrupted movement", p.motion)
    p.motion!!.end()
    assertEquals(p.choices[1].scaleX, 4f / 3f, 0.01f)
    val expected = p.selected.text.toString()
    p.key.onHoldEnd!!.invoke(true)
    assertEquals(listOf("text" to expected), p.activity.output)
  }

  private fun focusTheme(p: Popup, background: String, color: String) {
    p.keyboard.cancelTouches()
    p.keyboard.theme =
      KeyflowTheme(
        JSONObject()
          .put(
            "sectionOverrides",
            JSONObject()
              .put("selection", JSONObject().put("background", background).put("color", color)),
          )
      )
    p.hold()
  }

  @Test
  fun customFocusBackgroundIsAppliedWhenHeld() = popup { p ->
    focusTheme(p, "#733A91", "#FFFFFF")
    assertEquals(
      Color.rgb(115, 58, 145),
      (p.indicator.background as android.graphics.drawable.GradientDrawable).color!!.defaultColor,
    )
  }

  @Test
  fun customFocusTextColorIsAppliedWhenHeld() = popup { p ->
    focusTheme(p, "#A8E6CF", "#123B32")
    assertEquals(Color.rgb(18, 59, 50), p.selected.currentTextColor)
  }

  @Test
  fun customFocusColorsFollowDraggedSelection() = popup { p ->
    focusTheme(p, "#A8E6CF", "#123B32")
    val previous = p.selected
    p.move(1.5f, 0.5f)
    p.motion!!.end()
    assertNotSame(previous, p.selected)
    assertEquals(Color.rgb(18, 59, 50), p.selected.currentTextColor)
    assertEquals(p.keyboard.theme.foreground, previous.currentTextColor)
    assertEquals(
      Color.rgb(168, 230, 207),
      (p.indicator.background as android.graphics.drawable.GradientDrawable).color!!.defaultColor,
    )
  }

  @Test
  fun switchingFocusThemeReplacesBothColors() = popup { p ->
    focusTheme(p, "#733A91", "#FFFFFF")
    focusTheme(p, "#A8E6CF", "#123B32")
    assertEquals(Color.rgb(18, 59, 50), p.selected.currentTextColor)
    assertEquals(
      Color.rgb(168, 230, 207),
      (p.indicator.background as android.graphics.drawable.GradientDrawable).color!!.defaultColor,
    )
  }

  @Test
  fun resettingFocusThemeRestoresNativeColors() = popup { p ->
    focusTheme(p, "#A8E6CF", "#123B32")
    p.keyboard.cancelTouches()
    p.keyboard.theme = KeyflowTheme()
    p.hold()
    val tablet = p.activity.resources.configuration.smallestScreenWidthDp >= 600
    assertEquals(Color.WHITE, p.selected.currentTextColor)
    assertEquals(
      Color.rgb(if (tablet) 73 else 71, 93, 146),
      (p.indicator.background as android.graphics.drawable.GradientDrawable).color!!.defaultColor,
    )
  }

  @Test
  fun customSelectedColorAndFontSizeRemainSupported() = popup { p ->
    p.keyboard.cancelTouches()
    p.keyboard.theme =
      KeyflowTheme(
        JSONObject()
          .put(
            "sectionOverrides",
            JSONObject().put("selection", JSONObject().put("color", "#FF3366").put("fontSize", 28)),
          )
      )
    p.hold()
    assertEquals(Color.rgb(255, 51, 102), p.selected.currentTextColor)
    assertEquals(28f, p.selected.textSize / p.activity.resources.displayMetrics.density, 0.1f)
    val metrics = p.selected.paint.fontMetrics
    assertTrue(
      "Enlarged custom glyph stays inside its cell",
      (metrics.descent - metrics.ascent) * p.selected.scaleY <=
        (p.field("accentChoiceHeight") as Int),
    )
  }
}
