import type { TarpitRuleConfig } from '../types'

interface SubjectTrafficRecord {
  timestamps: number[]
  blockedUntil?: number
  consecutiveViolations: number
}

/**
 * TarpitManager manages rate limiting, anomaly throttling, and intentional latency injection (tarpitting).
 * Designed to neutralize aggressive scraping, brute-force attempts, and runaway AI agent loops.
 */
export class TarpitManager {
  private traffic: Map<string, SubjectTrafficRecord> = new Map()

  /**
   * Evaluates request traffic for a given subject key and returns the required tarpit delay or blocking decision.
   *
   * @param subjectKey - Unique identifier for the subject (e.g. `user:123`, `agent:curator-bot`, `ip:192.168.1.1`).
   * @param config - Tarpit configuration rules.
   * @returns An object containing the delay to sleep (in ms) and throttling flags.
   */
  public evaluate(
    subjectKey: string,
    config?: TarpitRuleConfig
  ): { delayMs: number; isThrottled: boolean; isBlocked: boolean } {
    if (!config || config.enabled === false) {
      return { delayMs: 0, isThrottled: false, isBlocked: false }
    }

    const now = Date.now()
    const record = this.traffic.get(subjectKey) || {
      timestamps: [],
      consecutiveViolations: 0
    }

    // 1. Check if currently under temporary hard block
    if (record.blockedUntil && record.blockedUntil > now) {
      return {
        delayMs: config.delayMs || 1000,
        isThrottled: true,
        isBlocked: true
      }
    }

    // 2. Clean up timestamps older than 60 seconds (sliding window)
    const windowStart = now - 60000
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart)
    record.timestamps.push(now)
    this.traffic.set(subjectKey, record)

    const maxRpm = config.maxRequestsPerMinute ?? 60
    const burst = config.burst ?? 10
    const currentCount = record.timestamps.length

    // 3. Normal traffic within limits
    if (currentCount <= burst && currentCount <= maxRpm) {
      record.consecutiveViolations = 0
      return { delayMs: 0, isThrottled: false, isBlocked: false }
    }

    // 4. Rate violation detected -> Apply progressive tarpitting
    record.consecutiveViolations += 1
    const baseDelay = config.delayMs ?? 1000
    // Exponential multiplier based on consecutive violations (capped at 10x)
    const multiplier = Math.min(record.consecutiveViolations, 10)
    const totalDelay = baseDelay * multiplier

    // Check if hard block threshold should trigger
    if (config.blockDurationMs && record.consecutiveViolations >= 5) {
      record.blockedUntil = now + config.blockDurationMs
      return { delayMs: totalDelay, isThrottled: true, isBlocked: true }
    }

    return { delayMs: totalDelay, isThrottled: true, isBlocked: false }
  }

  /**
   * Injects an intentional asynchronous delay into the execution loop (tarpitting).
   *
   * @param delayMs - Duration in milliseconds to delay.
   */
  public async sleep(delayMs: number): Promise<void> {
    if (delayMs <= 0) return
    return new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  /**
   * Resets traffic history for a specific subject or clears all records.
   *
   * @param subjectKey - Optional subject key to reset.
   */
  public reset(subjectKey?: string): void {
    if (subjectKey) {
      this.traffic.delete(subjectKey)
    } else {
      this.traffic.clear()
    }
  }
}
