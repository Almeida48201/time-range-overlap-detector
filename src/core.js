/**
 * Pure functions for detecting overlap between two time intervals.
 *
 * All intervals are represented as `{ start, end }` objects where `start`
 * and `end` are numbers on the same arbitrary time axis. The library never
 * interprets what the numbers mean (milliseconds, minutes since midnight,
 * unix seconds) — the caller picks the unit and the results come back in
 * that same unit. This keeps the core dependency-free and side-effect-free.
 */

/**
 * Parse a plain `[start, end]` pair or an `{ start, end }` object into a
 * normalised interval whose `start` is the smaller value.
 *
 * We auto-swap the endpoints here (rather than rejecting inverted input)
 * because scheduling data in the wild — user-typed ranges, database rows
 * with misordered columns — is routinely inverted, and failing loudly on
 * it would force every caller to duplicate the same guard. The cost of
 * tolerating it is zero for the common case.
 *
 * @param {[number, number] | { start: number, end: number }} input
 * @returns {{ start: number, end: number }}
 */
export function parseTime(input) {
  let start;
  let end;

  if (Array.isArray(input)) {
    if (input.length !== 2) {
      throw new TypeError("array intervals must have exactly two elements");
    }
    [start, end] = input;
  } else if (input !== null && typeof input === "object") {
    if (
      !Object.prototype.hasOwnProperty.call(input, "start") ||
      !Object.prototype.hasOwnProperty.call(input, "end")
    ) {
      throw new TypeError("object intervals must have `start` and `end` keys");
    }
    ({ start, end } = input);
  } else {
    throw new TypeError("interval must be an array or an object with start/end");
  }

  if (typeof start !== "number" || typeof end !== "number") {
    throw new TypeError("interval endpoints must be numbers");
  }
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new TypeError("interval endpoints must not be NaN");
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new TypeError("interval endpoints must be finite");
  }

  // Normalise so start <= end. Inverted inputs are treated as valid.
  if (start > end) {
    return { start: end, end: start };
  }
  return { start, end };
}

/**
 * Decide whether two intervals overlap.
 *
 * Edge touching is treated as non-overlapping: an interval ending at 10
 * and one starting at 10 share a point but no duration, which is the
 * meaningful distinction for scheduling. `overlapDuration` returns 0 in
 * that case, so the two functions agree.
 *
 * @param {[number, number] | { start: number, end: number }} a
 * @param {[number, number] | { start: number, end: number }} b
 * @returns {boolean}
 */
export function overlap(a, b) {
  const ia = parseTime(a);
  const ib = parseTime(b);
  // Strict inequalities encode the "touching is not overlapping" rule.
  return ia.start < ib.end && ib.start < ia.end;
}

/**
 * Return the length of the intersection of two intervals, or 0 if they do
 * not overlap.
 *
 * Computing the duration independently of `overlap` (rather than calling
 * `overlap` and short-circuiting to 0) is deliberate: the formula
 * `max(0, min(ends) - max(starts))` already yields 0 for every non-<wbr>
 * overlapping case, so a separate boolean check would be dead code.
 *
 * @param {[number, number] | { start: number, end: number }} a
 * @param {[number, number] | { start: number, end: number }} b
 * @returns {number}
 */
export function overlapDuration(a, b) {
  const ia = parseTime(a);
  const ib = parseTime(b);
  const latestStart = Math.max(ia.start, ib.start);
  const earliestEnd = Math.min(ia.end, ib.end);
  const duration = earliestEnd - latestStart;
  return duration > 0 ? duration : 0;
}

/**
 * Format a numeric duration as a human-readable string.
 *
 * Uses `Math.round` deliberately: durations that come from floating-point
 * arithmetic (e.g. subtracting two millisecond timestamps) can carry
 * sub-unit noise, and a display function should not expose that to the
 * user. For callers who need exact arithmetic, `overlapDuration` already
 * returns the raw number.
 *
 * @param {number} duration
 * @param {{ unit?: "millisecond" | "second" | "minute" | "hour" }} [options]
 * @returns {string}
 */
export function formatDuration(duration, options = {}) {
  if (typeof duration !== "number" || Number.isNaN(duration)) {
    throw new TypeError("duration must be a number");
  }
  if (!Number.isFinite(duration)) {
    throw new TypeError("duration must be finite");
  }
  if (duration < 0) {
    throw new RangeError("duration must not be negative");
  }

  const unit = options.unit ?? "millisecond";
  const validUnits = new Set(["millisecond", "second", "minute", "hour"]);
  if (!validUnits.has(unit)) {
    throw new RangeError(`unknown unit "${unit}"`);
  }

  // Number of the chosen unit per one millisecond.
  const perMs =
    unit === "millisecond" ? 1
    : unit === "second" ? 1 / 1000
    : unit === "minute" ? 1 / 60_000
    : 1 / 3_600_000;

  const rounded = Math.round(duration * perMs);
  return `${rounded} ${unit}${rounded === 1 ? "" : "s"}`;
}
