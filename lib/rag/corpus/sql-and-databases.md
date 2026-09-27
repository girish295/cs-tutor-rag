---
id: sql-and-databases
title: SQL, Relational Databases and Indexes
topic: Databases
tags: [sql, join, index, normalisation, transaction, acid, query]
difficulty: intermediate
---

## Relational basics

A relational database stores data in **tables** of rows and columns. Each table has a **primary key** uniquely identifying each row, and may have **foreign keys** referencing primary keys in other tables. Those references are what make the data relational, and the database enforces them: a foreign key constraint prevents a row from referring to something that does not exist.

SQL is **declarative** — you describe the result you want, and the query planner decides how to compute it. This is why two queries that look different can perform identically, and why two that look similar can differ by orders of magnitude.

## Clause evaluation order

SQL is written in one order and evaluated in another, which explains several otherwise baffling errors.

Written: `SELECT ... FROM ... WHERE ... GROUP BY ... HAVING ... ORDER BY ... LIMIT`

Evaluated: `FROM` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `ORDER BY` → `LIMIT`

Because `SELECT` runs after `WHERE` and `GROUP BY`, a column alias defined in `SELECT` cannot be used in `WHERE` — but it *can* be used in `ORDER BY`, which runs later. And because `WHERE` runs before grouping while `HAVING` runs after, `WHERE` filters individual rows and `HAVING` filters groups. Putting an aggregate in `WHERE` is an error; putting it in `HAVING` is correct.

```sql
SELECT department, COUNT(*) AS headcount
FROM employees
WHERE active = TRUE          -- filters rows, before grouping
GROUP BY department
HAVING COUNT(*) > 5          -- filters groups, after grouping
ORDER BY headcount DESC      -- alias is available here
LIMIT 10;
```

## Joins

A join combines rows from two tables on a matching condition. The type determines what happens to rows with no match.

- `INNER JOIN` — only rows matching in both tables.
- `LEFT JOIN` — all rows from the left table; unmatched right columns become `NULL`.
- `RIGHT JOIN` — the mirror image.
- `FULL OUTER JOIN` — all rows from both, `NULL`-filled where unmatched.
- `CROSS JOIN` — every combination, the Cartesian product.

```sql
SELECT c.name, o.total
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;   -- keeps customers with no orders
```

A `LEFT JOIN` with a `WHERE` condition on the right table silently becomes an inner join, because `WHERE` discards the `NULL` rows the join just produced. To filter the right table while keeping unmatched left rows, put the condition in the `ON` clause instead. This is one of the most common SQL bugs in production code.

Finding rows with *no* match is the deliberate use of that behaviour:

```sql
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;           -- customers who never ordered
```

## NULL is not a value

`NULL` means unknown, and comparisons with it yield unknown rather than true or false. So `WHERE column = NULL` never matches anything — you must write `IS NULL` or `IS NOT NULL`.

Aggregates ignore `NULL`, which is why `COUNT(*)` counts rows while `COUNT(column)` counts non-null values in that column, and why `AVG` divides by the count of non-null entries rather than by the row count. `NOT IN` against a subquery containing a `NULL` returns no rows at all, which is a subtle and much-cursed trap.

## Indexes

An index is a separate structure, usually a **B-tree**, that lets the database find rows without scanning the whole table. It converts an `O(n)` table scan into roughly `O(log n)` lookups, which is the difference between a query taking seconds and milliseconds.

```sql
CREATE INDEX idx_orders_customer ON orders(customer_id);
```

Index columns that appear in `WHERE` clauses, join conditions and `ORDER BY`. Primary keys are indexed automatically.

Indexes are not free. Each one consumes storage and must be updated on every `INSERT`, `UPDATE` and `DELETE`, so over-indexing slows down writes. They also help little on very small tables or on low-cardinality columns such as a boolean flag, where a scan is comparable anyway.

A **composite index** on `(a, b)` can serve queries filtering on `a`, or on `a` and `b` together, but generally not on `b` alone — the leftmost-prefix rule. Column order therefore matters a great deal.

The commonest way to accidentally disable an index is to wrap the column in a function or apply a leading wildcard:

```sql
WHERE YEAR(created_at) = 2026     -- cannot use an index on created_at
WHERE created_at >= '2026-01-01'  -- can
WHERE name LIKE '%smith'          -- leading wildcard, cannot use an index
```

Use `EXPLAIN` or `EXPLAIN ANALYZE` to see what the planner actually chose rather than guessing.

## Normalisation

Normalisation organises tables to eliminate redundancy, so each fact is stored in exactly one place.

**1NF** requires atomic column values — no comma-separated lists in a field. **2NF** additionally requires every non-key column to depend on the whole primary key. **3NF** further requires that no non-key column depends on another non-key column; such a transitive dependency belongs in its own table.

Normalisation prevents update anomalies, where the same fact stored in several rows drifts out of sync. The cost is more joins. **Denormalisation** deliberately reintroduces redundancy to avoid those joins in read-heavy systems, accepting the consistency burden in exchange for speed. Analytics warehouses are routinely denormalised for this reason.

## Transactions and ACID

A transaction groups statements so they succeed or fail as a unit.

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;                       -- or ROLLBACK to abandon both
```

**Atomicity** — all statements apply or none do. **Consistency** — constraints hold before and after. **Isolation** — concurrent transactions do not observe each other's partial work. **Durability** — once committed, the change survives a crash.

Isolation is the one with dials. Weaker levels permit specific anomalies in exchange for concurrency: *dirty reads* see uncommitted data, *non-repeatable reads* see a row change between two reads in the same transaction, and *phantom reads* see new rows appear in a repeated range query. `READ COMMITTED` is the common default; `SERIALIZABLE` forbids all three at the highest cost.

## N+1 queries

The most frequent application-level performance bug: fetching a list, then issuing one query per item in a loop.

```python
orders = db.query("SELECT * FROM orders")          # 1 query
for order in orders:
    customer = db.query(                            # N more queries
        "SELECT * FROM customers WHERE id = ?", order.customer_id)
```

Replace it with a single join, or fetch all the needed customers in one `WHERE id IN (...)` query. ORMs cause this constantly through lazy loading, and most provide an eager-loading option to fix it.
