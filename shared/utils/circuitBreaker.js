// Lightweight circuit breaker — no external dependency needed.
// States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)

const STATE = { CLOSED: "CLOSED", OPEN: "OPEN", HALF_OPEN: "HALF_OPEN" };

class CircuitBreaker {
  constructor(name, opts = {}) {
    this.name            = name;
    this.threshold       = opts.threshold    || 3;    // failures before opening
    this.timeout         = opts.timeout      || 15000; // ms to wait before HALF_OPEN
    this.successRequired = opts.successRequired || 1;  // successes to close again

    this.state         = STATE.CLOSED;
    this.failureCount  = 0;
    this.successCount  = 0;
    this.lastFailureAt = null;
  }

  isOpen() {
    if (this.state === STATE.OPEN) {
      // Check if enough time passed to move to HALF_OPEN
      if (Date.now() - this.lastFailureAt >= this.timeout) {
        this.state = STATE.HALF_OPEN;
        return false;
      }
      return true;
    }
    return false;
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === STATE.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successRequired) {
        this.state        = STATE.CLOSED;
        this.successCount = 0;
      }
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureAt = Date.now();
    this.successCount  = 0;
    if (this.failureCount >= this.threshold) {
      this.state = STATE.OPEN;
    }
  }

  getStatus() {
    return {
      name:         this.name,
      state:        this.state,
      failureCount: this.failureCount,
      lastFailureAt: this.lastFailureAt,
      nextRetryAt:  this.state === STATE.OPEN
        ? new Date(this.lastFailureAt + this.timeout).toISOString()
        : null,
    };
  }

  async execute(fn, fallback = null) {
    if (this.isOpen()) {
      if (fallback !== null) return typeof fallback === "function" ? fallback() : fallback;
      const err = new Error(`Circuit breaker OPEN for service: ${this.name}`);
      err.circuitOpen = true;
      throw err;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      if (fallback !== null) return typeof fallback === "function" ? fallback() : fallback;
      throw err;
    }
  }
}

// ─── Singleton registry — one breaker per downstream service ──────────────────
const breakers = {};

function getBreaker(name, opts) {
  if (!breakers[name]) breakers[name] = new CircuitBreaker(name, opts);
  return breakers[name];
}

function getAllStatus() {
  return Object.values(breakers).map((b) => b.getStatus());
}

module.exports = { getBreaker, getAllStatus };
