import Foundation
import AVFoundation
import FormCoachSDK

private enum RunState { case created, running, paused, stopped, disposed }

private final class EngineSession {
    let id: String
    let config: CreateSessionConfig
    let evaluator: ExerciseEvaluator

    var runState: RunState = .created
    var captureBridge: AVCaptureBridge?
    var listeners: [ObjectIdentifier: FormCoachEngineListener] = [:]
    var startedAtMs: Int64?
    var lastTrackingStatus: TrackingStatus = .calibrating
    var repCount = 0
    var formIssueCounts: [String: Int] = [:]

    init(id: String, config: CreateSessionConfig, evaluator: ExerciseEvaluator) {
        self.id = id
        self.config = config
        self.evaluator = evaluator
    }
}

/// Wires AVCaptureBridge -> MediaPipePoseSource -> SquatEvaluator -> FormCoachEngineListener.
/// The FormCoachEngine contract has no UI types (by design — no frame buffers cross the
/// bridge), so the hosting view controller must call `attachPreviewLayer` for a session
/// before `start(sessionId:)` and add the returned `AVCaptureVideoPreviewLayer` to its view.
final class FormCoachEngineImpl: FormCoachEngine {
    private var sessions: [String: EngineSession] = [:]
    private let modelPath: String

    init(modelPath: String) {
        self.modelPath = modelPath
    }

    func initialize(config: InitializeConfig) throws {
        // No global state to set up beyond per-session construction today.
    }

    func createSession(config: CreateSessionConfig) throws -> String {
        guard config.exercise == "squat" else {
            throw EngineError.message("Unknown exercise id '\(config.exercise)'. Only 'squat' is implemented natively.")
        }
        let evaluator = SquatEvaluator()
        let validation = evaluator.validateConfiguration(EvaluatorConfig(requiredView: config.requiredView, minLandmarkConfidence: 0.5))
        guard validation.valid else {
            throw EngineError.message("Invalid session config: \(validation.errors.joined(separator: ", "))")
        }

        let sessionId = "ios_session_\(UUID().uuidString)"
        sessions[sessionId] = EngineSession(id: sessionId, config: config, evaluator: evaluator)
        return sessionId
    }

    /// Returns the preview layer to add to the hosting view's layer hierarchy; must be
    /// called before `start(sessionId:)`.
    func attachPreviewLayer(sessionId: String) -> AVCaptureVideoPreviewLayer? {
        guard let session = sessions[sessionId] else { return nil }
        let bridge = AVCaptureBridge(
            facing: session.config.cameraFacing,
            modelPath: modelPath,
            onPoseFrame: { [weak self] frame in self?.onPoseFrame(sessionId: sessionId, frame: frame) },
            onError: { [weak self] error in self?.onCaptureError(sessionId: sessionId, error: error) }
        )
        session.captureBridge = bridge
        bridge.start()
        return bridge.previewLayer
    }

    func start(sessionId: String) throws {
        let session = try requireSession(sessionId)
        guard session.runState == .created || session.runState == .paused else {
            throw EngineError.message("Cannot start a session in state \(session.runState)")
        }
        session.runState = .running
        let now = nowMs()
        session.startedAtMs = session.startedAtMs ?? now
        emit(session, .ready(sessionId: sessionId, timestampMs: now, exerciseId: session.evaluator.id, evaluatorVersion: session.evaluator.version))
    }

    func pause(sessionId: String) throws {
        let session = try requireSession(sessionId)
        if session.runState == .paused { return }
        guard session.runState == .running else {
            throw EngineError.message("Cannot pause a session in state \(session.runState)")
        }
        session.runState = .paused
        session.captureBridge?.dispose()
        session.captureBridge = nil
    }

    func resume(sessionId: String) throws {
        let session = try requireSession(sessionId)
        guard session.runState == .paused else {
            throw EngineError.message("Cannot resume a session in state \(session.runState)")
        }
        _ = attachPreviewLayer(sessionId: sessionId)
        try start(sessionId: sessionId)
    }

    func stop(sessionId: String) throws {
        let session = try requireSession(sessionId)
        session.captureBridge?.dispose()
        session.captureBridge = nil
        session.runState = .stopped

        let now = nowMs()
        emit(session, .sessionCompleted(
            sessionId: sessionId,
            timestampMs: now,
            exerciseId: session.evaluator.id,
            evaluatorVersion: session.evaluator.version,
            startedAtMs: session.startedAtMs ?? now,
            endedAtMs: now,
            repCount: session.repCount,
            formIssueCounts: session.formIssueCounts
        ))
    }

    func dispose(sessionId: String) {
        guard let session = sessions.removeValue(forKey: sessionId) else { return }
        session.captureBridge?.dispose()
        session.listeners.removeAll()
    }

    func addListener(sessionId: String, listener: FormCoachEngineListener) {
        sessions[sessionId]?.listeners[ObjectIdentifier(listener)] = listener
    }

    func removeListener(sessionId: String, listener: FormCoachEngineListener) {
        sessions[sessionId]?.listeners.removeValue(forKey: ObjectIdentifier(listener))
    }

    private func onPoseFrame(sessionId: String, frame: PoseFrame) {
        guard let session = sessions[sessionId], session.runState == .running else { return }
        let output = session.evaluator.update(frame)

        if output.trackingStatus != session.lastTrackingStatus {
            if output.trackingStatus == .lost {
                emit(session, .trackingLost(sessionId: session.id, timestampMs: frame.timestampMs, reason: "unknown"))
            }
            session.lastTrackingStatus = output.trackingStatus
        }
        emit(session, .trackingUpdate(
            sessionId: session.id,
            timestampMs: frame.timestampMs,
            status: output.trackingStatus,
            visibleLandmarkCount: output.trackingStatus == .lost ? 0 : frame.landmarks.count
        ))

        for event in output.events {
            switch event {
            case .phaseChanged(let fromPhase, let toPhase):
                emit(session, .phaseChanged(sessionId: session.id, timestampMs: frame.timestampMs, exerciseId: session.evaluator.id, fromPhase: fromPhase, toPhase: toPhase))
            case .repCompleted(let repCount, _, let quality):
                session.repCount = repCount
                emit(session, .repCompleted(sessionId: session.id, timestampMs: frame.timestampMs, exerciseId: session.evaluator.id, repCount: repCount, quality: quality.rawValue))
            case .formIssue(let issueId, let severity, let message, let assessment, let confidence):
                session.formIssueCounts[issueId, default: 0] += 1
                emit(session, .formIssue(
                    sessionId: session.id,
                    timestampMs: frame.timestampMs,
                    exerciseId: session.evaluator.id,
                    issueId: issueId,
                    severity: severity.rawValue,
                    message: message,
                    assessment: assessment.rawValue,
                    confidence: confidence
                ))
            case .calibrationRequired(let requiredView, let guidance):
                emit(session, .calibrationRequired(sessionId: session.id, timestampMs: frame.timestampMs, requiredView: requiredView, guidance: guidance))
            case .calibrationCompleted(let requiredView):
                emit(session, .calibrationCompleted(sessionId: session.id, timestampMs: frame.timestampMs, requiredView: requiredView))
            }
        }
    }

    private func onCaptureError(sessionId: String, error: Error) {
        guard let session = sessions[sessionId] else { return }
        emit(session, .sessionError(sessionId: sessionId, code: "CAPTURE_ERROR", message: String(describing: error), recoverable: false))
    }

    private func emit(_ session: EngineSession, _ event: FormCoachEvent) {
        for listener in session.listeners.values { listener.onEvent(event) }
    }

    private func requireSession(_ sessionId: String) throws -> EngineSession {
        guard let session = sessions[sessionId] else {
            throw EngineError.message("Session '\(sessionId)' does not exist or was disposed.")
        }
        return session
    }

    private func nowMs() -> Int64 {
        Int64(Date().timeIntervalSince1970 * 1000)
    }

    enum EngineError: Error {
        case message(String)
    }
}
