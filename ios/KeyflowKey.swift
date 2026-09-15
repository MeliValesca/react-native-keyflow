import UIKit

enum KeyflowAction: Equatable {
  case text(String)
  case moveCursor(Int)
  case moveCursorVertically(Int)
  case beginCursorMovement
  case shift, capsLock, delete, numbers, symbols, letters, submit, dismiss, system, nextLanguage
}

/// The full frame owns touches; the inset face provides the visual gutter.
final class KeyflowKey: UIView {
  let action: KeyflowAction
  let face = UIView()
  private let label = UILabel()
  private let padSubtitle = UILabel()
  var isDisabledKey = false { didSet { applyAppearance() } }
  var isPadKey = false {
    didSet {
      applyAppearance()
      setNeedsLayout()
    }
  }
  /// iPad edge action glyphs sit near the outer edge of their wide keycaps.
  /// -1 is leading, 1 is trailing, and 0 keeps the normal centered placement.
  var tabletEdgeAlignment = 0 { didSet { setNeedsLayout() } }
  /// Apple's first-row iPad action glyphs share the letters' visual baseline,
  /// so their optical center sits below the center of the key face.
  var tabletIconVerticalOffset: CGFloat = 0 { didSet { setNeedsLayout() } }
  var padUnfilled = false {
    didSet {
      applyAppearance()
      setNeedsLayout()
    }
  }
  var padLegend: String? {
    didSet {
      padSubtitle.text = padLegend
      setNeedsLayout()
    }
  }
  var tabletAlternate: String? {
    didSet {
      padSubtitle.text = tabletAlternate ?? padLegend
      setNeedsLayout()
    }
  }
  private let icon = UIImageView()
  private let preview = UILabel()
  private let previewCallout = KeyflowCallout()
  var hidesLegend = false {
    didSet {
      label.alpha = hidesLegend || !preview.isHidden ? 0 : (isDisabledKey ? 0.35 : 1)
      padSubtitle.alpha = hidesLegend ? 0 : (isDisabledKey ? 0.35 : 1)
      icon.alpha = hidesLegend ? 0 : 1
      face.alpha = hidesLegend ? 0.5 : 1
    }
  }
  var allowsPreview = true
  var isSelectionChoice = false
  var onActivate: (() -> Void)?
  var theme = KeyflowTheme() { didSet { if oldValue != theme { applyAppearance() } } }
  var caption: String {
    didSet {
      label.text = caption
      preview.text = caption
      accessibilityLabel = caption
      setNeedsLayout()
    }
  }
  var isPressed = false { didSet { if oldValue != isPressed { applyAppearance() } } }
  var isLatched = false { didSet { applyAppearance() } }

  init(_ caption: String, action: KeyflowAction, symbol: String? = nil) {
    self.caption = caption
    self.action = action
    super.init(frame: .zero)
    isOpaque = false
    face.isOpaque = false
    isUserInteractionEnabled = false
    isAccessibilityElement = true
    accessibilityTraits = .keyboardKey
    accessibilityLabel = caption
    accessibilityIdentifier = "keyflow-key-\(caption)"
    addSubview(face)
    face.addSubview(label)
    face.addSubview(padSubtitle)
    padSubtitle.textAlignment = .center
    padSubtitle.adjustsFontSizeToFitWidth = true
    face.addSubview(icon)
    addSubview(previewCallout)
    previewCallout.isUserInteractionEnabled = false
    previewCallout.addSubview(preview)
    label.text = action == .text(" ") ? "" : caption
    label.textAlignment = .center
    label.adjustsFontSizeToFitWidth = true
    label.minimumScaleFactor = 0.1
    label.clipsToBounds = true
    preview.adjustsFontSizeToFitWidth = true
    preview.minimumScaleFactor = 0.1
    icon.contentMode = .scaleAspectFit
    if let symbol { setSymbol(symbol) }
    preview.textAlignment = .center
    preview.layer.masksToBounds = true
    preview.isHidden = true
    applyAppearance()
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

  func setSymbol(_ name: String) {
    if name == "keyflow.symbols" {
      // The native page switch uses an upright number sign, not the slanted
      // text glyph. Draw the three marks as one template, just like other icons.
      icon.image = UIGraphicsImageRenderer(size: CGSize(width: 26, height: 12)).image { _ in
        UIColor.black.setStroke()
        let lines = UIBezierPath()
        for (a, b) in [
          (CGPoint(x: 3, y: 2), CGPoint(x: 3, y: 9)), (CGPoint(x: 6, y: 2), CGPoint(x: 6, y: 9)),
          (CGPoint(x: 1.5, y: 4), CGPoint(x: 7.5, y: 4)),
          (CGPoint(x: 1.5, y: 7), CGPoint(x: 7.5, y: 7)),
          (CGPoint(x: 10, y: 5.5), CGPoint(x: 17, y: 5.5)),
          (CGPoint(x: 13.5, y: 2), CGPoint(x: 13.5, y: 9)),
          (CGPoint(x: 19, y: 3.5), CGPoint(x: 24, y: 3.5)),
          (CGPoint(x: 19, y: 7.5), CGPoint(x: 24, y: 7.5)),
        ] {
          lines.move(to: a)
          lines.addLine(to: b)
        }
        lines.lineWidth = 1.33
        lines.stroke()
      }.withRenderingMode(.alwaysTemplate)
    } else {
      icon.image = UIImage(
        systemName: name,
        withConfiguration: UIImage.SymbolConfiguration(pointSize: 20, weight: .regular))
    }
    label.isHidden = true
  }

  private var sectionName: String {
    if padUnfilled && action != .delete { return "specialKeys" }
    if isPadKey && action == .letters { return "keys" }
    if isSelectionChoice { return "selection" }
    switch action {
    case .delete: return "deleteKey"
    case .submit: return "returnKey"
    case .text: return "keys"
    default: return "specialKeys"
    }
  }
  override func layoutSubviews() {
    super.layoutSubviews()
    let theme = self.theme.styled(sectionName)
    // A 43 pt face in the 54 pt row: native iPhone portrait key spacing.
    let pixelScale = max(1, window?.screen.scale ?? traitCollection.displayScale)
    let tabletQwerty = UIDevice.current.userInterfaceIdiom == .pad && !isPadKey
    let horizontalFaceInset: CGFloat = tabletQwerty ? 7 : 3
    let inset =
      isSelectionChoice
      ? bounds
      : bounds.inset(
        by: UIEdgeInsets(
          top: bounds.height < 45 ? (isPadKey ? 2 : 4) : 6, left: horizontalFaceInset,
          bottom: bounds.height < 45 ? 3 : (isPadKey ? 0 : 5), right: horizontalFaceInset))
    func align(_ value: CGFloat) -> CGFloat { (value * pixelScale).rounded() / pixelScale }
    let left = align(frame.minX + inset.minX) - frame.minX
    let right = align(frame.minX + inset.maxX) - frame.minX
    face.frame = CGRect(x: left, y: inset.minY, width: right - left, height: inset.height)
    let radius = min(
      max(0, CGFloat(theme.keyCornerRadius)), min(face.bounds.width, face.bounds.height) / 2)
    face.layer.cornerRadius = radius
    let lowercase = caption.count == 1 && caption.rangeOfCharacter(from: .lowercaseLetters) != nil
    let baselineOffset: CGFloat
    switch caption {
    case "-": baselineOffset = -10.0 / 3.0
    case "(", ")", "/": baselineOffset = -3
    case "@": baselineOffset = -2
    default: baselineOffset = lowercase ? -7.0 / 3.0 : -1
    }
    label.frame = face.bounds.insetBy(dx: 2, dy: 2).offsetBy(
      dx: theme.fontFamily == nil ? 1.0 / 3.0 : 0, dy: baselineOffset)
    // Preserve the optical center while containing even extreme custom fonts.
    let centerY = label.frame.midY
    let availableHeight = max(
      1, min(label.frame.height, 2 * min(centerY, face.bounds.height - centerY)))
    label.frame = CGRect(
      x: label.frame.minX, y: centerY - availableHeight / 2, width: label.frame.width,
      height: availableHeight)
    let preferredSize: CGFloat
    if case .text = action, caption != "space" {
      let referenceSize: CGFloat
      switch caption {
      case ".", ",": referenceSize = 28
      case ":": referenceSize = 25
      case "/": referenceSize = 20
      default: referenceSize = lowercase ? 25 : 22
      }
      preferredSize = min(
        32,
        max(
          12, CGFloat(theme.fontSize) * referenceSize / 22 * (bounds.height < 45 ? 18.0 / 22.0 : 1))
      )
    } else {
      preferredSize = CGFloat(self.theme.sectionOverrides?[sectionName]?.fontSize ?? 18)
    }
    let preferred = theme.font(size: preferredSize, keyboard: true, character: caption)
    let textWidth = (caption as NSString).size(withAttributes: [.font: preferred]).width
    let scale = min(
      1, max(1, label.bounds.width) / max(1, textWidth),
      max(1, label.bounds.height) / max(1, preferred.lineHeight))
    label.font = preferred.withSize(preferred.pointSize * scale)
    let iconSize: CGFloat
    let iconOffset: CGFloat
    switch action {
    case .symbols:
      iconSize = 26
      iconOffset = -0.5
    case .system:
      iconSize = 28
      iconOffset = 0
    case .dismiss:
      iconSize = 24
      iconOffset = 0
    case .shift:
      iconSize = 24
      iconOffset = 0.5
    case .delete:
      iconSize = 24.5
      iconOffset = 0.5
    case .submit:
      iconSize = 24.5
      iconOffset = -0.5
    default:
      iconSize = 24
      iconOffset = 0
    }
    let finalIconSize = min(
      face.bounds.width, face.bounds.height,
      CGFloat(
        self.theme.sectionOverrides?[sectionName]?.iconSize
          ?? Double(isPadKey && bounds.height > 45 && action == .delete ? 30 : iconSize)))
    let centeredIconX = (face.bounds.width - finalIconSize) / 2
    let edgeIconX =
      tabletEdgeAlignment < 0
      ? min(centeredIconX, 11)
      : max(centeredIconX, face.bounds.width - finalIconSize - 11)
    icon.frame = CGRect(
      x: tabletEdgeAlignment == 0 ? centeredIconX : edgeIconX,
      y: (face.bounds.height - finalIconSize) / 2 + iconOffset + tabletIconVerticalOffset,
      width: finalIconSize, height: finalIconSize)
    if tabletAlternate != nil && !isPadKey {
      let mainFont = theme.font(size: CGFloat(theme.fontSize), keyboard: true, character: caption)
      let alternateFont = theme.font(
        size: CGFloat(theme.fontSize) * 15 / 22, keyboard: true, character: tabletAlternate ?? "")
      label.frame = CGRect(
        x: 2, y: face.bounds.height * 0.27, width: max(0, face.bounds.width - 4),
        height: face.bounds.height * 0.68)
      label.font = mainFont.withSize(
        min(mainFont.pointSize, label.bounds.height / mainFont.lineHeight * mainFont.pointSize))
      padSubtitle.frame = CGRect(
        x: 2, y: 4, width: max(0, face.bounds.width - 4), height: face.bounds.height * 0.3)
      padSubtitle.font = alternateFont.withSize(
        min(
          alternateFont.pointSize,
          padSubtitle.bounds.height / alternateFont.lineHeight * alternateFont.pointSize))
      padSubtitle.textAlignment = .center
      padSubtitle.textColor = UIColor(keyflowHex: theme.keyForeground).withAlphaComponent(0.28)
    } else if isPadKey {
      let digit = caption.count == 1 && caption.first?.isNumber == true
      label.frame = CGRect(
        x: 3, y: bounds.height >= 45 && digit ? 1 : 0, width: max(0, face.bounds.width - 6),
        height: face.bounds.height - (bounds.height < 45 || !digit ? 0 : 11))
      let sizeRatio =
        ["pause", "wait"].contains(caption) ? 16.0 / 22.0 : caption == "123" ? 18.0 / 22.0 : 1
      let font = theme.font(
        size: CGFloat(
          self.theme.sectionOverrides?[sectionName]?.fontSize ?? self.theme.fontSize * sizeRatio),
        keyboard: true, character: caption)
      label.font = font.withSize(
        min(font.pointSize, max(1, label.bounds.height / font.lineHeight * font.pointSize)))
      padSubtitle.frame = CGRect(
        x: 3, y: face.bounds.height - 16, width: max(0, face.bounds.width - 6), height: 12)
      let legendFont = theme.font(
        size: (bounds.height < 45 ? 9.75 : 9.5) * CGFloat(theme.fontSize) / 22)
      padSubtitle.font = legendFont.withSize(
        min(legendFont.pointSize, 12 / legendFont.lineHeight * legendFont.pointSize))
      if let padLegend {
        padSubtitle.attributedText = NSAttributedString(string: padLegend, attributes: [.kern: 2])
      }
      if bounds.height < 45 {
        label.frame = face.bounds
        padSubtitle.frame = CGRect(
          x: face.bounds.midX + 15, y: (face.bounds.height - 12) / 2,
          width: max(0, face.bounds.width / 2 - 17), height: 12)
        padSubtitle.textAlignment = .left
      } else {
        padSubtitle.textAlignment = .center
      }
      padSubtitle.textColor = label.textColor
    }
    let containerWidth = superview?.bounds.width ?? bounds.width
    let previewX = max(
      4 - frame.minX, min((bounds.width - 58) / 2, containerWidth - frame.minX - 62))
    preview.frame = CGRect(x: previewX, y: -48, width: 58, height: 65)
    previewCallout.frame = CGRect(x: previewX, y: -48, width: 58, height: face.frame.maxY + 48)
    previewCallout.bubble = CGRect(x: 0, y: 0, width: 58, height: 60)
    previewCallout.stemCornerRadius = radius
    previewCallout.stem = CGRect(
      x: face.frame.minX - previewX, y: 45, width: face.frame.width, height: face.frame.maxY + 3)
    preview.frame = CGRect(x: 0, y: -5, width: 58, height: 52)
    face.layer.shadowPath = UIBezierPath(roundedRect: face.bounds, cornerRadius: radius).cgPath
  }

  var resolvedFontName: String { label.font.fontName }
  var resolvedPadFontName: String? { padLegend == nil ? nil : padSubtitle.font.fontName }
  var labelFits: Bool {
    let mainFits =
      label.isHidden
      || ((caption as NSString).size(withAttributes: [.font: label.font as Any]).width <= label
        .bounds.width + 0.5 && label.font.lineHeight <= label.bounds.height + 0.5)
    let legendFits =
      padLegend == nil
      || (padSubtitle.font.lineHeight <= padSubtitle.bounds.height + 0.5
        && (padSubtitle.attributedText?.size().width ?? 0) <= padSubtitle.bounds.width + 0.5
        && face.bounds.insetBy(dx: -0.5, dy: -0.5).contains(padSubtitle.frame))
    return mainFits && legendFits
  }

  override func accessibilityActivate() -> Bool {
    guard let onActivate else { return false }
    onActivate()
    return true
  }

  private func applyAppearance() {
    let sourceTheme = self.theme
    let theme = sourceTheme.styled(sectionName)
    let isText: Bool
    if case .text = action { isText = true } else { isText = false }
    let fill =
      action == .delete
      ? theme.deleteKeyBackground
      : action == .submit
        ? theme.actionKeyBackground
        : (((isText || (isPadKey && action == .letters)) && !padUnfilled) || isLatched
          ? theme.keyBackground : theme.specialKeyBackground)
    // Selection colors belong only to the highlighted alternative. The other
    // alternatives sit on the preview surface, so use its foreground color.
    let foreground =
      isSelectionChoice
      ? (isPressed ? theme.selectedKeyForeground : sourceTheme.styled("preview").keyForeground)
      : action == .submit
        ? theme.actionKeyForeground
        : ((isText || (isPadKey && action == .letters))
          ? theme.keyForeground : theme.specialKeyForeground)
    // The popup owns a single selection indicator. A second pressed keycap
    // has different bounds and makes the focused accent look deformed.
    face.backgroundColor = isSelectionChoice
      ? .clear : UIColor(keyflowHex: isPressed ? theme.pressedKeyBackground : fill)
    face.layer.cornerRadius = CGFloat(theme.keyCornerRadius)
    face.layer.shadowColor = UIColor.black.cgColor
    face.layer.shadowColor = UIColor(keyflowHex: theme.keyShadow).cgColor
    face.layer.shadowOpacity = theme.material == "raised" && !isSelectionChoice ? 1 : 0
    face.transform = CGAffineTransform(
      translationX: 0,
      y: theme.material == "raised" && isPressed && !isSelectionChoice ? min(6, max(0, CGFloat(theme.keyDepth))) : 0)
    face.layer.shadowOffset = CGSize(width: 0, height: min(6, max(0, CGFloat(theme.keyDepth))))
    face.layer.shadowRadius = 0
    label.textColor = UIColor(
      keyflowHex: isPressed
        ? (sourceTheme.sections?[sectionName]?.pressedColor ?? foreground) : foreground)
    if tabletAlternate == nil { padSubtitle.textColor = label.textColor }
    label.alpha = hidesLegend ? 0 : (isDisabledKey ? 0.35 : 1)
    padSubtitle.alpha = hidesLegend ? 0 : (isDisabledKey ? 0.35 : 1)
    icon.tintColor =
      sourceTheme.sections?[sectionName].map {
        UIColor(keyflowHex: isPressed ? $0.pressedColor : $0.iconColor)
      } ?? label.textColor
    face.layer.borderColor = sourceTheme.sections?[sectionName].map {
      UIColor(keyflowHex: $0.borderColor).cgColor
    }
    face.layer.borderWidth = CGFloat(sourceTheme.sections?[sectionName]?.borderWidth ?? 0)
    let size = isText && caption != "space" ? CGFloat(theme.fontSize) : 16
    label.font = theme.font(size: size, keyboard: true, character: caption)
    let previewTheme = sourceTheme.styled("preview")
    preview.font = previewTheme.font(
      size: CGFloat(previewTheme.fontSize), keyboard: true, character: caption)
    preview.text = caption
    preview.backgroundColor = .clear
    preview.textColor = UIColor(keyflowHex: previewTheme.keyForeground)
    preview.layer.cornerRadius = CGFloat(theme.keyCornerRadius) + 4
    // Actual characters have popups; space and action keys only highlight.
    preview.isHidden = !allowsPreview || !isPressed || !isText || caption == "space"
    if !preview.isHidden { previewCallout.configure(previewTheme) }
    previewCallout.isHidden = preview.isHidden
    label.alpha = hidesLegend || !preview.isHidden ? 0 : (isDisabledKey ? 0.35 : 1)
    accessibilityTraits = isLatched ? [.keyboardKey, .selected] : .keyboardKey
    setNeedsLayout()
  }
}
