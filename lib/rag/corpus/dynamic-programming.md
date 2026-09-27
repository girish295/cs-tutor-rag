---
id: dynamic-programming
title: Dynamic Programming
topic: Algorithms
tags: [dynamic-programming, memoisation, tabulation, knapsack, lcs, optimal-substructure]
difficulty: advanced
---

## When dynamic programming applies

Dynamic programming solves problems that have two properties together:

**Overlapping subproblems** — the same subproblem is encountered many times, so caching its answer pays off. This is what separates DP from divide and conquer, whose subproblems are disjoint.

**Optimal substructure** — an optimal solution to the whole is built from optimal solutions to its parts. This is what lets you combine subresults without reconsidering them, and it is why greedy algorithms sometimes suffice and sometimes do not.

If either property is missing, DP is the wrong tool. Both present, and a problem that looks exponential usually collapses to polynomial.

## Memoisation versus tabulation

**Memoisation** is top-down: write the natural recursion, then cache results keyed by the arguments. It only ever computes subproblems that are actually reachable, and it keeps the recursive structure readable. The cost is call-stack depth and function-call overhead.

**Tabulation** is bottom-up: identify the order in which subproblems depend on each other, then fill a table iteratively from the base cases upwards. No recursion and no stack limit, usually faster, and it opens the door to space optimisation — but you must work out the correct fill order yourself.

```python
# Memoisation: top-down
from functools import lru_cache

@lru_cache(maxsize=None)
def climb(n):
    if n <= 2:
        return n
    return climb(n - 1) + climb(n - 2)

# Tabulation: bottom-up
def climb_table(n):
    if n <= 2:
        return n
    dp = [0] * (n + 1)
    dp[1], dp[2] = 1, 2
    for i in range(3, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]

# Tabulation with rolling variables: O(1) space
def climb_optimised(n):
    a, b = 1, 2
    for _ in range(3, n + 1):
        a, b = b, a + b
    return b if n > 1 else 1
```

That third version illustrates the standard final step: when `dp[i]` depends only on the previous one or two entries, you can discard the table and keep `O(1)` space.

## A recipe that works

1. **Define the state.** What do the parameters of your subproblem mean? Write it in words: "`dp[i]` is the maximum value using the first `i` items." Vague state definitions are the root cause of most failed DP attempts.
2. **Write the recurrence.** How does a state relate to smaller states? This usually comes from enumerating the choices available at that state.
3. **Identify base cases.** The smallest states, answered directly.
4. **Determine the evaluation order.** For tabulation, every state's dependencies must be computed before it.
5. **Optimise space** if only recent rows are needed.

Getting step 1 right makes steps 2 and 3 straightforward. Rushing step 1 makes them impossible.

## 0/1 knapsack

Given items with weights and values and a capacity, maximise total value without exceeding capacity. Each item is taken whole or not at all.

State: `dp[i][w]` is the best value achievable using the first `i` items with capacity `w`. At each item there are two choices — skip it, or take it if it fits.

```python
def knapsack(weights, values, capacity):
    n = len(weights)
    dp = [[0] * (capacity + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for w in range(capacity + 1):
            dp[i][w] = dp[i - 1][w]                       # skip item i
            if weights[i - 1] <= w:                       # or take it
                take = dp[i - 1][w - weights[i - 1]] + values[i - 1]
                dp[i][w] = max(dp[i][w], take)
    return dp[n][capacity]
```

This runs in `O(n * capacity)` time and space. Note that this is **pseudo-polynomial**, not polynomial: the cost scales with the numeric value of the capacity, not with the number of bits needed to write it, which is why knapsack remains NP-hard despite this algorithm.

Because row `i` reads only row `i - 1`, space reduces to `O(capacity)` with a single array iterated **backwards** over `w`. Iterating forwards would let one item be reused, which silently turns 0/1 knapsack into the unbounded variant.

## Longest common subsequence

The basis of diff tools and a standard measure of sequence similarity. A subsequence keeps relative order but need not be contiguous.

State: `dp[i][j]` is the LCS length of the first `i` characters of `a` and first `j` of `b`. If the current characters match, extend the diagonal; otherwise take the better of dropping one character from either string.

```python
def lcs(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[len(a)][len(b)]
```

`O(n * m)` in time and space. Edit distance, also called Levenshtein distance, follows the same two-dimensional shape with three choices — insert, delete, substitute — instead of two.

## Recognising DP problems

Strong signals: the problem asks for a maximum, minimum, or a count of ways; the natural recursion recomputes the same arguments; there is a sequence of choices where each affects what remains; and greedy gives an answer that is *nearly* right but fails on some case.

Common families worth knowing by shape are linear sequence DP such as house robber and longest increasing subsequence, grid DP such as unique paths and minimum path sum, interval DP such as matrix chain multiplication, subset DP such as knapsack and partition, and string DP such as LCS and edit distance.

## Greedy versus DP

A greedy algorithm takes the locally best choice and never reconsiders. It is faster and simpler, and it is correct only when the problem has the *greedy-choice property*. Coin change with denominations 1, 5, 10, 25 works greedily; with 1, 3, 4 it does not — making 6 greedily gives 4+1+1 for three coins, while the optimum is 3+3 for two. When you cannot prove the greedy choice is safe, use DP.
