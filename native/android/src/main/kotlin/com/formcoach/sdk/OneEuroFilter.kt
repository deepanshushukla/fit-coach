package com.formcoach.sdk

import kotlin.math.PI
import kotlin.math.abs

/**
 * One Euro Filter (Casiez, Roussel, Vogel 2012) — adaptive low-pass filter that
 * reduces jitter at low speed while limiting lag at high speed. Operates on a single
 * scalar value over time; apply one instance per coordinate/measurement.
 */
class OneEuroFilter(
    private val minCutoff: Float = 1.0f,
    private val beta: Float = 0.02f,
    private val dCutoff: Float = 1.0f,
) {
    private var lastValue: Float? = null
    private var lastDerivative: Float = 0f
    private var lastTimestampMs: Long? = null

    private fun alpha(cutoff: Float, dtSeconds: Float): Float {
        val tau = 1f / (2f * PI.toFloat() * cutoff)
        return 1f / (1f + tau / dtSeconds)
    }

    fun filter(value: Float, timestampMs: Long): Float {
        val prevTimestamp = lastTimestampMs
        val prevValue = lastValue
        if (prevTimestamp == null || prevValue == null) {
            lastValue = value
            lastTimestampMs = timestampMs
            return value
        }

        val dtSeconds = ((timestampMs - prevTimestamp) / 1000f).coerceAtLeast(1e-3f)
        lastTimestampMs = timestampMs

        val derivative = (value - prevValue) / dtSeconds
        val derivativeAlpha = alpha(dCutoff, dtSeconds)
        val smoothedDerivative = derivativeAlpha * derivative + (1 - derivativeAlpha) * lastDerivative
        lastDerivative = smoothedDerivative

        val cutoff = minCutoff + beta * abs(smoothedDerivative)
        val valueAlpha = alpha(cutoff, dtSeconds)
        val smoothedValue = valueAlpha * value + (1 - valueAlpha) * prevValue
        lastValue = smoothedValue

        return smoothedValue
    }

    fun reset() {
        lastValue = null
        lastDerivative = 0f
        lastTimestampMs = null
    }
}

/** Smooths a named set of scalar measurements independently, each with its own filter instance. */
class MeasurementSmoother(
    private val minCutoff: Float = 1.0f,
    private val beta: Float = 0.02f,
    private val dCutoff: Float = 1.0f,
) {
    private val filters = mutableMapOf<String, OneEuroFilter>()

    fun smooth(key: String, value: Float, timestampMs: Long): Float {
        if (value.isNaN()) return value
        val filter = filters.getOrPut(key) { OneEuroFilter(minCutoff, beta, dCutoff) }
        return filter.filter(value, timestampMs)
    }

    fun reset() {
        filters.clear()
    }
}
