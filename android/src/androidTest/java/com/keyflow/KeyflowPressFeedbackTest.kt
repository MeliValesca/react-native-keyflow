package com.keyflow

import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.SystemClock
import android.view.MotionEvent
import android.widget.FrameLayout
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Runs on both phone and tablet; checks the rendered face at release, not just click output. */
@RunWith(AndroidJUnit4::class)
class KeyflowPressFeedbackTest {
  @Test
  fun multilineCursorPreservesColumnAndMovesOnBothAxes() {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      scenario.onActivity { activity ->
        val editor = android.widget.EditText(activity)
        editor.inputType =
          android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
        editor.typeface = android.graphics.Typeface.MONOSPACE
        editor.textSize = 18f
        editor.setText("abcdefghi\nx\nabcdefghi\nlong text that wraps onto several visual lines")
        val host = FrameLayout(activity)
        val density = activity.resources.displayMetrics.density
        val width = (150 * density).toInt()
        host.addView(editor, FrameLayout.LayoutParams(width, (220 * density).toInt()))
        activity.setContentView(host)
        editor.measure(
          android.view.View.MeasureSpec.makeMeasureSpec(
            width,
            android.view.View.MeasureSpec.EXACTLY,
          ),
          android.view.View.MeasureSpec.makeMeasureSpec(
            (220 * density).toInt(),
            android.view.View.MeasureSpec.EXACTLY,
          ),
        )
        editor.layout(0, 0, width, editor.measuredHeight)
        val cursor = KeyflowCursorNavigator()
        editor.setSelection(5)
        val layout = editor.layout
        val lineHeight = (layout.getLineBottom(0) - layout.getLineTop(0)).toFloat()
        cursor.begin(editor)
        cursor.move(editor, 0f, lineHeight)
        assertEquals(11, editor.selectionStart)
        cursor.move(editor, 0f, lineHeight * 2)
        assertEquals(17, editor.selectionStart)
        cursor.move(editor, 0f, 0f)
        assertEquals(5, editor.selectionStart)
        editor.setSelection(editor.length())
        cursor.begin(editor)
        val before = layout.getLineForOffset(editor.selectionStart)
        cursor.move(editor, 0f, -lineHeight)
        assertEquals(before - 1, layout.getLineForOffset(editor.selectionStart))

        val moves = mutableListOf<Pair<Float, Float>>()
        val space = KeyflowKeyView(activity, "space", "") {}
        space.onSlide = { x, y -> moves += x to y }
        space.layout(0, 0, (240 * density).toInt(), (180 * density).toInt())
        val now = SystemClock.uptimeMillis()
        fun touch(action: Int, x: Float, y: Float) {
          val event = MotionEvent.obtain(now, now, action, x * density, y * density, 0)
          space.onTouchEvent(event)
          event.recycle()
        }
        touch(MotionEvent.ACTION_DOWN, 30f, 30f)
        touch(MotionEvent.ACTION_MOVE, 54f, 78f)
        assertEquals(listOf(24f * density to 48f * density), moves)
        touch(MotionEvent.ACTION_MOVE, 54.25f, 78.5f)
        assertEquals(24.25f * density, moves.last().first, 0.01f)
        assertEquals(48.5f * density, moves.last().second, 0.01f)
        touch(MotionEvent.ACTION_CANCEL, 54f, 78f)
      }
    }
  }

  @Test fun letterTapClearsFeedbackAtRelease() = assertRelease("letter", "flat", false)

  @Test fun spaceTapClearsFeedbackAtRelease() = assertRelease("space", "flat", false)

  @Test fun deleteReleaseClearsFeedback() = assertRelease("delete", "flat", false)

  @Test fun cancelledTapClearsFeedbackWithoutClick() = assertRelease("letter", "flat", true)

  @Test fun raisedKeyRestoresItsFaceAtRelease() = assertRelease("letter", "raised", false)

  @Test
  fun transparentKeyRestoresItsFaceAtRelease() = assertRelease("letter", "flat", false, "#10203040")

  @Test fun flatPressedGlyphActuallyRenders() = assertGlyph("flat", true)

  @Test fun raisedPressedGlyphActuallyRenders() = assertGlyph("raised", true)

  @Test fun flatRestingGlyphActuallyRenders() = assertGlyph("flat", false)

  @Test fun raisedRestingGlyphActuallyRenders() = assertGlyph("raised", false)

  @Test
  fun phoneDoubleShiftLocksCaseAndShowsDistinctGlyph() {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      scenario.onActivity { activity ->
        val keys = keyboardKeys(activity.keyboard)
        org.junit.Assume.assumeTrue(keys.none { it.action == "capsLock" })
        activity.keyboard.updateContext("word")
        val shift = keys.first { it.action == "shift" }
        fun image(): Bitmap =
          Bitmap.createBitmap(shift.width, shift.height, Bitmap.Config.ARGB_8888).also {
            val canvas = Canvas(it)
            canvas.translate(-shift.scrollX.toFloat(), -shift.scrollY.toFloat())
            shift.draw(canvas)
          }
        shift.performClick()
        val singleShift = image()
        shift.performClick()
        val lockedShift = image()
        assertEquals("Caps lock on", shift.contentDescription.toString())
        assertFalse(
          "Locked Shift must render its distinct underline",
          singleShift.sameAs(lockedShift),
        )
        singleShift.recycle()
        lockedShift.recycle()
        val letter = keys.first { it.label == "a" }
        letter.performClick()
        letter.performClick()
        assertEquals(listOf("A", "A"), activity.output.takeLast(2).map { it.second })
        assertEquals("Caps lock on", shift.contentDescription.toString())
      }
    }
  }

  @Test fun leftShiftFillsArrowsUntilOneLetterIsTyped() = assertManualShift(false)

  @Test fun rightShiftFillsArrowsUntilOneLetterIsTyped() = assertManualShift(true)

  @Test
  fun tabletAutomaticCapitalizationSelectsCapsInsteadOfShift() {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      scenario.onActivity { activity ->
        val keys = keyboardKeys(activity.keyboard)
        val caps = keys.firstOrNull { it.action == "capsLock" }
        org.junit.Assume.assumeTrue(caps != null)
        activity.keyboard.updateContext("word")
        activity.keyboard.updateContext("")
        assertTrue(caps!!.isSelected)
        keys.filter { it.action == "shift" }.forEach { assertArrowFill(it, false) }
      }
    }
  }

  @Test fun tabletCapsThenShiftRemainSelected() = assertCombinedShift(false)

  @Test fun tabletShiftThenCapsRemainSelected() = assertCombinedShift(true)

  @Test fun shiftedCommaDisplaysAndInsertsPlatformValue() = assertShiftedPunctuation(",", "<")

  @Test fun shiftedPeriodDisplaysAndInsertsPlatformValue() = assertShiftedPunctuation(".", ">")

  private fun assertCombinedShift(shiftFirst: Boolean) {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      scenario.onActivity { activity ->
        val keys = keyboardKeys(activity.keyboard)
        val caps = keys.firstOrNull { it.action == "capsLock" }
        org.junit.Assume.assumeTrue(caps != null)
        activity.keyboard.updateContext("word")
        val shift = keys.first { it.action == "shift" }
        (if (shiftFirst) shift else caps!!).performClick()
        (if (shiftFirst) caps!! else shift).performClick()
        assertTrue("Caps must remain selected alongside Shift", caps!!.isSelected)
        keys.filter { it.action == "shift" }.forEach { assertArrowFill(it, true) }
        val letter = keys.first { it.label == "a" }
        assertEquals("A", letter.text.toString())
        letter.performClick()
        assertEquals("A", activity.output.last().second)
        assertTrue("Typing must preserve Caps Lock", caps.isSelected)
        keys.filter { it.action == "shift" }.forEach { assertArrowFill(it, false) }
        assertEquals("A", letter.text.toString())
      }
    }
  }

  private fun assertShiftedPunctuation(base: String, tabletValue: String) {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      scenario.onActivity { activity ->
        val keyboard = activity.keyboard
        val keys = keyboardKeys(keyboard)
        val caps = keys.firstOrNull { it.action == "capsLock" }
        val punctuation = keys.first { it.action == "letter" && it.label == base }
        keyboard.updateContext("")
        assertEquals(
          "Automatic capitalization must not shift punctuation",
          base,
          punctuation.text.toString(),
        )
        keyboard.updateContext("word")
        caps?.performClick()
        assertEquals("Caps Lock must not shift punctuation", base, punctuation.text.toString())
        keys.first { it.action == "shift" }.performClick()
        val expected = if (caps != null) tabletValue else base
        assertEquals(expected, punctuation.text.toString())
        assertEquals(expected, punctuation.contentDescription.toString())
        punctuation.performClick()
        assertEquals(expected, activity.output.last().second)
        assertEquals(base, punctuation.text.toString())
        keys.filter { it.action == "shift" }.forEach { assertArrowFill(it, false) }
        caps?.let { assertTrue(it.isSelected) }
      }
    }
  }

  private fun assertManualShift(right: Boolean) {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      scenario.onActivity { activity ->
        val keyboard = activity.keyboard
        val keys = keyboardKeys(keyboard)
        val shifts = keys.filter { it.action == "shift" }
        org.junit.Assume.assumeTrue(!right || shifts.size == 2)
        keyboard.updateContext("word")
        shifts.forEach { assertArrowFill(it, false) }
        (if (right) shifts.last() else shifts.first()).performClick()
        shifts.forEach { assertArrowFill(it, true) }
        keys.firstOrNull { it.action == "capsLock" }?.let { assertFalse(it.isSelected) }
        keys.first { it.action == "letter" && it.label == "a" }.performClick()
        assertEquals("A", activity.output.last().second)
        shifts.forEach { assertArrowFill(it, false) }
        keys.firstOrNull { it.action == "capsLock" }?.let { assertFalse(it.isSelected) }
      }
    }
  }

  @Suppress("UNCHECKED_CAST")
  private fun keyboardKeys(keyboard: KeyflowKeyboardView) =
    keyboardField(keyboard, "keys") as List<KeyflowKeyView>

  private fun assertArrowFill(key: KeyflowKeyView, filled: Boolean) {
    assertEquals("Shift selection state", filled, key.isSelected)
    val image = Bitmap.createBitmap(key.width, key.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(image)
    canvas.translate(-key.scrollX.toFloat(), -key.scrollY.toFloat())
    key.draw(canvas)
    val center = image.getPixel(key.width / 2, key.height / 2)
    if (filled) assertEquals("Active Shift must have a filled arrow", key.currentTextColor, center)
    else assertNotEquals("Inactive Shift must have an outlined arrow", key.currentTextColor, center)
    image.recycle()
  }

  private fun assertGlyph(material: String, pressed: Boolean) {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      lateinit var key: KeyflowKeyView
      lateinit var host: FrameLayout
      val drawn = java.util.concurrent.CountDownLatch(1)
      scenario.onActivity { activity ->
        key = KeyflowKeyView(activity, "letter", "W") {}
        key.allowsPreview = false
        val density = activity.resources.displayMetrics.density
        key.applyTheme(
          KeyflowTheme(
            JSONObject()
              .put("material", material)
              .put("keyForeground", "#FF00FF")
              .put("keyBackground", "#17324F")
              .put("pressedKeyBackground", "#17324F")
          )
        )
        host = FrameLayout(activity)
        host.addView(key, FrameLayout.LayoutParams((44 * density).toInt(), (54 * density).toInt()))
        key.viewTreeObserver.addOnDrawListener { drawn.countDown() }
        activity.setContentView(host)
      }
      assertTrue(
        "Key must draw in its window",
        drawn.await(3, java.util.concurrent.TimeUnit.SECONDS),
      )
      scenario.onActivity {
        key.isPressed = pressed
        val image = Bitmap.createBitmap(key.width, key.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(image)
        canvas.translate(-key.scrollX.toFloat(), -key.scrollY.toFloat())
        key.draw(canvas)
        var visible = 0
        for (y in 0 until image.height) for (x in 0 until image.width) {
          val pixel = image.getPixel(x, y)
          if (
            android.graphics.Color.red(pixel) > 180 &&
              android.graphics.Color.green(pixel) < 90 &&
              android.graphics.Color.blue(pixel) > 180
          )
            visible++
        }
        assertTrue(
          "Glyph disappeared in $material/pressed=$pressed; color=${key.currentTextColor}, text=${key.text}, size=${key.textSize}, scroll=${key.scrollX}",
          visible > 10,
        )
      }
    }
  }

  @Test fun spaceTrackpadKeepsPressedColorUntilRelease() = assertTrackpadFeedback("flat", false)

  @Test fun raisedSpaceTrackpadKeepsPressedColor() = assertTrackpadFeedback("raised", false)

  @Test fun spaceTrackpadCancellationRestoresColor() = assertTrackpadFeedback("flat", true)

  private fun assertTrackpadFeedback(material: String, cancel: Boolean) {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      var clicks = 0
      val moves = mutableListOf<Float>()
      scenario.onActivity { activity ->
        val key = KeyflowKeyView(activity, "space", "") { clicks++ }
        key.onSlide = { horizontal, _ -> moves += horizontal }
        val host = FrameLayout(activity)
        host.addView(key, FrameLayout.LayoutParams(240, 180))
        activity.setContentView(host)
        key.layout(0, 0, 240, 180)
        key.applyTheme(
          KeyflowTheme(
            JSONObject()
              .put("material", material)
              .put("keyBackground", "#17324F")
              .put("pressedKeyBackground", "#A13FC5")
          )
        )
        val normal = pixels(key)
        val down = SystemClock.uptimeMillis()
        fun touch(action: Int, x: Float, y: Float = 90f) {
          MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0).also {
            key.dispatchTouchEvent(it)
            it.recycle()
          }
        }
        touch(MotionEvent.ACTION_DOWN, 120f)
        val pressed = pixels(key)
        assertFalse(normal.sameAs(pressed))
        val step = 24 * activity.resources.displayMetrics.density
        for ((x, y) in listOf(120f + step to 90f, key.width + step to -20f, 120f to 90f)) {
          touch(MotionEvent.ACTION_MOVE, x, y)
          assertTrue("Space must remain pressed while moving the cursor", key.isPressed)
          val active = pixels(key)
          assertTrue(
            "Trackpad must keep the configured pressed face in $material",
            pressed.sameAs(active),
          )
          active.recycle()
        }
        assertTrue("The gesture must actually move the cursor", moves.isNotEmpty())
        touch(if (cancel) MotionEvent.ACTION_CANCEL else MotionEvent.ACTION_UP, 120f)
        assertFalse(key.isPressed)
        val released = pixels(key)
        assertTrue("Restore the resting color immediately", normal.sameAs(released))
        normal.recycle()
        pressed.recycle()
        released.recycle()
      }
      SystemClock.sleep(100)
      scenario.onActivity { assertEquals("Cursor movement must not insert a space", 0, clicks) }
    }
  }

  private fun pixels(key: KeyflowKeyView): Bitmap =
    Bitmap.createBitmap(key.width, key.height, Bitmap.Config.ARGB_8888).also {
      key.background.setBounds(0, 0, key.width, key.height)
      key.background.draw(Canvas(it))
    }

  private fun assertRelease(
    action: String,
    material: String,
    cancel: Boolean,
    fill: String = "#FFFFFF",
  ) {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      var key: KeyflowKeyView? = null
      var normal: Bitmap? = null
      var clickCount = 0
      scenario.onActivity { activity ->
        val view = KeyflowKeyView(activity, action, "w") { clickCount++ }
        key = view
        view.allowsPreview = false
        val host = FrameLayout(activity)
        host.addView(view, FrameLayout.LayoutParams(240, 180))
        activity.setContentView(host)
        view.layout(0, 0, 240, 180)
        view.applyTheme(
          KeyflowTheme(
            JSONObject()
              .put("material", material)
              .put("keyBackground", fill)
              .put("pressedKeyBackground", "#A13FC5")
          )
        )
        normal = pixels(view)
        val down = SystemClock.uptimeMillis()
        fun touch(type: Int) {
          MotionEvent.obtain(
              down,
              SystemClock.uptimeMillis(),
              type,
              view.width / 2f,
              view.height / 2f,
              0,
            )
            .also {
              view.dispatchTouchEvent(it)
              it.recycle()
            }
        }
        touch(MotionEvent.ACTION_DOWN)
        assertTrue("Feedback must start at touch-down", view.isPressed)
        assertFalse("The configured pressed color must be rendered", normal!!.sameAs(pixels(view)))
        touch(if (cancel) MotionEvent.ACTION_CANCEL else MotionEvent.ACTION_UP)
        assertFalse("Do not retain View's delayed pressed state after release", view.isPressed)
        assertTrue(
          "The entire key face must return immediately, without a ripple",
          normal!!.sameAs(pixels(view)),
        )
      }
      // Let View's queued click/unpress callbacks run, then check no color resurfaces.
      SystemClock.sleep(100)
      scenario.onActivity {
        assertFalse(key!!.isPressed)
        assertTrue(normal!!.sameAs(pixels(key!!)))
        assertEquals(if (cancel) 0 else 1, clickCount)
      }
    }
  }
}
