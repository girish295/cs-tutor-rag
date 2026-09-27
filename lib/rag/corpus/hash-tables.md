---
id: hash-tables
title: Hash Tables, Hash Maps and Sets
topic: Data Structures
tags: [hash-table, hash-map, dictionary, collision, load-factor, set]
difficulty: intermediate
---

## The core idea

A hash table stores key-value pairs in an array of buckets and uses a hash function to decide which bucket a key belongs to. The hash function turns a key of any type into an integer, and that integer modulo the bucket count gives the index.

```
index = hash(key) % number_of_buckets
```

Because computing the index is `O(1)` and indexing an array is `O(1)`, lookup, insertion and deletion are all `O(1)` on average. This is what makes hash tables the workhorse of practical programming: Python dictionaries, JavaScript objects and `Map`, Java `HashMap` and Go maps are all hash tables.

## What a good hash function does

A good hash function is fast, deterministic — the same key always produces the same hash — and distributes keys uniformly across buckets. Uniformity is what keeps the average case constant. A hash function that returns the same value for every key is technically valid but turns the table into a linked list.

Only immutable values make safe keys. If you mutate a key after inserting it, its hash changes and the entry becomes unreachable, because the table looks in the new bucket and finds nothing. This is why Python permits tuples as dictionary keys but rejects lists, and why you must never mutate an object you are using as a `Map` key.

## Collision resolution

Two different keys can hash to the same bucket. That is a collision, and it is unavoidable — the pigeonhole principle guarantees it once you have more keys than buckets. There are two main strategies.

**Separate chaining** stores a secondary structure, usually a linked list, in each bucket. Colliding entries append to that list. Lookup finds the bucket then scans the chain comparing keys for true equality. Simple, tolerates load factors above 1, but costs pointer overhead and loses cache locality.

**Open addressing** stores everything in the main array. On collision it probes for another slot. Linear probing checks the next slot, then the next; quadratic probing steps by growing squares; double hashing uses a second hash function for the step size. Open addressing is cache-friendly and compact, but it degrades badly as the table fills, and deletion is awkward because removing an entry can break the probe chain for others, so implementations mark slots with a tombstone instead.

Linear probing suffers from *clustering*: consecutive occupied slots merge into runs that grow and slow everything down. Quadratic probing and double hashing exist mainly to break up those clusters.

## Load factor and resizing

The load factor is the number of stored entries divided by the number of buckets. As it rises, collisions rise, and the average chain or probe length grows with it.

Implementations therefore resize once the load factor crosses a threshold — commonly 0.75 for chaining and lower, around 0.5, for open addressing. Resizing allocates a bigger bucket array, usually double, and **rehashes every existing key**, because the index depends on the bucket count. Rehashing is `O(n)`, which is why individual insertions are `O(1)` *amortised* rather than strictly `O(1)`.

## Complexity summary

| Operation | Average | Worst | Worst case cause |
|---|---|---|---|
| Insert | `O(1)` | `O(n)` | All keys collide, or a resize triggers |
| Lookup | `O(1)` | `O(n)` | All keys collide into one bucket |
| Delete | `O(1)` | `O(n)` | All keys collide into one bucket |
| Iterate all | `O(n)` | `O(n)` | — |

The `O(n)` worst case is real, not theoretical. Adversarial inputs crafted to collide were the basis of a well-known class of denial-of-service attacks, which is why modern runtimes seed their hash functions with a random per-process value.

## Hash sets

A hash set is a hash table that stores only keys, with no associated values. It gives `O(1)` membership testing, which is why converting a list to a set before doing repeated `in` checks is one of the highest-value optimisations available.

```python
# O(n * m) — scans the list for every lookup
if item in big_list:

# O(n) once, then O(1) per lookup
lookup = set(big_list)
if item in lookup:
```

## What hash tables cannot do

Hash tables have no ordering. Iterating gives you an arbitrary order, so you cannot ask for the smallest key, the largest key, or everything in a range without scanning all `n` entries. If you need ordered operations you want a balanced binary search tree or a skip list, which trade `O(1)` for `O(log n)` but keep keys sorted.

One nuance worth knowing: since Python 3.7, dictionaries preserve *insertion* order as a language guarantee. That is not sorted order, and it does not give you range queries — it only means iteration returns keys in the order they were added.
