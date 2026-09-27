---
id: big-o-complexity
title: Big-O Notation and Algorithmic Complexity
topic: Algorithms
tags: [complexity, big-o, analysis, time, space, amortised]
difficulty: beginner
---

## What Big-O actually measures

Big-O notation describes how the cost of an algorithm grows as the input size `n` grows. It deliberately ignores constant factors and lower-order terms, because those are dwarfed by growth rate once `n` gets large. An algorithm that takes `3n + 100` steps and one that takes `n` steps are both `O(n)`: they scale the same way.

Big-O is an *upper bound* on growth. Two companion notations complete the picture: Omega is a lower bound, and Theta is a tight bound, meaning the upper and lower bounds match. In everyday engineering conversation people say "Big-O" when they usually mean Theta, and that is normally harmless.

## The common complexity classes

Ordered from best to worst as `n` grows:

- `O(1)` — constant. Array index lookup, hash table access on average, pushing onto a stack.
- `O(log n)` — logarithmic. Binary search, balanced tree insert and lookup. Doubling `n` adds one extra step.
- `O(n)` — linear. Scanning a list once, finding a maximum, counting elements.
- `O(n log n)` — linearithmic. Merge sort, heap sort, and the practical lower bound for comparison sorting.
- `O(n^2)` — quadratic. Nested loops over the same collection: bubble sort, insertion sort, comparing all pairs.
- `O(2^n)` — exponential. Naive recursive Fibonacci, generating all subsets.
- `O(n!)` — factorial. Generating all permutations, brute-force travelling salesman.

The gap between these is enormous in practice. For one million elements, an `O(n)` algorithm does a million operations while `O(n^2)` does a trillion — the difference between milliseconds and weeks.

## Time complexity versus space complexity

Time complexity counts operations. Space complexity counts extra memory beyond the input itself, which is called auxiliary space. These frequently trade off against each other. Merge sort runs in `O(n log n)` time but needs `O(n)` auxiliary space for merging. Quicksort runs in `O(n log n)` expected time with only `O(log n)` auxiliary space for the recursion stack, which is one reason it is often faster in practice despite a worse worst case.

Recursion always costs stack space. A recursive function that goes `n` levels deep uses `O(n)` space even if it allocates nothing itself.

## Best, average and worst case

These are separate questions from Big-O versus Theta, and mixing them up is a classic source of confusion.

- Quicksort: best and average `O(n log n)`, worst `O(n^2)` when the pivot is always the smallest or largest element.
- Hash table lookup: average `O(1)`, worst `O(n)` when every key collides into one bucket.
- Insertion sort: best `O(n)` on already-sorted input, average and worst `O(n^2)`.

Interviewers usually want worst case unless they say otherwise, but they will often ask about average case for hash tables and quicksort specifically.

## How to analyse a loop nest

Work from the inside out and multiply.

```python
for i in range(n):            # runs n times
    for j in range(n):        # runs n times per i
        total += grid[i][j]   # O(1)
```

That is `n` times `n` times `O(1)`, which is `O(n^2)`.

Sequential blocks add rather than multiply, and the larger term wins:

```python
for x in items:   # O(n)
    process(x)
items.sort()      # O(n log n)
```

Adding `O(n)` and `O(n log n)` gives `O(n log n)`.

Watch for loops whose counter grows multiplicatively — those are logarithmic, not linear:

```python
i = 1
while i < n:
    i *= 2        # O(log n) iterations, not O(n)
```

## Amortised analysis

Some operations are usually cheap but occasionally expensive, and amortised analysis averages the cost over a long sequence. Appending to a dynamic array such as a Python list or a JavaScript array is the classic example. Most appends are `O(1)`, but when the backing buffer fills the array must allocate a bigger one and copy everything, which is `O(n)`. Because the capacity doubles each time, those expensive copies are rare enough that the amortised cost per append is `O(1)`.

This is why "append is O(1)" and "append is sometimes O(n)" are both true statements about the same operation.

## Common mistakes to avoid

Dropping constants is correct for asymptotic analysis but misleading for real performance. An `O(n)` algorithm with a huge constant can lose to an `O(n log n)` one at realistic input sizes, which is exactly why library sort functions switch to insertion sort for small subarrays.

Another frequent error is assuming a nested loop is automatically `O(n^2)`. If the inner loop runs a fixed number of times, or if its total work across all outer iterations is bounded by `n`, the result can be `O(n)`. The two-pointer technique is `O(n)` despite having a loop inside a loop, because each pointer only ever moves forward.
