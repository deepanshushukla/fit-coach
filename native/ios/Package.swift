// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FormCoachSDK",
    platforms: [.iOS(.v16)],
    products: [
        .library(name: "FormCoachSDK", targets: ["FormCoachSDK"])
    ],
    targets: [
        // Deliberately zero external dependencies: pose types, geometry/smoothing/state
        // helpers, and the SquatEvaluator port are pure Swift with no MediaPipe/AVFoundation
        // import, so this package stays resolvable via a normal version/branch requirement.
        // MediaPipeTasksVision ships its own SPM manifest with `.unsafeFlags` on its targets,
        // which Apple's package resolver refuses to let *another package* depend on via
        // version resolution (only a top-level Xcode project may add it directly) — see
        // https://github.com/google-ai-edge/mediapipe/blob/master/Package.swift's own comment
        // to that effect. So the MediaPipe-wrapping glue (MediaPipePoseSource,
        // AVCaptureBridge, FormCoachEngineImpl) lives in apps/demo-ios's app target instead of
        // in this package — see apps/demo-ios/README.md.
        .target(name: "FormCoachSDK")
    ]
)
