import UIKit

/// A connected keyboard callout, including the stem down to the held key.
/// Uses public drawing APIs; it never embeds Apple's private keyboard views.
final class KeyflowCallout: UIView {
  var cornerRadius: CGFloat = 12
  var stemCornerRadius: CGFloat = 6
  var bubble = CGRect.zero { didSet { setNeedsLayout() } }
  var stem = CGRect.zero { didSet { setNeedsLayout() } }
  var fill = UIColor.clear { didSet { shape.fillColor = fill.cgColor } }
  private let shape = CAShapeLayer()
  func configure(_ theme: KeyflowTheme, highlighted: Bool = false) {
    let color = highlighted ? theme.pressedKeyBackground : theme.keyBackground
    fill = UIColor(keyflowHex: color)
    shape.strokeColor = UIColor(keyflowHex: theme.strokeColor ?? "#00000000").cgColor
    shape.lineWidth = CGFloat(theme.strokeWidth ?? 0)
    layer.shadowOpacity = theme.material == "raised" ? 0.18 : 0
  }
  func clearContent() { subviews.forEach { $0.removeFromSuperview() } }
  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false
    // This independent layer has no UIView action delegate. Default Core
    // Animation actions otherwise fade clear -> fill and morph old popup paths.
    shape.actions = [
      "fillColor": NSNull(), "strokeColor": NSNull(),
      "lineWidth": NSNull(), "path": NSNull(), "bounds": NSNull(), "position": NSNull(),
      "hidden": NSNull(),
    ]
    layer.insertSublayer(shape, at: 0)
    layer.shadowColor = UIColor.black.cgColor
    layer.shadowOpacity = 0.18
    layer.shadowRadius = 5
    layer.shadowOffset = CGSize(width: 0, height: 1)
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }
  /// One exterior outline avoids a ledge where overlapping rounded rectangles
  /// meet. The two cubic shoulders are tangent to the bubble and key sides.
  private func contour() -> UIBezierPath {
    guard !stem.isEmpty else {
      return UIBezierPath(roundedRect: bubble, cornerRadius: cornerRadius)
    }
    let path = UIBezierPath()
    let radius = min(cornerRadius, bubble.width / 2, bubble.height / 2)
    let keyRadius = min(stemCornerRadius, stem.width / 2, stem.height / 2)
    let shoulderY = bubble.maxY - 20
    let joinY = max(shoulderY + 18, stem.minY + 18)
    let bend = (joinY - shoulderY) / 2
    let arc: CGFloat = 0.55228475
    path.move(to: CGPoint(x: bubble.minX + radius, y: bubble.minY))
    path.addLine(to: CGPoint(x: bubble.maxX - radius, y: bubble.minY))
    path.addCurve(
      to: CGPoint(x: bubble.maxX, y: bubble.minY + radius),
      controlPoint1: CGPoint(x: bubble.maxX - radius * (1 - arc), y: bubble.minY),
      controlPoint2: CGPoint(x: bubble.maxX, y: bubble.minY + radius * (1 - arc)))
    path.addLine(to: CGPoint(x: bubble.maxX, y: shoulderY))
    path.addCurve(
      to: CGPoint(x: stem.maxX, y: joinY),
      controlPoint1: CGPoint(x: bubble.maxX, y: shoulderY + bend),
      controlPoint2: CGPoint(x: stem.maxX, y: joinY - bend))
    path.addLine(to: CGPoint(x: stem.maxX, y: stem.maxY - keyRadius))
    path.addCurve(
      to: CGPoint(x: stem.maxX - keyRadius, y: stem.maxY),
      controlPoint1: CGPoint(x: stem.maxX, y: stem.maxY - keyRadius * (1 - arc)),
      controlPoint2: CGPoint(x: stem.maxX - keyRadius * (1 - arc), y: stem.maxY))
    path.addLine(to: CGPoint(x: stem.minX + keyRadius, y: stem.maxY))
    path.addCurve(
      to: CGPoint(x: stem.minX, y: stem.maxY - keyRadius),
      controlPoint1: CGPoint(x: stem.minX + keyRadius * (1 - arc), y: stem.maxY),
      controlPoint2: CGPoint(x: stem.minX, y: stem.maxY - keyRadius * (1 - arc)))
    path.addLine(to: CGPoint(x: stem.minX, y: joinY))
    path.addCurve(
      to: CGPoint(x: bubble.minX, y: shoulderY),
      controlPoint1: CGPoint(x: stem.minX, y: joinY - bend),
      controlPoint2: CGPoint(x: bubble.minX, y: shoulderY + bend))
    path.addLine(to: CGPoint(x: bubble.minX, y: bubble.minY + radius))
    path.addCurve(
      to: CGPoint(x: bubble.minX + radius, y: bubble.minY),
      controlPoint1: CGPoint(x: bubble.minX, y: bubble.minY + radius * (1 - arc)),
      controlPoint2: CGPoint(x: bubble.minX + radius * (1 - arc), y: bubble.minY))
    path.close()
    return path
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let path = contour()
    shape.frame = bounds
    shape.fillColor = fill.cgColor
    shape.path = path.cgPath
    layer.shadowPath = path.cgPath
  }
}
