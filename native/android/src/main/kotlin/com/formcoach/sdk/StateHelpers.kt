package com.formcoach.sdk

enum class HysteresisDirection { BELOW, ABOVE }

/**
 * Boolean state with separate enter/exit thresholds to avoid flicker when a measurement
 * oscillates around a single cut point. `direction = BELOW` means the state becomes true
 * once the value drops below `enterThreshold` and stays true until it rises above `exitThreshold`.
 */
class Hysteresis(
    private val enterThreshold: Float,
    private val exitThreshold: Float,
    private val direction: HysteresisDirection,
) {
    var isActive: Boolean = false
        private set

    fun update(value: Float): Boolean {
        if (value.isNaN()) return isActive

        if (direction == HysteresisDirection.BELOW) {
            if (!isActive && value <= enterThreshold) isActive = true
            else if (isActive && value >= exitThreshold) isActive = false
        } else {
            if (!isActive && value >= enterThreshold) isActive = true
            else if (isActive && value <= exitThreshold) isActive = false
        }
        return isActive
    }

    fun reset() {
        isActive = false
    }
}

/** Tracks how long the state machine has continuously been in the current phase. */
class PhaseTimer {
    private var enteredAtMs: Long? = null

    fun enterPhase(timestampMs: Long) {
        enteredAtMs = timestampMs
    }

    fun elapsedMs(timestampMs: Long): Long {
        val entered = enteredAtMs ?: return 0
        return timestampMs - entered
    }

    fun hasMetMinDuration(timestampMs: Long, minDurationMs: Long): Boolean {
        return elapsedMs(timestampMs) >= minDurationMs
    }

    fun reset() {
        enteredAtMs = null
    }
}

/** Prevents duplicate triggers (rep counts, feedback) within a cooldown window. */
class Cooldown(private val durationMs: Long) {
    private var lastTriggeredAtMs: Long? = null

    fun isReady(timestampMs: Long): Boolean {
        val last = lastTriggeredAtMs ?: return true
        return timestampMs - last >= durationMs
    }

    fun trigger(timestampMs: Long) {
        lastTriggeredAtMs = timestampMs
    }

    fun reset() {
        lastTriggeredAtMs = null
    }
}
