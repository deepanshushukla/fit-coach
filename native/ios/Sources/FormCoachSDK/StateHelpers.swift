import Foundation

public enum HysteresisDirection {
    case below, above
}

/// Boolean state with separate enter/exit thresholds to avoid flicker when a measurement
/// oscillates around a single cut point. `direction = .below` means the state becomes true
/// once the value drops below `enterThreshold` and stays true until it rises above `exitThreshold`.
public final class Hysteresis {
    private let enterThreshold: Float
    private let exitThreshold: Float
    private let direction: HysteresisDirection
    private(set) var isActive: Bool = false

    public init(enterThreshold: Float, exitThreshold: Float, direction: HysteresisDirection) {
        self.enterThreshold = enterThreshold
        self.exitThreshold = exitThreshold
        self.direction = direction
    }

    @discardableResult
    public func update(_ value: Float) -> Bool {
        if value.isNaN { return isActive }

        if direction == .below {
            if !isActive && value <= enterThreshold { isActive = true }
            else if isActive && value >= exitThreshold { isActive = false }
        } else {
            if !isActive && value >= enterThreshold { isActive = true }
            else if isActive && value <= exitThreshold { isActive = false }
        }
        return isActive
    }

    public func reset() {
        isActive = false
    }
}

/// Tracks how long the state machine has continuously been in the current phase.
public final class PhaseTimer {
    private var enteredAtMs: Int64?

    public init() {}

    public func enterPhase(_ timestampMs: Int64) {
        enteredAtMs = timestampMs
    }

    public func elapsedMs(_ timestampMs: Int64) -> Int64 {
        guard let entered = enteredAtMs else { return 0 }
        return timestampMs - entered
    }

    public func hasMetMinDuration(_ timestampMs: Int64, minDurationMs: Int64) -> Bool {
        elapsedMs(timestampMs) >= minDurationMs
    }

    public func reset() {
        enteredAtMs = nil
    }
}

/// Prevents duplicate triggers (rep counts, feedback) within a cooldown window.
public final class Cooldown {
    private let durationMs: Int64
    private var lastTriggeredAtMs: Int64?

    public init(_ durationMs: Int64) {
        self.durationMs = durationMs
    }

    public func isReady(_ timestampMs: Int64) -> Bool {
        guard let last = lastTriggeredAtMs else { return true }
        return timestampMs - last >= durationMs
    }

    public func trigger(_ timestampMs: Int64) {
        lastTriggeredAtMs = timestampMs
    }

    public func reset() {
        lastTriggeredAtMs = nil
    }
}
