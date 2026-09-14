import ExpoModulesCore

public class KeyflowModule: Module {
  private var controllers: [String: KeyflowInputView] = [:]

  private func controller(_ id: String) -> KeyflowInputView {
    if let controller = controllers[id] { return controller }
    let controller = KeyflowInputView(appContext: appContext)
    controller.onKeyflowModeChange = { [weak self] event in
      self?.sendEvent("onKeyflowModeChange", event.merging(["id": id]) { value, _ in value })
    }
    controller.onKeyflowLanguageChange = { [weak self] event in
      self?.sendEvent("onKeyflowLanguageChange", event.merging(["id": id]) { value, _ in value })
    }
    controller.onKeyflowFrameChange = { [weak self] event in
      self?.sendEvent("onKeyflowFrameChange", event.merging(["id": id]) { value, _ in value })
    }
    controllers[id] = controller
    return controller
  }

  public func definition() -> ModuleDefinition {
    Name("Keyflow")
    Events("onKeyflowModeChange", "onKeyflowLanguageChange", "onKeyflowFrameChange")
    AsyncFunction("attachInput") { (id: String, tag: Int) in
      try self.controller(id).attachInput(tag)
    }.runOnQueue(.main)
    AsyncFunction("configure") {
      (
        id: String, mode: String, type: String, appearance: String, theme: String,
        languages: String, haptics: Bool, secondaryLabels: Bool
      ) in
      let controller = self.controller(id)
      controller.setKeyboardMode(mode)
      controller.setKeyboardType(type)
      controller.setAppearance(appearance)
      controller.setTheme(theme)
      controller.setLanguages(languages)
      controller.setHaptics(haptics)
      controller.showSecondaryKeyLabels = secondaryLabels
      controller.applyProps()
    }.runOnQueue(.main)
    AsyncFunction("updateInputContext") { (id: String) in
      self.controllers[id]?.updateInputContext()
    }.runOnQueue(.main)
    AsyncFunction("getKeyboardMetrics") { (id: String) in
      self.controllers[id]?.getKeyboardMetrics() ?? [:]
    }.runOnQueue(.main)
    AsyncFunction("destroy") { (id: String) in
      self.controllers.removeValue(forKey: id)?.cleanup()
    }.runOnQueue(.main)
    OnDestroy {
      self.controllers.values.forEach { $0.cleanup() }
      self.controllers.removeAll()
    }
  }
}
