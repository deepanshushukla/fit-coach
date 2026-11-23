import AVFoundation
import UIKit
import FormCoachSDK

/// Owns the AVCaptureSession lifecycle for one session: binds a camera input + video data
/// output, dispatches frames to the pose source on a dedicated queue (never the main
/// queue, which must stay free for UI), and deterministically tears everything down on
/// `dispose()` per spec 17.5's release gate. Mirrors native/android's CameraXBridge.kt.
final class AVCaptureBridge: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    private let facing: CameraFacing
    private let modelPath: String
    private let onPoseFrame: (PoseFrame) -> Void
    private let onError: (Error) -> Void

    private let captureQueue = DispatchQueue(label: "com.formcoach.sdk.capture")
    private var session: AVCaptureSession?
    private var poseSource: MediaPipePoseSource?
    private var disposed = false

    private(set) var previewLayer: AVCaptureVideoPreviewLayer?

    init(facing: CameraFacing, modelPath: String, onPoseFrame: @escaping (PoseFrame) -> Void, onError: @escaping (Error) -> Void) {
        self.facing = facing
        self.modelPath = modelPath
        self.onPoseFrame = onPoseFrame
        self.onError = onError
    }

    func start() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configureAndStart()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted {
                        self?.configureAndStart()
                    } else {
                        self?.onError(CaptureError.permissionDenied)
                    }
                }
            }
        case .denied, .restricted:
            onError(CaptureError.permissionDenied)
        @unknown default:
            onError(CaptureError.permissionDenied)
        }
    }

    private func configureAndStart() {
        if disposed { return }
        do {
            poseSource = try MediaPipePoseSource(modelPath: modelPath, onFrame: onPoseFrame, onError: onError)
        } catch {
            onError(error)
            return
        }

        let session = AVCaptureSession()
        session.beginConfiguration()
        session.sessionPreset = .high

        let position: AVCaptureDevice.Position = facing == .front ? .front : .back
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else {
            onError(CaptureError.deviceUnavailable)
            return
        }
        session.addInput(input)

        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: captureQueue)
        guard session.canAddOutput(output) else {
            onError(CaptureError.deviceUnavailable)
            return
        }
        session.addOutput(output)

        session.commitConfiguration()

        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        self.previewLayer = layer
        self.session = session

        captureQueue.async {
            session.startRunning()
        }
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let timestampMs = Int64(CMSampleBufferGetPresentationTimeStamp(sampleBuffer).seconds * 1000)
        // Demo app is portrait-locked (see Info.plist), so the sensor-to-upright rotation is
        // fixed at 90deg for back camera / 90deg for front on this device class. A production
        // build would read `connection.videoOrientation`/device orientation per frame.
        poseSource?.analyze(
            pixelBuffer: pixelBuffer,
            mirrored: facing == .front,
            rotationDegrees: 90,
            timestampMs: timestampMs
        )
    }

    /// Deterministically releases the capture session, the inference session and the capture queue's work.
    func dispose() {
        if disposed { return }
        disposed = true
        session?.stopRunning()
        session = nil
        previewLayer = nil
        poseSource?.close()
        poseSource = nil
    }

    enum CaptureError: Error {
        case permissionDenied
        case deviceUnavailable
    }
}
