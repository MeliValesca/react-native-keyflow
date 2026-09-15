package com.keyflow

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.icu.text.BreakIterator
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.animation.PathInterpolator
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.PopupWindow
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.react.views.textinput.ReactEditText
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.util.Locale
import org.json.JSONObject

class KeyflowInputView(context: Context, private val expoContext: AppContext) :
  ExpoView(context, expoContext) {
  var onKeyflowModeChange: ((Map<String, Any>) -> Unit)? = null
  var onKeyflowLanguageChange: ((Map<String, Any>) -> Unit)? = null
  var onKeyflowHeightChange: ((Map<String, Any>) -> Unit)? = null
  var onKeyflowFrameChange: ((Map<String, Any>) -> Unit)? = null
  private var panelAnimator: ValueAnimator? = null
  private var visiblePanelHeight = 0f
  private var panelTarget = 0f
  private var imeAnimating = false
  private var handoffHeight = 0f
  private val endHandoff = Runnable {
    handoffHeight = 0f
    reportFrame()
  }
  private var lastFrame: Map<String, Any>? = null
  private val showRequest = Runnable { showKeyboard() }
  private var systemShowAttempts = 0

  private fun requestKeyboard() {
    removeCallbacks(showRequest)
    post(showRequest)
  }

  private val globalLayout =
    ViewTreeObserver.OnGlobalLayoutListener { if (!imeAnimating) reportFrame() }

  private fun reportFrame(insets: WindowInsetsCompat? = ViewCompat.getRootWindowInsets(this)) {
    if (!isAttachedToWindow) return
    // A visible IME can settle without another animation-end callback (for
    // example when an in-flight hide is cancelled by a mode switch). Once its
    // real insets are settled, stop reserving the outgoing custom panel height.
    if (
      mode == "system" &&
        popup == null &&
        !imeAnimating &&
        insets?.isVisible(WindowInsetsCompat.Type.ime()) == true
    ) {
      systemShowAttempts = 0
      removeCallbacks(endHandoff)
      handoffHeight = 0f
    }
    val density = resources.displayMetrics.density
    val ime = insets?.getInsets(WindowInsetsCompat.Type.ime())?.bottom ?: 0
    val nav = insets?.getInsets(WindowInsetsCompat.Type.navigationBars())?.bottom ?: 0
    val custom = if (visiblePanelHeight > 0) visiblePanelHeight + nav else 0f
    val occupied = maxOf(custom, ime.toFloat(), handoffHeight)
    val location = IntArray(2)
    rootView.getLocationOnScreen(location)
    val visibleWindow = android.graphics.Rect()
    getWindowVisibleDisplayFrame(visibleWindow)
    val frame =
      mapOf<String, Any>(
        "screenY" to ((location[1] + rootView.height - occupied) / density),
        "height" to (occupied / density),
        "windowOffsetY" to (visibleWindow.top / density),
        "windowHeight" to (rootView.height / density),
        "visible" to (occupied > nav),
        "source" to if (custom >= ime && custom > 0) "custom" else "system",
      )
    if (frame != lastFrame) {
      lastFrame = frame
      onKeyflowFrameChange?.invoke(frame)
    }
  }

  private fun animatePanel(target: Float, animated: Boolean = true) {
    if (panelTarget == target && panelAnimator?.isRunning == true) return
    panelAnimator?.removeAllListeners()
    panelAnimator?.cancel()
    panelAnimator = null
    panelTarget = target
    val fullHeight = keyboard.panelHeight * resources.displayMetrics.density
    fun update(value: Float) {
      visiblePanelHeight = value
      keyboard.translationY = fullHeight - value
      reportFrame()
    }
    fun finish() {
      if (target == 0f) {
        popup?.dismiss()
        popup = null
        keyboard.translationY = 0f
        clearNavigationScrim()
      }
      onKeyflowHeightChange?.invoke(mapOf("height" to (target / resources.displayMetrics.density)))
    }
    if (
      !animated || (android.os.Build.VERSION.SDK_INT >= 26 && !ValueAnimator.areAnimatorsEnabled())
    ) {
      update(target)
      finish()
      return
    }
    panelAnimator =
      ValueAnimator.ofFloat(visiblePanelHeight, target).apply {
        // Android 16 InsetsController synchronized IME timing.
        duration = 285
        interpolator = PathInterpolator(0.2f, 0f, 0f, 1f)
        addUpdateListener { update(it.animatedValue as Float) }
        addListener(
          object : AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: Animator) {
              finish()
            }
          }
        )
        start()
      }
  }

  private var attachedEditor: EditText? = null
  private val editor: EditText
    get() = checkNotNull(attachedEditor) { "Keyflow input is not attached" }

  private var savedSoftInputOnFocus = true
  private val providedTextWatcher =
    object : TextWatcher {
      override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}

      override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}

      override fun afterTextChanged(s: Editable?) {
        updateInputContext()
      }
    }
  private val providedFocusListener =
    ViewTreeObserver.OnGlobalFocusChangeListener { old, next ->
      val field = attachedEditor
      if (field != null) {
        if (next === field) requestKeyboard()
        else if (old === field) {
          removeCallbacks(showRequest)
          hideKeyboard()
        }
      }
    }

  fun attachInput(tag: Int?) {
    if (tag == null) {
      detachInput()
      return
    }
    fun findEditor(view: View): EditText? {
      if (view is EditText) return view
      if (view is ViewGroup) {
        for (index in 0 until view.childCount) findEditor(view.getChildAt(index))?.let {
          return it
        }
      }
      return null
    }
    val view = expoContext.findView<View>(tag)
    val field = view?.let { findEditor(it) }
    require(field != null) { "Keyflow requires a React Native TextInput ref." }
    val changed = attachedEditor !== field
    if (changed) {
      detachInput()
      attachedEditor = field
      cursorNavigator.reset()
      savedSoftInputOnFocus = field.showSoftInputOnFocus
      field.addTextChangedListener(providedTextWatcher)
    }
    field.showSoftInputOnFocus = mode == "system"
    updateInputContext()
    if (changed && field.hasFocus()) requestKeyboard()
  }

  private fun detachInput() {
    val field = attachedEditor ?: return
    removeCallbacks(showRequest)
    hideKeyboard(animated = false)
    field.removeTextChangedListener(providedTextWatcher)
    field.showSoftInputOnFocus = savedSoftInputOnFocus
    attachedEditor = null
  }

  fun updateInputContext() {
    if (attachedEditor == null) return
    keyboard.updateContext(
      editor.text.substring(0, editor.selectionStart.coerceIn(0, editor.length()))
    )
  }

  private val keyboard = KeyflowKeyboardView(context) { action, text -> activate(action, text) }
  private var popup: PopupWindow? = null
  private var navigationScrim: ColorDrawable? = null
  private var previousLightNavigation: Boolean? = null

  private fun updateNavigationScrim() {
    val nav =
      ViewCompat.getRootWindowInsets(this)
        ?.getInsets(WindowInsetsCompat.Type.navigationBars())
        ?.bottom ?: 0
    val scrim =
      navigationScrim
        ?: ColorDrawable().also {
          navigationScrim = it
          rootView.overlay.add(it)
          previousLightNavigation =
            ViewCompat.getWindowInsetsController(rootView)?.isAppearanceLightNavigationBars
        }
    scrim.color = keyboard.theme.background
    scrim.setBounds(0, rootView.height - nav, rootView.width, rootView.height)
    val color = scrim.color
    ViewCompat.getWindowInsetsController(rootView)?.isAppearanceLightNavigationBars =
      Color.red(color) * 0.299 + Color.green(color) * 0.587 + Color.blue(color) * 0.114 > 140
  }

  private fun clearNavigationScrim() {
    navigationScrim?.let { rootView.overlay.remove(it) }
    navigationScrim = null
    previousLightNavigation?.let {
      ViewCompat.getWindowInsetsController(rootView)?.isAppearanceLightNavigationBars = it
    }
    previousLightNavigation = null
  }

  private var lastSpace = 0L
  private var keyboardType = "default"

  fun setKeyboardType(value: String) {
    val type = if (value in listOf("number-pad", "decimal-pad", "phone-pad")) value else "default"
    if (type == keyboardType) return
    keyboardType = type
    lastSpace = 0
    keyboard.setKeyboardType(type)
  }

  private var languagesJSON = ""
  private var languages = listOf(KeyflowLanguage.english)
  private var language = KeyflowLanguage.english
  private var hasResolvedLanguage = false

  fun setLanguages(json: String) {
    languagesJSON = json
    refreshLanguages()
  }

  private fun refreshLanguages() {
    val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    val active =
      imm
        .getEnabledInputMethodSubtypeList(null, true)
        .filter { it.mode == "keyboard" }
        .map { if (it.languageTag.isNotEmpty()) it.languageTag else it.locale }
        .filter { it.isNotEmpty() }
    val preferences =
      if (active.isNotEmpty()) active
      else
        (0 until resources.configuration.locales.size()).map {
          resources.configuration.locales[it].toLanguageTag()
        }
    val resolved = KeyflowLanguage.resolve(languagesJSON, preferences)
    val next =
      if (hasResolvedLanguage) resolved.firstOrNull { it.base == language.base } ?: resolved[0]
      else resolved[0]
    hasResolvedLanguage = true
    languages = resolved
    selectLanguage(next)
  }

  private fun selectLanguage(value: KeyflowLanguage) {
    val changed = language != value
    language = value
    if (changed) {
      onKeyflowLanguageChange?.invoke(mapOf("language" to value.language, "layout" to value.layout))
      lastSpace = 0
    }
    keyboard.setLanguage(value, languages.size > 1)
    updateInputContext()
  }

  private var mode = "custom"
  private var back: OnBackPressedCallback? = null

  init {
    keyboard.popupHost = this
    keyboard.onHeightChange = {
      if (popup != null && mode == "custom") {
        val height = (keyboard.panelHeight * resources.displayMetrics.density).toInt()
        updateNavigationScrim()
        // WindowManager otherwise adds a separate surface-move animation that
        // does not appear in view bounds or our keyboard frame events.
        if (android.os.Build.VERSION.SDK_INT >= 34) {
          (keyboard.rootView.layoutParams as? android.view.WindowManager.LayoutParams)
            ?.setCanPlayMoveAnimation(false)
        }
        popup?.update(LayoutParams.MATCH_PARENT, height)
        // System keyboards can change their bounds directly. Sliding the new page
        // from the old height clips rows and exposes an empty strip.
        animatePanel(height.toFloat(), animated = false)
      }
    }
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {}

  fun haptics(value: Boolean) {
    keyboard.hapticsEnabled = value
  }

  fun showSecondaryKeyLabels(value: Boolean) {
    keyboard.showSecondaryKeyLabels = value
  }

  fun theme(value: String) {
    keyboard.theme = KeyflowTheme(JSONObject(value))
    if (popup != null) updateNavigationScrim()
  }

  fun setMode(value: String) {
    if (mode == value) return
    removeCallbacks(showRequest)
    removeCallbacks(endHandoff)
    val insets = ViewCompat.getRootWindowInsets(this)
    val customHeight =
      if (visiblePanelHeight > 0)
        visiblePanelHeight +
          (insets?.getInsets(WindowInsetsCompat.Type.navigationBars())?.bottom ?: 0)
      else 0f
    handoffHeight =
      maxOf(
        customHeight,
        (insets?.getInsets(WindowInsetsCompat.Type.ime())?.bottom ?: 0).toFloat(),
        handoffHeight,
      )
    // Release on the incoming IME animation, not a short startup timer.
    // A cold keyboard process can take longer than 700 ms to connect.
    if (handoffHeight > 0) postDelayed(endHandoff, 3000)
    hideKeyboard(animated = false)
    mode = value
    systemShowAttempts = 0
    keyboard.reset()
    updateInputContext()
    lastSpace = 0
    if (attachedEditor == null) return
    editor.showSoftInputOnFocus = value == "system"
    // Refresh the existing editor connection when changing its IME policy.
    // Dismissing the popup can temporarily take window focus away from it.
    (context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).restartInput(
      editor
    )
    if (editor.hasFocus()) requestKeyboard()
  }

  override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
    super.onWindowFocusChanged(hasWindowFocus)
    if (hasWindowFocus && attachedEditor?.hasFocus() == true) requestKeyboard()
  }

  fun getKeyboardMetrics(): Map<String, Any> {
    val location = IntArray(2)
    editor.getLocationOnScreen(location)
    return keyboard.metrics() +
      mapOf(
        "keyboardMode" to mode,
        "focused" to editor.hasFocus(),
        "popupVisible" to (popup?.isShowing == true),
        "keyboardLanguage" to language.language,
        "keyboardLayout" to language.layout,
        "availableKeyboardLanguages" to languages.map { it.language },
        "text" to editor.text.toString(),
        "selectionStart" to editor.selectionStart,
        "selectionEnd" to editor.selectionEnd,
        "editorBottom" to ((location[1] + editor.height) / resources.displayMetrics.density),
        "systemKeyboardVisible" to
          (ViewCompat.getRootWindowInsets(this)?.isVisible(WindowInsetsCompat.Type.ime()) == true),
      )
  }

  fun focus() {
    val field = editor
    if (field is ReactEditText) field.requestFocusFromJS() else field.requestFocus()
    requestKeyboard()
  }

  fun blur() {
    if (attachedEditor == null) return
    removeCallbacks(showRequest)
    removeCallbacks(endHandoff)
    handoffHeight = 0f
    lastSpace = 0
    hideKeyboard()
    editor.clearFocus()
    (context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
      .hideSoftInputFromWindow(windowToken, 0)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnGlobalLayoutListener(globalLayout)
    viewTreeObserver.addOnGlobalFocusChangeListener(providedFocusListener)
    ViewCompat.setOnApplyWindowInsetsListener(this) { _, insets ->
      if (!imeAnimating) reportFrame(insets)
      insets
    }
    ViewCompat.setWindowInsetsAnimationCallback(
      this,
      object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
        override fun onPrepare(animation: WindowInsetsAnimationCompat) {
          if (animation.typeMask and WindowInsetsCompat.Type.ime() != 0) imeAnimating = true
        }

        override fun onEnd(animation: WindowInsetsAnimationCompat) {
          if (animation.typeMask and WindowInsetsCompat.Type.ime() != 0) {
            imeAnimating = false
            // An outgoing IME hide may finish after a new system-mode request.
            // Keep avoidance until the incoming keyboard actually becomes visible.
            if (
              ViewCompat.getRootWindowInsets(this@KeyflowInputView)
                ?.isVisible(WindowInsetsCompat.Type.ime()) == true
            ) {
              removeCallbacks(endHandoff)
              handoffHeight = 0f
            }
            reportFrame()
          }
        }

        override fun onProgress(
          insets: WindowInsetsCompat,
          runningAnimations: MutableList<WindowInsetsAnimationCompat>,
        ): WindowInsetsCompat {
          reportFrame(insets)
          return insets
        }
      },
    )
    ViewCompat.requestApplyInsets(this)
  }

  override fun onDetachedFromWindow() {
    removeCallbacks(showRequest)
    removeCallbacks(endHandoff)
    handoffHeight = 0f
    viewTreeObserver.removeOnGlobalLayoutListener(globalLayout)
    viewTreeObserver.removeOnGlobalFocusChangeListener(providedFocusListener)
    detachInput()
    ViewCompat.setWindowInsetsAnimationCallback(this, null)
    ViewCompat.setOnApplyWindowInsetsListener(this, null)
    hideKeyboard(animated = false)
    super.onDetachedFromWindow()
  }

  fun cleanup() {
    detachInput()
    (parent as? ViewGroup)?.removeView(this)
  }

  private fun showKeyboard() {
    if (attachedEditor == null || !isAttachedToWindow || !editor.hasFocus() || !editor.isEnabled)
      return
    val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
    if (mode == "system") {
      if (editor.hasWindowFocus()) {
        imm.restartInput(editor)
        ViewCompat.getWindowInsetsController(editor)?.show(WindowInsetsCompat.Type.ime())
        val accepted = imm.showSoftInput(editor, InputMethodManager.SHOW_IMPLICIT)
        if (!accepted && systemShowAttempts < 8) {
          systemShowAttempts += 1
          removeCallbacks(showRequest)
          postDelayed(showRequest, 80)
        }
      } else if (systemShowAttempts < 8) {
        systemShowAttempts += 1
        removeCallbacks(showRequest)
        postDelayed(showRequest, 80)
      }
      return
    }
    refreshLanguages()
    if (popup != null) {
      if (panelTarget == 0f) animatePanel(keyboard.panelHeight * resources.displayMetrics.density)
      return
    }
    val hadIME =
      ViewCompat.getRootWindowInsets(this)?.isVisible(WindowInsetsCompat.Type.ime()) == true ||
        handoffHeight > 0
    imm.hideSoftInputFromWindow(windowToken, 0)
    val height = (keyboard.panelHeight * resources.displayMetrics.density).toInt()
    updateNavigationScrim()
    panelTarget = height.toFloat()
    keyboard.translationY = if (hadIME) 0f else height.toFloat()
    popup =
      PopupWindow(keyboard, LayoutParams.MATCH_PARENT, height, false).apply {
        setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        isOutsideTouchable = false
        inputMethodMode = PopupWindow.INPUT_METHOD_NOT_NEEDED
        showAtLocation(rootView, Gravity.BOTTOM, 0, 0)
      }
    back =
      object : OnBackPressedCallback(true) {
          override fun handleOnBackPressed() {
            blur()
          }
        }
        .also {
          (expoContext.currentActivity as? ComponentActivity)
            ?.onBackPressedDispatcher
            ?.addCallback(it)
        }
    onKeyflowHeightChange?.invoke(mapOf("height" to keyboard.panelHeight))
    keyboard.postOnAnimation {
      if (
        popup != null && attachedEditor?.hasFocus() == true && mode == "custom" && panelTarget > 0
      ) {
        animatePanel(height.toFloat(), animated = !hadIME)
        removeCallbacks(endHandoff)
        handoffHeight = 0f
        reportFrame()
      }
    }
  }

  private fun hideKeyboard(animated: Boolean = true) {
    cursorNavigator.reset()

    keyboard.cancelTouches()
    back?.remove()
    back = null
    if (popup != null) animatePanel(0f, animated)
    else {
      onKeyflowHeightChange?.invoke(mapOf("height" to 0))
      reportFrame()
    }
  }

  private val cursorNavigator = KeyflowCursorNavigator()

  private fun replace(text: String) {
    cursorNavigator.reset()
    val start = minOf(editor.selectionStart, editor.selectionEnd).coerceAtLeast(0)
    val end = maxOf(editor.selectionStart, editor.selectionEnd).coerceAtLeast(start)
    val oldLength = editor.length()
    editor.text.replace(start, end, text)
    // Consumer filters (e.g. maxLength) may reject or shorten the insertion.
    val insertedLength = editor.length() - (oldLength - (end - start))
    editor.setSelection((start + insertedLength).coerceIn(0, editor.length()))
  }

  private fun submit() {
    // Keep React Native's submitBehavior and onSubmitEditing event pipeline.
    if (editor.inputType and android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE != 0) {
      // Send native Enter events so React Native decides between newline and
      // submit/blur using its existing submitBehavior listener.
      editor.dispatchKeyEvent(
        android.view.KeyEvent(
          android.view.KeyEvent.ACTION_DOWN,
          android.view.KeyEvent.KEYCODE_ENTER,
        )
      )
      editor.dispatchKeyEvent(
        android.view.KeyEvent(android.view.KeyEvent.ACTION_UP, android.view.KeyEvent.KEYCODE_ENTER)
      )
    } else {
      editor.onEditorAction(EditorInfo.IME_ACTION_DONE)
    }
  }

  private fun activate(action: String, text: String) {
    if (
      attachedEditor == null ||
        !editor.hasFocus() ||
        !editor.isEnabled ||
        editor.keyListener == null
    )
      return
    when (action) {
      "cursorStart" -> cursorNavigator.begin(editor)
      "cursorEnd" -> cursorNavigator.reset()
      "text" -> {
        cursorNavigator.reset()
        val now = android.os.SystemClock.uptimeMillis()
        val before = editor.text.substring(0, editor.selectionStart.coerceAtLeast(0))
        if (
          keyboardType == "default" &&
            text == " " &&
            editor.selectionStart == editor.selectionEnd &&
            now - lastSpace < 700 &&
            before.endsWith(" ") &&
            before.dropLast(1).lastOrNull()?.isLetterOrDigit() == true
        ) {
          editor.setSelection(editor.selectionStart - 1, editor.selectionStart)
          replace(". ")
          lastSpace = 0
        } else {
          replace(text)
          lastSpace = if (keyboardType == "default" && text == " ") now else 0
        }
        updateInputContext()
      }
      "tab" -> {
        replace(text)
        updateInputContext()
      }
      "delete" -> {
        cursorNavigator.reset()
        val start = minOf(editor.selectionStart, editor.selectionEnd).coerceAtLeast(0)
        val end = maxOf(editor.selectionStart, editor.selectionEnd).coerceAtLeast(start)
        if (start != end) replace("")
        else if (start > 0) {
          val iterator = BreakIterator.getCharacterInstance(Locale.ROOT)
          iterator.setText(editor.text.toString())
          val previous = iterator.preceding(start).coerceAtLeast(0)
          editor.text.delete(previous, start)
          editor.setSelection(previous)
        }
      }
      "cursor" -> {
        val translation = text.split(',').map { it.toFloatOrNull() }
        if (translation.size != 2 || translation.any { it == null }) return
        val start = editor.selectionStart
        val end = editor.selectionEnd
        cursorNavigator.move(editor, translation[0]!!, translation[1]!!)
        if (start != editor.selectionStart || end != editor.selectionEnd) {
          keyboard.updateContext(editor.text.substring(0, editor.selectionStart.coerceAtLeast(0)))
        }
      }
      "paste" ->
        (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).primaryClip?.let {
          if (it.itemCount > 0) replace(it.getItemAt(0).coerceToText(context).toString())
        }
      "nextLanguage" ->
        selectLanguage(languages[(languages.indexOf(language) + 1) % languages.size])
      "hide" -> blur()
      "submit" -> submit()
    }
  }
}
