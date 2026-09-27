---
id: sorting-algorithms
title: Sorting Algorithms
topic: Algorithms
tags: [sorting, merge-sort, quicksort, stability, timsort, counting-sort]
difficulty: intermediate
---

## The comparison-sort lower bound

Any sorting algorithm that works only by comparing pairs of elements needs at least `O(n log n)` comparisons in the worst case. The argument is information-theoretic: there are `n!` possible orderings, each comparison yields one bit, and `log2(n!)` is proportional to `n log n`. So merge sort and heap sort are asymptotically optimal, and no clever comparison sort will ever beat that bound.

Algorithms that exploit structure in the data rather than comparing elements — counting sort, radix sort, bucket sort — can do better, because the bound does not apply to them.

## The quadratic sorts

**Bubble sort** repeatedly walks the array swapping adjacent out-of-order pairs. Each pass floats the largest remaining element to the end. It is `O(n^2)` and has no practical use, but it is `O(n)` on already-sorted input if you break early when a pass makes no swaps.

**Selection sort** finds the minimum of the unsorted portion and swaps it into place. Always `O(n^2)`, even on sorted input, because it always scans the remainder. Its one virtue is doing only `O(n)` swaps, which matters if writes are far more expensive than reads.

**Insertion sort** takes each element and slides it left into its correct position among the already-sorted prefix. It is `O(n^2)` in general but `O(n)` on nearly-sorted data, it is stable, and it sorts in place with tiny constants. That combination makes it genuinely useful: real library sorts switch to insertion sort for subarrays below roughly 16 elements.

## Merge sort

Merge sort is divide and conquer. Split the array in half, recursively sort each half, then merge the two sorted halves by repeatedly taking the smaller front element.

```python
def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(a, b):
    out, i, j = [], 0, 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:          # <= is what makes it stable
            out.append(a[i]); i += 1
        else:
            out.append(b[j]); j += 1
    out.extend(a[i:]); out.extend(b[j:])
    return out
```

It is `O(n log n)` in all cases — best, average and worst — which is its main selling point. The cost is `O(n)` auxiliary space for the merge buffer. It is stable, and it parallelises and externalises well, so it is the algorithm of choice for sorting data too large for memory and for sorting linked lists, where it needs only `O(log n)` extra space because splicing replaces copying.

## Quicksort

Quicksort also divides, but it partitions first and does no work on the way back up. Choose a pivot, rearrange so that everything smaller sits left of it and everything larger sits right, then recurse on both sides.

Partitioning is `O(n)` and the recursion depth is `O(log n)` when pivots split evenly, giving `O(n log n)` expected time with only `O(log n)` stack space. Because it sorts in place with very good cache behaviour, quicksort usually beats merge sort in wall-clock time despite identical asymptotics.

Its weakness is pivot choice. If the pivot is always the smallest or largest element — which happens with a naive first-element pivot on already-sorted input — the partitions are maximally lopsided and it degrades to `O(n^2)`. Practical fixes are choosing a random pivot, or taking the median of the first, middle and last elements. Standard quicksort is not stable.

## Heap sort

Build a max-heap in `O(n)`, then repeatedly swap the root to the end of the array and sift down over the shrinking heap. Guaranteed `O(n log n)` with `O(1)` auxiliary space, and no worst-case blow-up. It is not stable, and its scattered memory access makes it slower in practice than quicksort, so it is chosen when worst-case guarantees and in-place operation both matter.

## Stability, and why it matters

A sort is **stable** if elements comparing equal keep their original relative order. This is what lets you sort by multiple keys in stages: sort by name first, then by department, and within each department the names remain alphabetical. With an unstable sort the first pass is destroyed.

| Algorithm | Best | Average | Worst | Space | Stable |
|---|---|---|---|---|---|
| Bubble | `O(n)` | `O(n^2)` | `O(n^2)` | `O(1)` | Yes |
| Selection | `O(n^2)` | `O(n^2)` | `O(n^2)` | `O(1)` | No |
| Insertion | `O(n)` | `O(n^2)` | `O(n^2)` | `O(1)` | Yes |
| Merge | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(n)` | Yes |
| Quicksort | `O(n log n)` | `O(n log n)` | `O(n^2)` | `O(log n)` | No |
| Heap | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(1)` | No |
| Counting | `O(n + k)` | `O(n + k)` | `O(n + k)` | `O(k)` | Yes |

## Non-comparison sorts

**Counting sort** counts occurrences of each key in an array indexed by the key itself, then reconstructs the output. It runs in `O(n + k)` where `k` is the key range, so it is excellent for small integer ranges such as ages or exam scores, and useless for large or floating-point ranges since `k` dominates.

**Radix sort** applies a stable sort digit by digit, usually least-significant first, achieving `O(d * (n + k))` for `d` digits. Its stability requirement is why counting sort is its usual inner loop.

## What real libraries use

Python's `sorted` and `list.sort` use **Timsort**, a hybrid that finds existing sorted runs in the data, extends short runs with insertion sort, then merges them. It is stable and `O(n)` on already-sorted or reverse-sorted input, which is extremely common in practice. Java uses Timsort for objects and a dual-pivot quicksort for primitives, where stability is meaningless because equal primitives are indistinguishable. C++ `std::sort` typically uses introsort, a quicksort that detects excessive recursion depth and falls back to heap sort to protect the worst case.

The practical lesson: use your language's built-in sort. It is better tuned than anything you will write by hand, and the reason to learn these algorithms is to understand the trade-offs and to answer interview questions, not to reimplement them in production.
