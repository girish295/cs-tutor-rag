---
id: linked-lists
title: Linked Lists
topic: Data Structures
tags: [linked-list, pointers, nodes, cycle-detection, floyd]
difficulty: beginner
---

## Structure

A linked list stores each element in its own node, and each node holds a reference to the next one. Unlike an array, the nodes are scattered anywhere in memory and connected only by these references.

```python
class Node:
    def __init__(self, value):
        self.value = value
        self.next = None
```

A singly linked list gives each node one pointer, to the next node. A doubly linked list adds a `prev` pointer, allowing backwards traversal and `O(1)` deletion when you already hold the node. A circular list has its last node point back to the head instead of to null.

The list itself is usually represented by a reference to its head. The final node's `next` is null, which is how traversal knows to stop.

## Why the trade-offs differ from arrays

Linked lists buy cheap insertion and deletion at the cost of losing random access.

| Operation | Array | Linked list |
|---|---|---|
| Access element `i` | `O(1)` | `O(n)` — must walk from head |
| Insert at front | `O(n)` | `O(1)` |
| Insert at end | `O(1)` amortised | `O(n)`, or `O(1)` with a tail pointer |
| Insert after a known node | `O(n)` | `O(1)` |
| Delete a known node | `O(n)` | `O(1)` if doubly linked |
| Memory per element | Just the value | Value plus one or two pointers |
| Cache locality | Excellent | Poor |

That last row matters more than people expect. Because nodes are scattered, each traversal step is likely a cache miss, so a linked list traversal can be several times slower than an array scan of the same length despite both being `O(n)`. In practice this means arrays and dynamic arrays are the right default, and linked lists earn their place when you are splicing nodes in and out of the middle of a sequence you already have references into.

## Traversal and the sentinel trick

```python
def print_all(head):
    current = head
    while current is not None:
        print(current.value)
        current = current.next
```

Insertion and deletion at the head are special cases, because there is no previous node to update. A dummy head, also called a sentinel, eliminates that branch entirely and removes a whole class of bugs:

```python
def remove_all(head, target):
    dummy = Node(None)
    dummy.next = head
    current = dummy
    while current.next is not None:
        if current.next.value == target:
            current.next = current.next.next   # splice it out
        else:
            current = current.next
    return dummy.next    # the real head, which may have changed
```

Without the dummy you need separate logic for the case where the head itself matches. With it, every node is handled uniformly.

## Reversing a linked list

This is the single most common linked list interview question. The trick is to keep three pointers and re-point each `next` as you pass.

```python
def reverse(head):
    prev = None
    current = head
    while current is not None:
        next_node = current.next   # save before overwriting
        current.next = prev        # flip the pointer
        prev = current             # advance both
        current = next_node
    return prev                    # prev is the new head
```

It runs in `O(n)` time and `O(1)` space. Saving `next_node` before overwriting `current.next` is essential — without it you lose the rest of the list.

## Floyd's cycle detection

A corrupted or circular list will make naive traversal loop forever. Floyd's tortoise-and-hare algorithm detects a cycle in `O(n)` time and `O(1)` space by moving one pointer one step at a time and another two steps at a time. If there is a cycle the fast pointer eventually laps the slow one and they meet; if there is not, the fast pointer reaches null.

```python
def has_cycle(head):
    slow = fast = head
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False
```

The same two-speed idea finds the middle of a list in a single pass: when `fast` reaches the end, `slow` is at the midpoint. That is the standard way to split a list for merge sort.

## Where linked lists are actually used

Despite losing most head-to-head comparisons with arrays, linked lists appear throughout real systems. LRU caches pair a hash map with a doubly linked list so that both lookup and recency-reordering are `O(1)`. Hash tables use linked lists for separate chaining on collisions. Operating system schedulers and free-memory allocators thread linked lists through blocks they already hold pointers to. Many language runtimes implement a deque as a linked list of array chunks, getting both cheap end operations and decent locality.
