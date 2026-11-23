import Foundation

/// One Euro Filter (Casiez, Roussel, Vogel 2012) — adaptive low-pass filter that
/// reduces jitter at low speed while limiting lag at high speed. Operates on a single
/// scalar value over time; apply one instance per coordinate/measurement.
public final class OneEuroFilter {
    private let minCutoff: Float
    private let beta: Float
    private let dCutoff: Float

    private var lastValue: Float?
    private var lastDerivative: Float = 0
    private var lastTimestampMs: Int64?

    public init(minCutoff: Float = 1.0, beta: Float = 0.02, dCutoff: Float = 1.0) {
        self.minCutoff = minCutoff
        self.beta = beta
        self.dCutoff = dCutoff
    }

    private func alpha(cutoff: Float, dtSeconds: Float) -> Float {
        let tau = 1 / (2 * Float.pi * cutoff)
        return 1 / (1 + tau / dtSeconds)
    }

    public func filter(_ value: Float, timestampMs: Int64) -> Float {
        guard let prevTimestamp = lastTimestampMs, let prevValue = lastValue else {
            lastValue = value
            lastTimestampMs = timestampMs
            return value
        }

        let dtSeconds = max(Float(timestampMs - prevTimestamp) / 1000, 1e-3)
        lastTimestampMs = timestampMs

        let derivative = (value - prevValue) / dtSeconds
        let derivativeAlpha = alpha(cutoff: dCutoff, dtSeconds: dtSeconds)
        let smoothedDerivative = derivativeAlpha * derivative + (1 - derivativeAlpha) * lastDerivative
        lastDerivative = smoothedDerivative

        let cutoff = minCutoff + beta * abs(smoothedDerivative)
        let valueAlpha = alpha(cutoff: cutoff, dtSeconds: dtSeconds)
        let smoothedValue = valueAlpha * value + (1 - valueAlpha) * prevValue
        lastValue = smoothedValue

        return smoothedValue
    }

    public func reset() {
        lastValue = nil
        lastDerivative = 0
        lastTimestampMs = nil
    }
}

/// Smooths a named set of scalar measurements independently, each with its own filter instance.
public final class MeasurementSmoother {
    private let minCutoff: Float
    private let beta: Float
    private let dCutoff: Float
    private var filters: [String: OneEuroFilter] = [:]

    public init(minCutoff: Float = 1.0, beta: Float = 0.02, dCutoff: Float = 1.0) {
        self.minCutoff = minCutoff
        self.beta = beta
        self.dCutoff = dCutoff
    }

    public func smooth(_ key: String, _ value: Float, timestampMs: Int64) -> Float {
        if value.isNaN { return value }
        let filter = filters[key] ?? {
            let created = OneEuroFilter(minCutoff: minCutoff, beta: beta, dCutoff: dCutoff)
            filters[key] = created
            return created
        }()
        return filter.filter(value, timestampMs: timestampMs)
    }

    public func reset() {
        filters.removeAll()
    }
}
