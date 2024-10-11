---
tags:
  - Rust
  - TCC
author: Pedro Colle
title: Subtyping
createdAt: 30/09/2024
updatedAt: 11/10/2024
---
# Micro Explicação: Subtyping

Uma sintaxe importante ao se discutir o [Borrow Checker](/blog/posts/borrow-checker), é o de subtiping. Para exemplificar essa relação, utiliza-se o seguinte exemplo extraído do rust RFC book [2094-nll](https://rust-lang.github.io/rfcs/2094-nll.html?highlight=nll#subtyping):
```rust
p = &'foo foo
```
Nele, tem-se uma referência e tipo `&'foo T`, com `T` sendo o tipo de `foo`. Ela é atribuída a `p`, que por consequência tem o tipo `&'p T`. Nisso se estabelece uma relação de subtipos entre `foo` e `p` da forma:
```
(&'foo T <: &'p T)
```
Essa expressão é lida como, `&'foo T` é um subtipo de `&'p T`. Assim, verifica-se que `foo` deve estar contido em `p`. Ou seja, para cada novo empréstimo sobre um tempo de vida, mais limitado é o seu possível escopo de valor. Isso, em [Polonius](https://github.com/rust-lang/polonius) é vital, pois através dessa checagem desses limites que se descobre se um programa é válido.
