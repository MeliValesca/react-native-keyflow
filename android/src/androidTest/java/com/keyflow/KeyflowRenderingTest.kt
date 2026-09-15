package com.keyflow

import android.view.MotionEvent
import android.view.View
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KeyflowRenderingTest {
  @Test
  fun reactOwnedSoftInputFlagSurvivesModeChangesAndDetach() {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      scenario.onActivity { activity ->
        val editor = android.widget.EditText(activity)
        val policy = KeyflowSoftInputPolicy()
        for (system in listOf(false, true)) {
          // React updates the prop when disabling Keyflow or mounting a baseline.
          editor.showSoftInputOnFocus = false
          policy.remember(editor, managedByReact = true)
          policy.apply(editor, system)
          assertEquals(
            "Native mode changes must preserve React props",
            false,
            editor.showSoftInputOnFocus,
          )
          editor.showSoftInputOnFocus = true
          policy.restore(editor)
          assertTrue("Cleanup must preserve React's IME policy", editor.showSoftInputOnFocus)
        }
      }
    }
  }

  @Test
  fun nativeEditorSoftInputFlagRestoresItsOriginalValue() {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      scenario.onActivity { activity ->
        val editor = android.widget.EditText(activity)
        val policy = KeyflowSoftInputPolicy()
        editor.showSoftInputOnFocus = true
        policy.remember(editor, managedByReact = false)
        policy.apply(editor, false)
        assertEquals(false, editor.showSoftInputOnFocus)
        policy.restore(editor)
        assertTrue(editor.showSoftInputOnFocus)
      }
    }
  }

  @Test
  fun numberPageTypesEveryDigit() = withKeyboard { activity, keys ->
    fun key(label: String) = keys().first { it.label == label }
    key("?123").performClick()
    for (digit in "1234567890") key(digit.toString()).performClick()
    assertEquals(
      "1234567890",
      activity.output.filter { it.first == "text" }.joinToString("") { it.second },
    )
  }

  @Test
  fun symbolPageReturnsToLetters() = withKeyboard { _, keys ->
    fun key(label: String) = keys().first { it.label == label }
    key("?123").performClick()
    key("=\\<").performClick()
    key("ABC").performClick()
    assertTrue(keys().any { it.label.equals("q", ignoreCase = true) })
  }

  @Test fun numberPadFits() = assertPadFits("number-pad")

  @Test fun decimalPadFits() = assertPadFits("decimal-pad")

  @Test fun phonePadFits() = assertPadFits("phone-pad")

  @Test
  fun longPressShowsNativeAccentChoices() {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      var downTime = 0L
      scenario.onActivity { activity ->
        val held = keys(activity.keyboard)().first { it.label == "e" }
        downTime = android.os.SystemClock.uptimeMillis()
        held.dispatchTouchEvent(
          MotionEvent.obtain(
            downTime,
            downTime,
            MotionEvent.ACTION_DOWN,
            held.width / 2f,
            held.height / 2f,
            0,
          )
        )
      }
      android.os.SystemClock.sleep(650)
      scenario.onActivity { activity ->
        @Suppress("UNCHECKED_CAST")
        val choices =
          keyboardField(activity.keyboard, "accentChoices") as List<android.widget.Button>
        assertEquals(listOf("Ē", "Ê", "Ë", "È", "3", "É"), choices.map { it.text.toString() })
        val held = keys(activity.keyboard)().first { it.label == "e" }
        val now = android.os.SystemClock.uptimeMillis()
        held.dispatchTouchEvent(
          MotionEvent.obtain(
            downTime,
            now,
            MotionEvent.ACTION_UP,
            held.width / 2f,
            held.height / 2f,
            0,
          )
        )
      }
    }
  }

  @Test
  fun tabletLongPressMatchesNativeGridSizeAndDimming() {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      var downTime = 0L
      scenario.onActivity { activity ->
        org.junit.Assume.assumeTrue(activity.resources.configuration.smallestScreenWidthDp >= 600)
        val held = keys(activity.keyboard)().first { it.label == "a" }
        downTime = android.os.SystemClock.uptimeMillis()
        held.dispatchTouchEvent(
          MotionEvent.obtain(
            downTime,
            downTime,
            MotionEvent.ACTION_DOWN,
            held.width / 2f,
            held.height / 2f,
            0,
          )
        )
      }
      android.os.SystemClock.sleep(
        android.view.ViewConfiguration.getLongPressTimeout().toLong() + 150
      )
      scenario.onActivity { activity ->
        @Suppress("UNCHECKED_CAST")
        val choices =
          keyboardField(activity.keyboard, "accentChoices") as List<android.widget.Button>
        assertEquals("native tablet A popup is a 4 by 2 grid", 8, choices.size)
        assertEquals(
          "native tablet choices use four columns",
          4,
          choices.map { it.left }.distinct().size,
        )
        assertEquals(
          "native tablet choices use two rows",
          2,
          choices.map { it.top }.distinct().size,
        )
        val density = activity.resources.displayMetrics.density
        assertEquals("native tablet choice width", 50f, choices.first().width / density, 1f)
        val rowsField =
          KeyflowKeyboardView::class.java.getDeclaredField("rows").apply { isAccessible = true }
        assertEquals(
          "Gboard dims the keys behind its popup",
          0.38f,
          (rowsField.get(activity.keyboard) as View).alpha,
          0.01f,
        )
        val held = keys(activity.keyboard)().first { it.label == "a" }
        held.dispatchTouchEvent(
          MotionEvent.obtain(
            downTime,
            android.os.SystemClock.uptimeMillis(),
            MotionEvent.ACTION_CANCEL,
            held.width / 2f,
            held.height / 2f,
            0,
          )
        )
      }
    }
  }

  @Test
  fun accentHighlightFollowsDiagonalDragWithoutRowJumps() {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      scenario.onActivity { activity ->
        val keyboard = activity.keyboard
        val held = keys(keyboard)().first { it.label == "a" }
        assertTrue(held.onHold?.invoke() == true)
        fun field(name: String) = keyboardField(keyboard, name)
        val indicator = field("accentIndicator") as View
        val originX = field("accentPopupX") as Int
        val originY = field("accentPopupY") as Int
        val padding = field("accentPanelPadding") as Int
        val unit = (field("accentUnit") as Int).toFloat()
        val height = (field("accentChoiceHeight") as Int).toFloat()
        held.onHoldMove?.invoke(originX + padding + unit / 2f, originY + padding + height / 2f)
        (field("accentMotion") as? android.animation.ValueAnimator)?.end()
        val startX = indicator.x
        val startY = indicator.y
        held.onHoldMove?.invoke(originX + padding + unit * 1.5f, originY + padding + height * 1.5f)
        val motion = field("accentMotion") as android.animation.ValueAnimator
        assertEquals("No horizontal jump when selecting another row", startX, indicator.x, 0.5f)
        assertEquals("No vertical jump when selecting another row", startY, indicator.y, 0.5f)
        motion.currentPlayTime = 50
        assertTrue(
          "Horizontal movement has an intermediate frame",
          indicator.x > startX && indicator.x < startX + unit,
        )
        assertTrue(
          "Vertical movement has an intermediate frame",
          indicator.y > startY && indicator.y < startY + height,
        )
        val interruptedX = indicator.x
        val interruptedY = indicator.y
        held.onHoldMove?.invoke(originX + padding + unit / 2f, originY + padding + height / 2f)
        assertEquals("Reversing preserves current X", interruptedX, indicator.x, 0.5f)
        assertEquals("Reversing preserves current Y", interruptedY, indicator.y, 0.5f)
        (field("accentMotion") as android.animation.ValueAnimator).end()
        assertEquals("Returns to first column", startX, indicator.x, 0.5f)
        assertEquals("Returns to first row", startY, indicator.y, 0.5f)
        keyboard.cancelTouches()
      }
    }
  }

  @Test fun flatSmallSquareCustomizationFits() = assertCustomizationFits("flat", 12, 0)

  @Test fun flatSmallRoundedCustomizationFits() = assertCustomizationFits("flat", 12, 24)

  @Test fun flatLargeSquareCustomizationFits() = assertCustomizationFits("flat", 32, 0)

  @Test fun flatLargeRoundedCustomizationFits() = assertCustomizationFits("flat", 32, 24)

  @Test fun raisedSmallSquareCustomizationFits() = assertCustomizationFits("raised", 12, 0)

  @Test fun raisedSmallRoundedCustomizationFits() = assertCustomizationFits("raised", 12, 24)

  @Test fun raisedLargeSquareCustomizationFits() = assertCustomizationFits("raised", 32, 0)

  @Test fun raisedLargeRoundedCustomizationFits() = assertCustomizationFits("raised", 32, 24)

  private fun assertPadFits(type: String) = withKeyboard { activity, keys ->
    activity.keyboard.setKeyboardType(type)
    layout(activity.keyboard, activity.keyboard.panelHeight)
    val labels = keys().filter { it.visibility == View.VISIBLE }.map { it.label }.toSet()
    for (digit in "0123456789") assertTrue("$type missing $digit", digit.toString() in labels)
    val violations = activity.keyboard.metrics()["violations"] as List<*>
    assertTrue("$type has layout violations: $violations", violations.isEmpty())
  }

  private fun assertCustomizationFits(material: String, fontSize: Int, radius: Int) {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    val keyboard = KeyflowKeyboardView(context) { _, _ -> }
    keyboard.theme =
      KeyflowTheme(
        JSONObject().apply {
          put("fontSize", fontSize)
          put("fontFamily", JSONObject.NULL)
          put("fontWeight", "regular")
          put("material", material)
          put("keyDepth", if (material == "raised") 6 else 0)
          put("keyCornerRadius", radius)
        }
      )
    val density = context.resources.displayMetrics.density
    val width = (411 * density).toInt()
    keyboard.measure(
      View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(
        (keyboard.panelHeight * density).toInt(),
        View.MeasureSpec.EXACTLY,
      ),
    )
    keyboard.layout(0, 0, keyboard.measuredWidth, keyboard.measuredHeight)
    val failures =
      keys(keyboard)().filter { it.visibility == View.VISIBLE && !it.labelFits() }.map { it.label }
    assertTrue("$material/$fontSize/$radius overflowed: $failures", failures.isEmpty())
  }

  private fun withKeyboard(check: (KeyflowTestActivity, () -> List<KeyflowKeyView>) -> Unit) {
    ActivityScenario.launch(KeyflowTestActivity::class.java).use { scenario ->
      scenario.onActivity { activity -> check(activity, keys(activity.keyboard)) }
    }
  }

  private fun keys(keyboard: KeyflowKeyboardView): () -> List<KeyflowKeyView> {
    val field =
      KeyflowKeyboardView::class.java.getDeclaredField("keys").apply { isAccessible = true }
    @Suppress("UNCHECKED_CAST")
    return {
      field.get(keyboard) as List<KeyflowKeyView>
    }
  }

  private fun layout(keyboard: KeyflowKeyboardView, heightDp: Int) {
    keyboard.measure(
      View.MeasureSpec.makeMeasureSpec(keyboard.width, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(
        (heightDp * keyboard.resources.displayMetrics.density).toInt(),
        View.MeasureSpec.EXACTLY,
      ),
    )
    keyboard.layout(0, 0, keyboard.measuredWidth, keyboard.measuredHeight)
  }
}
