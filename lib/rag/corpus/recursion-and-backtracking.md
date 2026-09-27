---
id: recursion-and-backtracking
title: Recursion and Backtracking
topic: Algorithms
tags: [recursion, base-case, backtracking, stack, divide-and-conquer, tail-call]
difficulty: intermediate
---

## Anatomy of a recursive function

A recursive function solves a problem by calling itself on a smaller version of the same problem. Every correct recursion has two parts:

1. A **base case** that returns directly without recursing.
2. A **recursive case** that makes progress towards the base case.

Omitting the base case, or writing a recursive case that fails to shrink the input, produces infinite recursion and a stack overflow. Those are the only two ways recursion goes structurally wrong, so check both whenever a recursive function misbehaves.

```python
def factorial(n):
    if n <= 1:          # base case
        return 1
    return n * factorial(n - 1)   # recursive case, n shrinks
```

## The call stack

Each call allocates a stack frame holding its parameters, locals and return address. Frames accumulate until a base case returns, then unwind. This is why recursion depth `d` costs `O(d)` space even when the function allocates nothing.

Python caps recursion at around 1000 frames by default and raises `RecursionError` rather than crashing. That limit is a deliberate guard, and raising it with `sys.setrecursionlimit` usually indicates the algorithm should be iterative instead.

Any recursion can be rewritten iteratively with an explicit stack, because that is exactly what the call stack is. Some languages implement **tail-call optimisation**, reusing the frame when the recursive call is the last operation — but CPython and JavaScript engines in practice do not, so in Python and JS deep recursion is a real constraint rather than a stylistic choice.

## Trusting the recursion

The productive mental model is to assume the recursive call already works, then ask only what to do with its result. Trying to trace every level in your head does not scale past two or three frames.

```python
def tree_height(node):
    if node is None:
        return 0
    # assume these return correct heights
    return 1 + max(tree_height(node.left), tree_height(node.right))
```

Three questions cover almost every case: what is the smallest input, what does the call return for a subproblem, and how do I combine those results.

## When naive recursion is catastrophic

Recursion that recomputes overlapping subproblems explodes exponentially.

```python
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)   # O(2^n)
```

`fib(30)` makes over 1.6 million calls, most of them recomputing identical values. Adding **memoisation** — caching results by input — collapses it to `O(n)`, because each distinct subproblem is solved once.

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)   # now O(n)
```

That single decorator is the bridge from recursion to dynamic programming.

## Divide and conquer

Divide and conquer splits input into independent subproblems, solves each recursively, and combines the results. Merge sort, quicksort and binary search are all instances.

Subproblem independence is the distinguishing feature. Because the halves in merge sort do not overlap, no memoisation is needed — which is precisely why divide and conquer and dynamic programming are different techniques rather than the same one.

The **Master Theorem** gives the complexity of `T(n) = a * T(n / b) + f(n)`. For merge sort, two subproblems of half the size plus `O(n)` merging gives `O(n log n)`. For binary search, one subproblem of half the size plus `O(1)` work gives `O(log n)`.

## Backtracking

Backtracking explores a tree of partial solutions by building a candidate incrementally, abandoning a branch as soon as it cannot lead to a valid answer, and **undoing** the last choice before trying the next.

The universal shape is choose, explore, un-choose:

```python
def permutations(items):
    results, current, used = [], [], [False] * len(items)

    def backtrack():
        if len(current) == len(items):
            results.append(current[:])      # copy, not the live list
            return
        for i, item in enumerate(items):
            if used[i]:
                continue
            used[i] = True; current.append(item)    # choose
            backtrack()                             # explore
            current.pop(); used[i] = False          # un-choose
    backtrack()
    return results
```

Two details cause most backtracking bugs. The un-choose step must exactly reverse the choose step, or state leaks into sibling branches. And you must append a *copy* of the working list, since the list itself keeps mutating — `results.append(current)` stores references that all end up empty.

Backtracking underlies N-Queens, sudoku solvers, subset and combination generation, word search on a grid, and graph colouring.

## Pruning is what makes it usable

Unpruned backtracking is brute force with tidy structure. The performance comes from rejecting invalid branches early — for N-Queens, checking column and diagonal conflicts before recursing cuts an intractable search to a fast one. This is the same idea as constraint propagation in a sudoku solver.

Worst-case complexity stays exponential, typically `O(n!)` for permutation problems or `O(2^n)` for subset problems, because the solution space genuinely is that large. Pruning reduces the constant and the practical runtime, not the asymptotic bound.
