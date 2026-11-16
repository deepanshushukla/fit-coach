/// Contract for the Flutter-facing engine API: camera capture, pose inference and
/// exercise evaluation all happen in the native Android/iOS engines (spec 7.2/8.6).
/// No frame buffers cross a platform channel — only the compact types below do.
///
/// NOT IMPLEMENTED. This file defines the Dart-side contract only; see
/// native/flutter/README.md. There is no pubspec.yaml and this has never been built.
library form_coach_engine;

enum TrackingStatus { ready, tracking, partial, lost, calibrating }

enum CameraFacing { front, back }

enum BodyView { front, side, back }

class InitializeConfig {
  final String appId;
  final String environment;
  final int targetFps;
  final String processingResolution;

  const InitializeConfig({
    required this.appId,
    required this.environment,
    this.targetFps = 24,
    this.processingResolution = '720p',
  });
}

class CreateSessionConfig {
  final String exercise;
  final CameraFacing cameraFacing;
  final BodyView requiredView;

  const CreateSessionConfig({
    required this.exercise,
    required this.cameraFacing,
    required this.requiredView,
  });
}

abstract class FormCoachEvent {
  final String sessionId;
  final int timestampMs;
  const FormCoachEvent(this.sessionId, this.timestampMs);
}

class TrackingUpdateEvent extends FormCoachEvent {
  final TrackingStatus status;
  const TrackingUpdateEvent(String sessionId, int timestampMs, this.status)
      : super(sessionId, timestampMs);
}

class RepCompletedEvent extends FormCoachEvent {
  final int repCount;
  final String quality;
  const RepCompletedEvent(String sessionId, int timestampMs, this.repCount, this.quality)
      : super(sessionId, timestampMs);
}

class FormIssueEvent extends FormCoachEvent {
  final String issueId;
  final String severity;
  final String message;
  const FormIssueEvent(
    String sessionId,
    int timestampMs,
    this.issueId,
    this.severity,
    this.message,
  ) : super(sessionId, timestampMs);
}

abstract class FormCoachEngine {
  Future<void> initialize(InitializeConfig config);

  /// Returns an opaque session ID. Does not start the camera.
  Future<String> createSession(CreateSessionConfig config);

  Future<void> start(String sessionId);
  Future<void> pause(String sessionId);
  Future<void> resume(String sessionId);
  Future<void> stop(String sessionId);

  /// Must deterministically release the camera, inference session and native buffers.
  Future<void> dispose(String sessionId);

  Stream<FormCoachEvent> events(String sessionId);
}
