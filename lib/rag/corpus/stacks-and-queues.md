---
id: stacks-and-queues
title: Stacks, Queues, Deques and Heaps
topic: Data Structures
tags: [stack, queue, deque, heap, priority-queue, lifo, fifo]
difficulty: beginner
---

## Stacks are LIFO

A stack allows access only at one end. The last item pushed is the first item popped, which is why it is called last-in-first-out. The operations are `push`, `pop`, `peek` to inspect the top without removing it, and `isEmpty`. All are `O(1)`.

```python
stack = []
stack.append(1)     # push
stack.append(2)
top = stack[-1]     # peek -> 2
value = stack.pop() # pop  -> 2
```

Stacks show up wherever you need to remember "what was I doing before this". The call stack itself is a stack of activation records, which is exactly why infinite recursion produces a stack overflow. Undo history, browser back buttons, expression evaluation, and the iterative version of any recursive algorithm all use stacks.

Balanced-bracket checking is the canonical example: push every opening bracket, and on each closing bracket pop and confirm it matches.

```python
def balanced(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in "([{":
            stack.append(ch)
        elif ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
    return not stack     # leftover openers mean unbalanced
```

## Queues are FIFO

A queue adds at the back and removes from the front, so the first item in is the first out. The operations are `enqueue`, `dequeue`, `peek` and `isEmpty`.

The implementation detail matters here. Using a plain dynamic array and removing from index 0 makes `dequeue` `O(n)`, because every remaining element shifts left. Correct implementations use either a linked list with head and tail pointers, or a **circular buffer** — a fixed array with head and tail indices that wrap around using modulo. Both give `O(1)` on both ends.

```python
from collections import deque
q = deque()
q.append(1)        # enqueue at back
q.append(2)
first = q.popleft()  # dequeue from front, O(1)
```

In Python, always reach for `collections.deque` rather than a list when you need a queue. `list.pop(0)` is the single most common accidental `O(n)` in beginner Python.

Queues model fair, order-preserving processing: task and job queues, print spoolers, request buffers, and breadth-first search.

## Deques

A double-ended queue supports insertion and removal at both ends in `O(1)`. It generalises both a stack and a queue, so one structure covers both patterns. Implementations typically use a doubly linked list of array chunks, which keeps end operations cheap while retaining reasonable cache locality.

A deque is the right structure for a sliding-window maximum, where you push indices at the back and pop stale ones from the front, giving `O(n)` total instead of `O(n * k)`.

## Heaps and priority queues

A priority queue returns the highest-priority element rather than the oldest or newest. The standard implementation is a **binary heap**, a complete binary tree stored compactly in an array.

The heap property is local: in a min-heap every parent is less than or equal to both children. Note carefully that this does *not* make the array sorted — it only guarantees that the minimum sits at the root, at index 0.

Because the tree is complete, the array layout needs no pointers:

```
parent(i) = (i - 1) // 2
left(i)   = 2 * i + 1
right(i)  = 2 * i + 2
```

Insertion appends to the end and then "sifts up", swapping with the parent while the heap property is violated. Extracting the minimum takes the root, moves the last element into its place, and "sifts down". Both walk one path of a tree of height `log n`.

| Operation | Complexity |
|---|---|
| Peek minimum | `O(1)` |
| Insert | `O(log n)` |
| Extract minimum | `O(log n)` |
| Build heap from `n` items | `O(n)` |
| Search for an arbitrary value | `O(n)` |

Building a heap from an existing array is `O(n)`, not `O(n log n)`, which surprises people. Sifting down from the bottom up does most of its work on shallow subtrees, and the sum converges to linear.

```python
import heapq
h = [5, 1, 8]
heapq.heapify(h)         # O(n)
heapq.heappush(h, 3)     # O(log n)
smallest = heapq.heappop(h)  # O(log n) -> 1
```

Python's `heapq` is a min-heap only. For a max-heap, push negated values and negate again on the way out.

Priority queues are the engine inside Dijkstra's shortest-path algorithm, A* search, Huffman coding, event-driven simulation and OS task scheduling.
