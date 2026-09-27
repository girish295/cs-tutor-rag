---
id: graphs-and-traversals
title: Graphs, BFS, DFS and Shortest Paths
topic: Algorithms
tags: [graph, bfs, dfs, dijkstra, topological-sort, adjacency-list]
difficulty: intermediate
---

## Representing a graph

A graph is a set of vertices connected by edges. Edges may be **directed** (one-way) or **undirected**, and **weighted** (carrying a cost) or unweighted. A graph with no cycles and directed edges is a DAG, a directed acyclic graph.

Two representations dominate. An **adjacency list** stores, for each vertex, a collection of its neighbours. An **adjacency matrix** stores a `V x V` grid where cell `(i, j)` records whether an edge exists.

| | Adjacency list | Adjacency matrix |
|---|---|---|
| Space | `O(V + E)` | `O(V^2)` |
| Check if edge `(u,v)` exists | `O(degree(u))` | `O(1)` |
| Iterate neighbours of `u` | `O(degree(u))` | `O(V)` |
| Best for | Sparse graphs | Dense graphs |

Most real graphs — road networks, social graphs, dependency trees — are sparse, so the adjacency list is the default choice.

```python
graph = {
    "A": ["B", "C"],
    "B": ["D"],
    "C": ["D"],
    "D": [],
}
```

## Breadth-first search

BFS explores level by level using a **queue**, visiting all vertices at distance 1, then all at distance 2, and so on. Because it expands in order of distance, the first time it reaches a vertex it has found the shortest path there — in edge count.

```python
from collections import deque

def bfs(graph, start):
    visited = {start}
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbour in graph[node]:
            if neighbour not in visited:
                visited.add(neighbour)      # mark on enqueue, not dequeue
                queue.append(neighbour)
    return order
```

Marking a vertex visited when you *enqueue* it, not when you dequeue it, is essential. Otherwise a vertex reachable from several others gets added to the queue multiple times, and the algorithm does redundant work or loops.

BFS runs in `O(V + E)` time and `O(V)` space. Use it for shortest paths in unweighted graphs, finding connected components, level-by-level processing, and testing whether a graph is bipartite.

## Depth-first search

DFS follows one path as deep as possible before backtracking, using a **stack** — either explicitly, or implicitly via recursion.

```python
def dfs(graph, node, visited=None):
    if visited is None:
        visited = set()
    visited.add(node)
    for neighbour in graph[node]:
        if neighbour not in visited:
            dfs(graph, neighbour, visited)
    return visited
```

DFS is also `O(V + E)` time, with `O(V)` space for the recursion stack in the worst case. It does **not** find shortest paths. Its strengths are cycle detection, topological sorting, finding strongly connected components, and exploring exhaustively — maze solving, puzzle search and backtracking problems.

The only structural difference between BFS and DFS is queue versus stack. Swap the data structure and the traversal order changes completely.

## Cycle detection

In an **undirected** graph, a cycle exists if DFS reaches an already-visited vertex that is not the immediate parent of the current vertex.

In a **directed** graph you need three states rather than two: unvisited, in-progress (on the current recursion path), and finished. A cycle exists if you reach a vertex that is still in-progress — that is a back edge. Reaching a *finished* vertex is fine; it just means two paths converge.

This three-colour distinction is the part people most often get wrong.

## Topological sort

A topological sort orders the vertices of a DAG so that every edge points forwards. It answers dependency questions: build order, course prerequisites, task scheduling, spreadsheet recalculation.

**Kahn's algorithm** is the iterative approach. Compute each vertex's in-degree, enqueue every vertex with in-degree 0, and repeatedly dequeue a vertex, output it, and decrement its neighbours' in-degrees, enqueuing any that drop to 0.

```python
def topological_sort(graph):
    in_degree = {v: 0 for v in graph}
    for v in graph:
        for n in graph[v]:
            in_degree[n] += 1
    queue = deque([v for v in graph if in_degree[v] == 0])
    order = []
    while queue:
        v = queue.popleft()
        order.append(v)
        for n in graph[v]:
            in_degree[n] -= 1
            if in_degree[n] == 0:
                queue.append(n)
    if len(order) != len(graph):
        raise ValueError("graph has a cycle")
    return order
```

The length check at the end doubles as cycle detection: if a cycle exists, its vertices never reach in-degree 0 and never get emitted. A topological order exists if and only if the graph is acyclic, and it is generally not unique.

## Dijkstra's algorithm

Dijkstra finds shortest paths from one source in a graph with **non-negative** edge weights. It maintains tentative distances and repeatedly settles the closest unsettled vertex, relaxing its outgoing edges. A min-heap priority queue supplies the closest vertex, giving `O((V + E) log V)`.

```python
import heapq

def dijkstra(graph, start):
    dist = {v: float("inf") for v in graph}
    dist[start] = 0
    heap = [(0, start)]
    while heap:
        d, node = heapq.heappop(heap)
        if d > dist[node]:
            continue                 # stale entry, already settled better
        for neighbour, weight in graph[node]:
            new = d + weight
            if new < dist[neighbour]:
                dist[neighbour] = new
                heapq.heappush(heap, (new, neighbour))
    return dist
```

The non-negative requirement is not a technicality. Dijkstra assumes that once a vertex is settled no shorter path to it can appear, and a negative edge breaks exactly that assumption. For graphs with negative weights use **Bellman-Ford**, which is `O(V * E)` and additionally detects negative cycles. For all-pairs shortest paths on a dense graph, **Floyd-Warshall** is `O(V^3)` and very simple to implement.

On an unweighted graph, do not reach for Dijkstra — BFS gives the same answer in `O(V + E)`, because every edge having equal weight makes the queue's natural order already distance order.
