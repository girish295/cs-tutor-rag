---
id: javascript-async-and-event-loop
title: JavaScript Asynchrony, Promises and the Event Loop
topic: Programming Languages
tags: [javascript, async, await, promise, event-loop, closure, hoisting]
difficulty: intermediate
---

## Single-threaded, but not blocking

JavaScript executes your code on **one thread** with a single call stack. It nonetheless handles thousands of concurrent network requests, because the slow work is not done by that thread. Timers, network I/O and file access are delegated to the host environment — the browser or Node's libuv — and JavaScript is notified when they finish.

This is why blocking the thread is catastrophic. A long synchronous loop freezes the entire page, since no other JavaScript, rendering or event handling can happen until the stack empties.

## The event loop

The event loop coordinates the call stack with two queues:

- The **macrotask queue** (also called the task or callback queue) holds callbacks from `setTimeout`, `setInterval`, and I/O events.
- The **microtask queue** holds promise continuations — every `.then` callback and everything after an `await` — plus `queueMicrotask`.

The rule that matters: after the call stack empties, the event loop drains the **entire** microtask queue before taking a single macrotask. Microtasks therefore always run before timers, and a microtask that schedules another microtask can starve the macrotask queue completely.

```javascript
console.log("1");
setTimeout(() => console.log("2"), 0);      // macrotask
Promise.resolve().then(() => console.log("3")); // microtask
console.log("4");
// Output: 1, 4, 3, 2
```

Predicting that output correctly is the standard test of whether someone understands the event loop. `setTimeout(fn, 0)` does not mean "run immediately" — it means "queue this as a macrotask", which is strictly after all pending microtasks.

## Promises

A promise represents a value that is not available yet. It occupies one of three states: **pending**, **fulfilled** with a value, or **rejected** with a reason. Once settled, a promise never changes state again.

```javascript
const promise = new Promise((resolve, reject) => {
  if (ok) resolve(value);
  else reject(new Error("failed"));
});

promise
  .then(value => transform(value))
  .catch(error => handle(error))
  .finally(() => cleanup());
```

`.then` returns a new promise, which is what makes chaining work and what flattens nested promises automatically. A value returned from a `.then` callback becomes the next promise's resolved value; a thrown error skips ahead to the nearest `.catch`.

## async and await

`async`/`await` is syntax over promises, not a separate mechanism. An `async` function always returns a promise, and `await` pauses that function until the awaited promise settles — without blocking the thread, because the rest of the function is scheduled as a microtask.

```javascript
async function loadUser(id) {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("load failed", error);
    throw error;                 // re-throw so the caller can react
  }
}
```

Note that `fetch` does **not** reject on HTTP error statuses. It rejects only on network failure, so you must check `res.ok` yourself. Assuming otherwise is a very common bug.

## Sequential versus parallel awaits

This is the most consequential performance mistake in async JavaScript.

```javascript
// Sequential — total time is the SUM of both requests
const a = await fetchA();
const b = await fetchB();

// Parallel — total time is the MAX of both requests
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

Use sequential awaits only when the second call genuinely depends on the first result. Otherwise start both and await together.

The combinators differ in failure behaviour: `Promise.all` rejects as soon as any input rejects; `Promise.allSettled` always resolves with a status for each; `Promise.race` settles with whichever settles first; `Promise.any` resolves with the first *fulfilment*, ignoring rejections unless all fail.

Awaiting inside a loop is the sequential pattern in disguise, and is usually the cause of a slow batch operation:

```javascript
// slow: one round trip at a time
for (const id of ids) results.push(await fetchItem(id));

// fast: all at once
const results = await Promise.all(ids.map(fetchItem));
```

## Closures

A closure is a function bundled with the scope it was created in, so it retains access to those variables after the outer function returns.

```javascript
function counter() {
  let count = 0;                 // private to the returned function
  return () => ++count;
}
const next = counter();
next(); next();                  // 2
```

Closures are how JavaScript expresses private state, and how callbacks remember their context.

## var, let and const

`var` is function-scoped and **hoisted**, initialised as `undefined` before its assignment runs. `let` and `const` are block-scoped and live in a "temporal dead zone" until declared, so accessing them early throws instead of silently yielding `undefined`.

The loop case is the practical difference: `var` shares one binding across every iteration, while `let` creates a fresh binding each time.

```javascript
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i));  // 3, 3, 3
for (let j = 0; j < 3; j++) setTimeout(() => console.log(j));  // 0, 1, 2
```

Default to `const`, use `let` when reassignment is needed, and avoid `var` in new code. Note that `const` prevents rebinding the name, not mutation of the object — `const arr = []; arr.push(1)` is perfectly legal.

## Equality

`==` performs type coercion with rules that are genuinely surprising, such as `"" == 0` and `null == undefined` both being true. `===` compares without coercion. Use `===` unless you specifically want `== null` to catch both `null` and `undefined`.
