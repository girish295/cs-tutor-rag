---
id: arrays-and-strings
title: Arrays, Dynamic Arrays and Strings
topic: Data Structures
tags: [array, string, two-pointer, sliding-window, prefix-sum, memory]
difficulty: beginner
---

## Arrays in memory

An array stores elements in one contiguous block of memory. Because every element has the same size, the address of element `i` is just `base_address + i * element_size`, which is a single arithmetic operation. That is why array indexing is `O(1)` and why arrays are the foundation nearly every other data structure is built on.

Contiguity also gives arrays excellent cache locality. Modern CPUs fetch memory in cache lines of roughly 64 bytes, so reading `arr[0]` typically pulls the next several elements into cache for free. This is a large constant-factor advantage that Big-O does not capture, and it is the main reason arrays routinely outperform linked lists even when the theoretical complexity is identical.

## Static versus dynamic arrays

A static array has a fixed size decided at creation, as in C with `int arr[100]` or Java with `new int[100]`.

A dynamic array grows on demand. Python lists, JavaScript arrays, Java `ArrayList` and C++ `std::vector` are all dynamic arrays. Internally each holds a static buffer plus a length. When the buffer fills, the structure allocates a larger one — usually double the size — copies the elements across and frees the old buffer.

Doubling is the key detail. It makes appends `O(1)` amortised, because the expensive copies become geometrically rarer as the array grows. If the implementation grew by a fixed amount instead, appends would be `O(n)` amortised.

## Complexity summary

| Operation | Complexity | Why |
|---|---|---|
| Access by index | `O(1)` | Direct address arithmetic |
| Update by index | `O(1)` | Direct address arithmetic |
| Append at end | `O(1)` amortised | Occasional resize and copy |
| Insert at front or middle | `O(n)` | Must shift subsequent elements right |
| Delete at front or middle | `O(n)` | Must shift subsequent elements left |
| Search unsorted | `O(n)` | Must check each element |
| Search sorted | `O(log n)` | Binary search |

The pattern to remember: anything at the end is cheap, anything that shifts elements is linear.

## Strings are usually immutable

In Python, Java, JavaScript and C# strings are immutable: every operation that appears to modify a string actually builds a new one. This has a sharp performance consequence.

```python
# O(n^2) — each += copies the whole accumulated string
result = ""
for word in words:
    result += word

# O(n) — join allocates once
result = "".join(words)
```

The first version is a genuinely common bug in real code. The same applies to Java, where you use `StringBuilder` instead of repeated concatenation, and to JavaScript, where you push onto an array and call `join("")`.

## The two-pointer technique

Two pointers walk the array, and because each only moves forward the total work stays `O(n)` even though the code looks nested.

Reversing in place:

```python
def reverse(arr):
    left, right = 0, len(arr) - 1
    while left < right:
        arr[left], arr[right] = arr[right], arr[left]
        left += 1
        right -= 1
```

Finding a pair summing to a target in a sorted array, in `O(n)` time and `O(1)` space:

```python
def two_sum_sorted(arr, target):
    left, right = 0, len(arr) - 1
    while left < right:
        current = arr[left] + arr[right]
        if current == target:
            return (left, right)
        if current < target:
            left += 1     # need a bigger sum
        else:
            right -= 1    # need a smaller sum
    return None
```

The logic works because sortedness tells you which direction to move. On an unsorted array you would use a hash table instead, trading `O(n)` space for `O(n)` time.

## The sliding window technique

A sliding window maintains a contiguous range and adjusts its edges rather than recomputing from scratch. It turns many `O(n^2)` brute-force scans into `O(n)`.

Longest substring without repeating characters:

```python
def longest_unique(s):
    seen = {}
    start = best = 0
    for end, ch in enumerate(s):
        if ch in seen and seen[ch] >= start:
            start = seen[ch] + 1   # shrink window past the duplicate
        seen[ch] = end
        best = max(best, end - start + 1)
    return best
```

Fixed-size windows are simpler still: add the entering element, subtract the leaving one, and you get every window sum in `O(n)` total instead of `O(n * k)`.

## Prefix sums

When you need many range-sum queries over an unchanging array, precompute cumulative totals once in `O(n)`, then answer each query in `O(1)`.

```python
prefix = [0]
for x in arr:
    prefix.append(prefix[-1] + x)

# sum of arr[i..j] inclusive
range_sum = prefix[j + 1] - prefix[i]
```

This is a pure time-space trade: `O(n)` extra memory buys unlimited constant-time queries. If the array does change between queries, you need a Fenwick tree or segment tree instead.
