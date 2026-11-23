import UIKit
import FormCoachSDK

/// Single-screen demo calling FormCoachEngineImpl directly — no React Native/Flutter
/// bridge — per spec section 25's Sprint group A: prove one exercise end-to-end on a real
/// device/simulator before anything else. Mirrors apps/demo-android's MainActivity.
final class ViewController: UIViewController, FormCoachEngineListener {
    private let engine: FormCoachEngineImpl
    private var sessionId: String?

    private let statusLabel = UILabel()

    init() {
        let modelPath = Bundle.main.path(forResource: "pose_landmarker_lite", ofType: "task") ?? ""
        self.engine = FormCoachEngineImpl(modelPath: modelPath)
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        statusLabel.textColor = .white
        statusLabel.numberOfLines = 0
        statusLabel.font = .systemFont(ofSize: 16, weight: .medium)
        statusLabel.text = "Starting…"
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusLabel)
        NSLayoutConstraint.activate([
            statusLabel.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            statusLabel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
        ])

        startSession()
    }

    private func startSession() {
        do {
            try engine.initialize(config: InitializeConfig(appId: "demo", environment: "development"))
            let sessionId = try engine.createSession(config: CreateSessionConfig(exercise: "squat", cameraFacing: .back, requiredView: .side))
            self.sessionId = sessionId
            engine.addListener(sessionId: sessionId, listener: self)

            if let previewLayer = engine.attachPreviewLayer(sessionId: sessionId) {
                previewLayer.frame = view.bounds
                view.layer.insertSublayer(previewLayer, at: 0)
            }
            try engine.start(sessionId: sessionId)
        } catch {
            statusLabel.text = "Failed to start: \(error)"
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        view.layer.sublayers?.first?.frame = view.bounds
    }

    deinit {
        if let sessionId {
            engine.dispose(sessionId: sessionId)
        }
    }

    func onEvent(_ event: FormCoachEvent) {
        DispatchQueue.main.async { [weak self] in
            self?.render(event)
        }
    }

    private func render(_ event: FormCoachEvent) {
        switch event {
        case .ready:
            statusLabel.text = "Ready. Calibrating…"
        case .trackingUpdate(_, _, let status, _):
            statusLabel.text = "Tracking: \(status.rawValue)"
        case .calibrationRequired(_, _, _, let guidance):
            statusLabel.text = "Calibrating: \(guidance)"
        case .calibrationCompleted:
            statusLabel.text = "Calibrated. Begin squatting."
        case .phaseChanged(_, _, _, let fromPhase, let toPhase):
            statusLabel.text = "Phase: \(fromPhase) -> \(toPhase)"
        case .repCompleted(_, _, _, let repCount, let quality):
            statusLabel.text = "Rep #\(repCount) (\(quality))"
        case .formIssue(_, _, _, _, _, let message, _, _):
            statusLabel.text = message
        case .trackingLost:
            statusLabel.text = "Tracking lost."
        case .sessionCompleted(_, _, _, _, _, _, let repCount, _):
            statusLabel.text = "Session complete. \(repCount) rep(s)."
        case .sessionError(_, _, let message, _):
            statusLabel.text = "Error: \(message)"
        }
    }
}
