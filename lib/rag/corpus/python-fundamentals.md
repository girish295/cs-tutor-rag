---
id: python-fundamentals
title: Python Fundamentals and Common Pitfalls
topic: Programming Languages
tags: [python, mutability, comprehension, generator, scope, gotchas]
difficulty: beginner
---

## Names, objects and references

A Python variable is a **name bound to an object**, not a box containing a value. Assignment rebinds the name; it never copies the object. This single fact explains most Python surprises.

```python
a = [1, 2, 3]
b = a           # b and a name the SAME list
b.append(4)
print(a)        # [1, 2, 3, 4] — a changed too
```

To get an independent copy use `b = a.copy()` or `b = a[:]` for a shallow copy, or `copy.deepcopy(a)` when the container holds nested mutable objects. A shallow copy duplicates the outer container but still shares the inner objects.

## Mutable versus immutable types

Immutable: `int`, `float`, `str`, `tuple`, `bool`, `frozenset`. Mutable: `list`, `dict`, `set`, and most custom class instances.

Only immutable objects are safe as dictionary keys or set members, because a hash must stay stable for the lifetime of the entry. This is why `dict[("a", 1)]` works and `dict[["a", 1]]` raises `TypeError`.

## The mutable default argument trap

Default argument values are evaluated **once**, when the function is defined — not on each call. A mutable default is therefore shared across every call.

```python
def add_item(item, basket=[]):      # BUG
    basket.append(item)
    return basket

add_item("apple")     # ['apple']
add_item("banana")    # ['apple', 'banana'] — the same list!
```

The fix is to default to `None` and create the container inside the function:

```python
def add_item(item, basket=None):
    if basket is None:
        basket = []
    basket.append(item)
    return basket
```

This is the most frequently encountered Python bug that beginners do not recognise as a bug.

## Comprehensions

Comprehensions build a collection in one expression, and they are both more readable and faster than an equivalent append loop, because the interpreter avoids repeated method lookups.

```python
squares = [x * x for x in range(10)]
evens = [x for x in range(20) if x % 2 == 0]
lookup = {word: len(word) for word in words}
unique_lengths = {len(w) for w in words}
pairs = [(x, y) for x in range(3) for y in range(3) if x != y]
```

In a multi-clause comprehension the `for` clauses read left to right in the same order you would nest them in a loop.

Prefer a regular loop when the body needs multiple statements or when the comprehension stops being readable. Deeply nested comprehensions are a common readability failure.

## Generators and laziness

A generator produces values on demand instead of building a list in memory. Replace the brackets with parentheses, or use `yield` in a function.

```python
squares = (x * x for x in range(1_000_000))   # no list allocated
total = sum(squares)                           # consumed lazily

def read_lines(path):
    with open(path) as f:
        for line in f:
            yield line.strip()                 # one line in memory at a time
```

Generators use `O(1)` memory rather than `O(n)`, which makes them the right tool for large files and infinite sequences. The trade-off is that they can be iterated only once and do not support indexing or `len()`.

## Truthiness

Empty containers, zero, empty strings and `None` are all falsy. Idiomatic Python tests them directly:

```python
if items:           # preferred over len(items) > 0
if not name:        # catches "" and None
```

Be careful when zero is a legitimate value. `if count:` is wrong if `count == 0` is meaningful — use `if count is not None:` instead. Similarly, always compare to `None` with `is`, not `==`, because `==` can be overridden by a class.

## Equality versus identity

`==` compares values; `is` compares whether two names point to the same object. Use `is` only for `None`, `True`, `False` and sentinel objects. Small integers and short strings are cached by CPython, so `is` sometimes appears to work on them by coincidence — relying on that produces bugs that vanish when the values change.

## Closures in loops

A closure captures the *variable*, not its value at creation time. All functions created in a loop therefore see the final value.

```python
funcs = [lambda: i for i in range(3)]
print([f() for f in funcs])       # [2, 2, 2], not [0, 1, 2]

funcs = [lambda i=i: i for i in range(3)]   # bind via default argument
print([f() for f in funcs])       # [0, 1, 2]
```

## Useful built-ins worth knowing

`enumerate` gives index and value together, replacing `range(len(x))`. `zip` iterates several sequences in parallel and stops at the shortest. `any` and `all` short-circuit over iterables. `sorted` accepts a `key` function and a `reverse` flag. `collections.defaultdict` and `collections.Counter` remove a great deal of boilerplate around counting and grouping.

```python
for i, name in enumerate(names, start=1):
    print(i, name)

from collections import Counter
most_common = Counter(words).most_common(3)
```

## Context managers

The `with` statement guarantees cleanup even if an exception is raised, which is why it is the correct way to handle files, locks and connections.

```python
with open("data.txt") as f:      # closed automatically
    content = f.read()
```

Forgetting `with` and relying on garbage collection to close files works in CPython by accident and fails on other interpreters.
