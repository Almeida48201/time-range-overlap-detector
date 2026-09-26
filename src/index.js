/**
 * Public entry point for time-range-overlap.
 *
 * The library is split into a pure `core` module that holds all logic and
 * this thin re-export, so callers get a single import surface while the
 * test suite can target the core functions directly if it wants to.
 */
export {
  parseTime,
  overlap,
  overlapDuration,
  formatDuration,
} from "./core.js";
