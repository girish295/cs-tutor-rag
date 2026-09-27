---
id: binary-search
title: Binary Search and Search on Answer
topic: Algorithms
tags: [binary-search, search, invariant, off-by-one, bisect]
difficulty: beginner
---

## The idea

Binary search finds a target in a **sorted** array by halving the search space each step. Compare the target with the middle element: if it matches you are done, if the target is smaller the answer can only be in the left half, and if larger only in the right half. Each comparison eliminates half the remaining candidates, so the cost is `O(log n)`.

The logarithm is what makes this powerful. Searching a sorted array of a billion elements takes about 30 comparisons.

Sortedness is a hard prerequisite. On unsorted data binary search returns wrong answers silently rather than failing loudly, which makes it a dangerous bug. If you must sort first, that costs `O(n log n)`, so a single lookup on unsorted data is better served by a linear scan — binary search pays off when you search the same sorted array many times.

## Canonical implementation

```python
def binary_search(arr, target):
    low, high = 0, len(arr) - 1        # inclusive bounds
    while low <= high:                 # <= because bounds are inclusive
        mid = low + (high - low) // 2  # avoids overflow in fixed-width ints
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            low = mid + 1              # must be mid + 1, not mid
        else:
            high = mid - 1             # must be mid - 1, not mid
    return -1                          # not found
```

Three details carry almost all the bugs:

**The loop condition must match the bounds convention.** With inclusive `high = len(arr) - 1` you need `while low <= high`, because `low == high` still describes one unexamined element. If you instead use exclusive `high = len(arr)`, the condition becomes `while low < high`. Mixing the two conventions is the most common way to write a binary search that misses the last element.

**The bounds must move past `mid`.** Writing `low = mid` instead of `low = mid + 1` means that when `high - low == 1` the range stops shrinking, and the loop spins forever. Every iteration must strictly reduce the interval.

**Compute `mid` as `low + (high - low) // 2`.** In Python integers are arbitrary precision so `(low + high) // 2` is safe, but in Java, C and C++ that sum can overflow for large arrays. This was a real bug in the JDK's own binary search for nine years.

## Thinking in invariants

The reliable way to write a correct binary search is to name the invariant before writing the loop, then check that every branch preserves it. For the version above the invariant is: *if the target exists, its index lies within `[low, high]`*. Each branch discards only a region that provably cannot contain the target, so the invariant holds, and when the interval empties the target does not exist.

This discipline matters more than memorising the template, because most real uses are not the plain "find exactly this value" case.

## Finding boundaries, not just values

The more useful variants find the *first* or *last* position satisfying a predicate. These do not return early on a match; they keep narrowing to pin down the boundary.

```python
def lower_bound(arr, target):
    """First index with arr[i] >= target; len(arr) if none."""
    low, high = 0, len(arr)          # exclusive upper bound
    while low < high:
        mid = low + (high - low) // 2
        if arr[mid] < target:
            low = mid + 1
        else:
            high = mid               # keep mid as a candidate
    return low
```

`lower_bound` gives the insertion point that keeps the array sorted, counts elements below a value, and locates the first occurrence in an array with duplicates. The mirrored version, `upper_bound`, returns the first index strictly greater than the target, and the difference between the two is the number of occurrences.

Python's standard library provides both as `bisect.bisect_left` and `bisect.bisect_right`. Use them rather than hand-rolling.

## Binary search on the answer

The most valuable generalisation: binary search does not need an array at all. It needs a **monotonic predicate** — a boolean function that is false for all values below some threshold and true for all values above it. You can then binary search the answer space directly.

The pattern applies to questions of the form "what is the minimum capacity, speed or size that makes this feasible". Checking feasibility for a specific candidate is often easy and linear; finding the optimal candidate by binary search then costs only `log(range)` feasibility checks.

```python
def min_feasible(lo, hi, feasible):
    """Smallest x in [lo, hi] with feasible(x) true, assuming monotonicity."""
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if feasible(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo
```

Classic instances include shipping packages within `d` days by finding the minimum daily capacity, allocating pages among students to minimise the maximum load, and computing integer square roots. The skill being tested is recognising the monotonicity, not writing the loop.

## Binary search on rotated arrays

A sorted array rotated at an unknown pivot, such as `[4, 5, 6, 7, 0, 1, 2]`, is still searchable in `O(log n)`. At each step at least one half is properly sorted; determine which by comparing `arr[low]` with `arr[mid]`, test whether the target falls inside that sorted half's range, and recurse into it or the other half accordingly. Duplicate values degrade this to `O(n)` in the worst case, because they can make it impossible to tell which half is sorted.
