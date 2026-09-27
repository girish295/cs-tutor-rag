---
id: trees-and-binary-search-trees
title: Trees, Binary Search Trees and Balancing
topic: Data Structures
tags: [tree, binary-tree, bst, traversal, avl, red-black, balancing]
difficulty: intermediate
---

## Tree terminology

A tree is a hierarchical structure of nodes with exactly one root and no cycles. Each node has zero or more children and, apart from the root, exactly one parent. Nodes with no children are leaves.

The **depth** of a node is its distance from the root; the root has depth 0. The **height** of a tree is the depth of its deepest node. Height is the number that governs complexity, because most tree operations walk a single root-to-leaf path.

A **binary tree** limits each node to at most two children, conventionally `left` and `right`. A binary tree is *complete* when every level is full except possibly the last, which fills left to right — that is the shape a binary heap maintains. It is *balanced* when the left and right subtree heights differ by at most a small constant at every node.

The critical fact: a balanced binary tree of `n` nodes has height `O(log n)`, while a degenerate one has height `O(n)`.

## Binary search trees

A binary search tree adds an ordering invariant: for every node, all keys in the left subtree are smaller, and all keys in the right subtree are larger. This must hold for the entire subtree, not merely the immediate children — a very common source of bugs when validating a BST.

The invariant makes search a sequence of binary decisions:

```python
def search(node, key):
    while node is not None:
        if key == node.key:
            return node
        node = node.left if key < node.key else node.right
    return None
```

Each comparison discards one whole subtree, so search costs `O(height)`. Insertion follows the same path and attaches a new leaf where the search fell off the tree.

Deletion has three cases. A leaf is simply removed. A node with one child is replaced by that child. A node with two children is replaced by its **in-order successor** — the smallest key in its right subtree — which is then deleted from that subtree. Getting this third case right is the hard part of implementing a BST.

## Traversals

Depth-first traversals differ only in when the node is visited relative to its children.

- **In-order** (left, node, right) visits a BST's keys in **sorted order**. This is the property that makes BSTs useful for ordered data.
- **Pre-order** (node, left, right) visits parents before children, which suits copying a tree or serialising its structure.
- **Post-order** (left, right, node) visits children before parents, which suits freeing memory or computing sizes bottom-up.

```python
def in_order(node, out):
    if node is None:
        return
    in_order(node.left, out)
    out.append(node.key)
    in_order(node.right, out)
```

**Level-order**, also called breadth-first, visits nodes level by level using a queue rather than recursion. It is the traversal to reach for when you care about depth, such as finding the shortest path in an unweighted tree or printing the tree by rows.

All four traversals are `O(n)` in time, since each node is visited once. Depth-first uses `O(height)` stack space; level-order uses `O(width)` queue space, which can be `O(n)` for the bottom level of a wide tree.

## Why balancing matters

A BST's complexity depends entirely on its height, and its height depends on insertion order. Insert `1, 2, 3, 4, 5` into a plain BST and every node becomes the right child of the previous one. You have built a linked list with extra pointers, and every operation is `O(n)`. Sorted or nearly-sorted input is common in the real world, so this is a practical hazard rather than a curiosity.

| Tree state | Height | Search, insert, delete |
|---|---|---|
| Balanced | `O(log n)` | `O(log n)` |
| Degenerate | `O(n)` | `O(n)` |

**Self-balancing trees** fix this by restructuring during insertion and deletion, using local rotations that preserve the BST invariant while reducing height.

An **AVL tree** keeps the height difference between siblings' subtrees to at most 1, stored as a balance factor per node. It is rigidly balanced, so lookups are fast, at the cost of more rotations on write.

A **red-black tree** colours nodes red or black and enforces rules that bound the height at roughly twice the minimum. It is more loosely balanced than AVL, so it does fewer rotations on write and slightly more work on read. This trade-off is why red-black trees back Java's `TreeMap`, C++ `std::map` and most OS kernel schedulers.

A **B-tree** allows many keys and children per node, keeping the tree extremely shallow. That minimises disk or page reads, which is why B-trees and B+ trees are the standard index structure in databases and filesystems.

## Choosing between a BST and a hash table

Use a hash table when you only need key lookup, and want `O(1)` average. Use a balanced BST when you need keys kept in order: finding the minimum or maximum, iterating in sorted order, range queries such as "all keys between 10 and 50", or finding the nearest key to a target. A hash table answers none of those without scanning everything.
