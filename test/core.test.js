import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseTime,
  overlap,
  overlapDuration,
  formatDuration,
} from "../src/core.js";

// A fixed, arbitrary time axis (milliseconds since epoch) used across tests
// so nothing depends on the wall clock. Every interval is expressed in these
// numbers, never via `Date.now()` or `new Date()`.
const T0 = 1_700_000_000_000;

// Hand-computed intervals on that axis.
const A = { start: T0, end: T0 + 10_000 };
// B overlaps A in the middle.
const B = { start: T0 + 4_000, end: T0 + 12_000 };
// C sits entirely after A, touching at T0 + 10_000.
const C = { start: T0 + 10_000, end: T0 + 15_000 };
// D sits entirely before A, touching at T0.
const D = { start: T0 - 5_000, end: T0 };
// E is nested entirely inside A.
const E = { start: T0 + 2_000, end: T0 + 6_000 };
// F is disjoint from A with a gap.
const F = { start: T0 + 20_000, end: T0 + 30_000 };

describe("parseTime", () => {
  it("accepts an array interval", () => {
    assert.deepEqual(parseTime([T0, T0 + 10_000]), {
      start: T0,
      end: T0 + 10_000,
    });
  });

  it("accepts an object interval", () => {
    assert.deepEqual(parseTime({ start: T0, end: T0 + 10_000 }), {
      start: T0,
      end: T0 + 10_000,
    });
  });

  it("normalises an inverted interval so start <= end", () => {
    const inverted = { start: T0 + 10_000, end: T0 };
    assert.deepEqual(parseTime(inverted), { start: T0, end: T0 + 10_000 });
  });

  it("preserves a zero-length interval", () => {
    assert.deepEqual(parseTime([T0, T0]), { start: T0, end: T0 });
  });

  it("rejects an array that does not have exactly two elements", () => {
    assert.throws(() => parseTime([T0]), TypeError);
    assert.throws(() => parseTime([T0, T0, T0]), TypeError);
  });

  it("rejects an object missing start or end", () => {
    assert.throws(() => parseTime({ start: T0 }), TypeError);
    assert.throws(() => parseTime({ end: T0 }), TypeError);
  });

  it("rejects non-number endpoints", () => {
    assert.throws(() => parseTime({ start: "x", end: 1 }), TypeError);
  });

  it("rejects NaN and Infinity endpoints", () => {
    assert.throws(() => parseTime([NaN, 1]), TypeError);
    assert.throws(() => parseTime([Infinity, 1]), TypeError);
  });

  it("rejects inputs that are neither array nor object", () => {
    assert.throws(() => parseTime("x"), TypeError);
    assert.throws(() => parseTime(null), TypeError);
  });
});

describe("overlap", () => {
  it("returns true for partial overlap", () => {
    assert.equal(overlap(A, B), true);
  });

  it("returns true for a nested interval", () => {
    assert.equal(overlap(A, E), true);
  });

  it("returns false when intervals only touch at a point", () => {
    assert.equal(overlap(A, C), false);
    assert.equal(overlap(A, D), false);
  });

  it("returns false for a disjoint interval with a gap", () => {
    assert.equal(overlap(A, F), false);
  });

  it("returns false for a zero-length interval touching a boundary", () => {
    // A zero-length interval at the exact start of A shares a point only.
    assert.equal(overlap(A, { start: T0, end: T0 }), false);
  });

  it("returns true for a zero-length interval strictly inside another", () => {
    // A point at T0+5000 sits within A's open interior.
    assert.equal(overlap(A, { start: T0 + 5_000, end: T0 + 5_000 }), true);
  });

  it("accepts array-form intervals", () => {
    assert.equal(overlap([T0, T0 + 10_000], [T0 + 4_000, T0 + 12_000]), true);
  });

  it("accepts inverted intervals", () => {
    assert.equal(
      overlap({ start: T0 + 10_000, end: T0 }, { start: T0 + 12_000, end: T0 + 4_000 }),
      true,
    );
  });
});

describe("overlapDuration", () => {
  it("returns the shared length for partial overlap", () => {
    // A is [0,10000], B is [4000,12000] -> shared [4000,10000] = 6000.
    assert.equal(overlapDuration(A, B), 6_000);
  });

  it("returns the smaller length when one interval nests inside the other", () => {
    // E is [2000,6000], fully inside A -> shared = E = 4000.
    assert.equal(overlapDuration(A, E), 4_000);
  });

  it("returns 0 when intervals only touch at a point", () => {
    assert.equal(overlapDuration(A, C), 0);
    assert.equal(overlapDuration(A, D), 0);
  });

  it("returns 0 for a disjoint interval with a gap", () => {
    assert.equal(overlapDuration(A, F), 0);
  });

  it("returns 0 for a zero-length interval touching a boundary", () => {
    assert.equal(overlapDuration(A, { start: T0, end: T0 }), 0);
  });

  it("returns 0 for a zero-length interval strictly inside another", () => {
    // A point has no duration, so the intersection has no duration either,
    // even though `overlap` returns true for the same inputs.
    assert.equal(overlapDuration(A, { start: T0 + 5_000, end: T0 + 5_000 }), 0);
  });

  it("is symmetric: overlapDuration(a, b) === overlapDuration(b, a)", () => {
    assert.equal(overlapDuration(A, B), overlapDuration(B, A));
    assert.equal(overlapDuration(A, F), overlapDuration(F, A));
  });

  it("accepts array-form intervals", () => {
    assert.equal(
      overlapDuration([T0, T0 + 10_000], [T0 + 4_000, T0 + 12_000]),
      6_000,
    );
  });
});

describe("formatDuration", () => {
  it("formats a zero duration", () => {
    assert.equal(formatDuration(0), "0 milliseconds");
  });

  it("formats a single unit with singular form", () => {
    assert.equal(formatDuration(1), "1 millisecond");
  });

  it("formats milliseconds by default", () => {
    assert.equal(formatDuration(6_000), "6000 milliseconds");
  });

  it("converts to seconds", () => {
    assert.equal(formatDuration(6_000, { unit: "second" }), "6 seconds");
    assert.equal(formatDuration(1_000, { unit: "second" }), "1 second");
  });

  it("converts to minutes", () => {
    assert.equal(formatDuration(60_000, { unit: "minute" }), "1 minute");
    assert.equal(formatDuration(180_000, { unit: "minute" }), "3 minutes");
  });

  it("converts to hours", () => {
    assert.equal(formatDuration(3_600_000, { unit: "hour" }), "1 hour");
    assert.equal(formatDuration(7_200_000, { unit: "hour" }), "2 hours");
  });

  it("rounds sub-unit noise rather than truncating", () => {
    // 59_999 ms is 0.99998 minutes -> rounds to 1 minute.
    assert.equal(formatDuration(59_999, { unit: "minute" }), "1 minute");
  });

  it("rejects negative durations", () => {
    assert.throws(() => formatDuration(-1), RangeError);
  });

  it("rejects NaN and Infinity", () => {
    assert.throws(() => formatDuration(NaN), TypeError);
    assert.throws(() => formatDuration(Infinity), TypeError);
  });

  it("rejects an unknown unit", () => {
    assert.throws(() => formatDuration(1, { unit: "day" }), RangeError);
  });
});
