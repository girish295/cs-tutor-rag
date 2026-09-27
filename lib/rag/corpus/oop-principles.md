---
id: oop-principles
title: Object-Oriented Programming and SOLID
topic: Software Design
tags: [oop, encapsulation, inheritance, polymorphism, solid, composition]
difficulty: intermediate
---

## The four pillars

**Encapsulation** bundles data with the methods that operate on it and restricts outside access to internal state. The point is that an object enforces its own invariants: if a `BankAccount` only exposes `deposit` and `withdraw`, no caller can set a negative balance directly. Changing the internal representation then stays safe, because nothing outside depends on it.

**Abstraction** exposes what an object does while hiding how. A `Database.save()` method is meaningful to callers without revealing connection pooling or SQL. Encapsulation is the mechanism; abstraction is the design goal it serves.

**Inheritance** lets a class derive fields and behaviour from a parent, expressing an "is-a" relationship. A `Dog` is an `Animal`, so it inherits `name` and `eat()` while adding `bark()`.

**Polymorphism** lets one interface work with many types. Calling `speak()` on a list of animals dispatches to each concrete implementation without the caller knowing which class it holds.

```python
class Animal:
    def __init__(self, name):
        self.name = name
    def speak(self):
        raise NotImplementedError

class Dog(Animal):
    def speak(self):
        return f"{self.name} says Woof"

class Cat(Animal):
    def speak(self):
        return f"{self.name} says Meow"

for animal in [Dog("Rex"), Cat("Momo")]:
    print(animal.speak())      # polymorphic dispatch
```

## Composition over inheritance

Inheritance is the most overused feature in OOP. It creates the tightest possible coupling: a subclass depends on its parent's internals, so a parent change can break every descendant — the "fragile base class" problem. Deep hierarchies become difficult to reason about, and many languages forbid multiple inheritance precisely because it produces ambiguity.

**Composition** builds objects that *hold* other objects and delegate to them, expressing "has-a" rather than "is-a".

```python
class Engine:
    def start(self):
        return "engine running"

class Car:
    def __init__(self):
        self.engine = Engine()       # has-a
    def start(self):
        return self.engine.start()   # delegate
```

The practical test: use inheritance when the subtype is genuinely substitutable for the parent everywhere, and composition otherwise. The classic counterexample is `Square extends Rectangle` — a square is a rectangle mathematically, but setting width and height independently breaks it, so the inheritance is wrong even though the English sentence sounds right.

## SOLID

**S — Single Responsibility.** A class should have one reason to change. A class that parses a file, validates it and writes to a database has three, so a change to any one risks the others. Split them.

**O — Open/Closed.** Code should be open to extension but closed to modification. Adding a new shape type should mean adding a class, not editing a growing `if isinstance(...)` chain in an existing function. Polymorphism is the usual mechanism.

**L — Liskov Substitution.** Any subtype must be usable wherever its parent is, without the caller needing to know. A subclass that strengthens preconditions, weakens guarantees, or throws where the parent did not, violates this — as `Square extends Rectangle` does.

**I — Interface Segregation.** Prefer several small interfaces to one large one. A class forced to implement methods it does not need — stubbing them out or raising `NotImplementedError` — is a sign the interface is too broad.

**D — Dependency Inversion.** Depend on abstractions rather than concrete implementations. A service that constructs its own `PostgresClient` internally cannot be tested without a real database; one that accepts any object satisfying a `Storage` interface can be given a fake. Passing dependencies in rather than creating them is dependency injection, and it is the single highest-leverage habit for testability.

## Class, instance and static members

An **instance** attribute belongs to one object. A **class** attribute is shared by every instance, which is useful for constants and dangerous for mutable values, for the same reason as Python's mutable default arguments.

```python
class Counter:
    total = 0                  # shared by ALL instances
    def __init__(self):
        Counter.total += 1     # increments the shared value
        self.id = Counter.total  # per-instance
```

A **static method** needs neither the instance nor the class and is merely namespaced inside it. A **class method** receives the class itself and is the standard way to write alternative constructors.

## Abstract base classes and interfaces

An abstract class defines a contract with some methods left unimplemented and cannot be instantiated directly. It lets you state "every subclass must provide these methods" and have that enforced at construction time rather than discovered at runtime.

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...

class Circle(Shape):
    def __init__(self, r): self.r = r
    def area(self) -> float: return 3.14159 * self.r ** 2
```

Python also supports **duck typing**: if an object has the method you call, it works, regardless of its declared type. Abstract base classes and `typing.Protocol` bring explicit contracts to a language that does not require them, which pays off as a codebase grows and informal expectations stop being obvious.
