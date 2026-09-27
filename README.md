# Time Range Overlap Detector

Determines whether two time intervals overlap and, when they do, returns the length of the intersection. Useful for scheduling and availability checks where you need to know not just *whether* two blocks collide but *how much* of them does.

```js
import { overlap, overlapDuration, formatDuration } from "./src/index.js";

const meeting = { start: 1_000, end: 6_000 };
const blocked = { start: 4_000, end: 9_000 };

overlap(meeting, blocked);                      // true
formatDuration(overlapDuration(meeting, blocked), { unit: "second" }); // "2 seconds"
```

Endpoints are plain numbers on whatever time axis you choose — milliseconds since epoch, minutes since midnight, whatever. The library does not interpret the unit; `overlapDuration` returns its result in that same unit, and `formatDuration` converts it to a readable string.

## Why this exists

Booking systems usually only need a boolean collision check, but availability queries also need the *amount* of collision: a 5-minute overlap between a 60-minute meeting and a 15-minute block is a soft conflict, not a hard one. Computing both from one formula (`max(0, min(ends) - max(starts))`) is cheaper and less error-prone than running a boolean check and then separately computing the intersection.

The trade-off: touching endpoints (one interval ends exactly where another begins) are treated as **non-overlapping**. They share a point but no duration, which is the distinction that matters for scheduling. If you need point-touching to count as a collision, this is not the right library.

## Edge cases worth knowing

- **Inverted intervals** (`start > end`) are silently normalised rather than rejected. This is intentional: real scheduling data is routinely misordered, and failing on it would push a `swap-if-needed` guard into every caller.
- **Zero-length intervals** (a point) are valid. A point strictly inside another interval reports `overlap === true` but `overlapDuration === 0` — there is overlap, but no duration to it.
- **NaN / Infinity / non-number** endpoints throw `TypeError`. The library will not silently produce nonsense durations.
- `formatDuration` rounds to the nearest whole unit rather than emitting `2.0000001 seconds`, because floating-point subtraction of timestamps regularly produces that kind of noise. If you need exact arithmetic, use the raw number from `overlapDuration`.

## Running the tests

```
node --test
```
