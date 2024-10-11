---
tags:
  - Rust
  - TCC
author: Pedro Colle
title: Borrow Checker
createdAt: 08/10/2024
updatedAt: 11/10/2024
---
# Entendendo o Borrow Checker de Rust

Rust é uma linguagem de programação de baixo nível, comparável a C++, que oferece acesso a memória seguro sem custo ao tempo de execução do programa. Ao invés de utilizar um *garbage collector* para abstrair o acesso a memória do programador, Rust se utiliza de uma série de regras para checar e gerir, em tempo de compilação, os acessos a memória, evitando erros como *use after free*, *double free*, *race conditions*, etc.  O mecanismo dentro da linguagem que faz essa validação é o Borrow Checker. 

Esse resumo é uma síntese do capítulo 2 - *A Tour of Rust* do artigo [*RustBelt: securing the foundations of the Rust programming language*](https://dl.acm.org/doi/pdf/10.1145/3158154), assim como elementos extraídos do [Rust Book](https://doc.rust-lang.org/1.8.0/book/README.html) e outras fontes, que serão citadas a medida que aparecem.
## Stack vs Heap

Antes de falar do Borrow Checker, é importante mencionar a relação que o sistema de *Ownnership* em rust tem com o *stack* (pilha) e a *heap*. Para os não iniciado:
- O *stack* é uma região de memória com uma estrutura de [pilha](https://pt.wikipedia.org/wiki/Pilha_(inform%C3%A1tica)), em que se aloca as variáveis locais com tamanho **conhecido** em tempo de compilação.
- A *heap* é uma outra região de memória, sem uma estrutura particular, em que se aloca os valores com tamanho **desconhecido** em tempo de compilação. Mais especificamente, qualquer valor com tamanho dinâmico, como listas, strings e buffers, serão alocados, em parte, na heap.
Essa clarificação, "*em parte*", é relevante na discussão do *Borrow Checker*, pois essas estruturas de dados tem um segmento, o de tamanho conhecido, alocado no stack. A alocação de uma string dinâmica em Rust pode ser feita da seguinte forma:
```rust
let s1 = String::new("hello");
```
Essa string `"hello"`, por exemplo, aloca a capacidade, tamanho e o ponteiro para a *heap* no *stack*, e a sequencia de caracteres 'h', 'e', 'l', 'l', 'o' na *heap*:
![string-layout.svg](/blog/string-layout.svg)
Imagem do layout da string "hello", extraída do [The Rust Programming Language](https://doc.rust-lang.org/book/title-page.html) 

Esses conceitos carregam para o comportamento de cópia em Rust. Na linguagem, a cópia de estruturas de dados é sempre rasa. Ou seja, quando há uma atribuição de valores para variáveis, o que será copiado para a variável é o valor alocado na pilha. Há certos tipos de dados em rust que uma cópia rasa é suficiente para copiar todo o conteúdo como os tipos numéricos (nesse caso implementam o [Trait](https://doc.rust-lang.org/book/ch10-02-traits.html) `Copy`). 

Agora, as regras da linguagem agem quando se realiza a cópia rasa de um valor, enquanto esse tem uma alocação na *heap* (p.e, contém ponteiros). No caso da string `"hello"`, tem-se o código:
```rust
let s1 = String::new("hello");
let s2 = s1; 
```
Devido ao comportamento de apenas fazer cópias rasas, s2 teria o mesmo valor na pilha que s1, e apontaria para a mesma região na heap. Esse comportamento pode levar a *use after free* e *double free*, erros indesejados. Entretanto, não é o que acontece na linguagem, pois, em rust, *s2 takes **ownership** of the value of s1* (s2 toma posse do valor de s1).

## Ownership 

Em rust, todo valor é associado (*bind*) a uma variável, de forma que uma variável é dona de seu valor. Assim, em atribuições ou o valor é **emprestado** (*do a borrow*) ou é **movido** (*do a move*). 
### Move
Para todo valor que não é trivialmente copiado (p.e, possui alocação na *heap*), ou seja, não implementa `Copy`, a semântica de atribuição move o valor da variável.
```rust
let v1 = vec![1, 2];
let v2 = v1;
```
Ao mover variáveis, ou no contexto acima, mover `vec![1, 2]` de `v1` para `v2`, ocorre o seguinte:
- Ocorre a cópia rasa do valor de `v1` para `v2`, copiando o valor alocado na pilha de `v1` (ponteiro, capacidade, tamanho...) para `v2`. 
- `v2` passa a ser o novo dono do valor alocado na *heap*
- Acessos a `v1` passam a ser inválidos após a operação.
Uma conclusão interessante a se tirar disso é que, todo valor tem apenas 1 dono, e que o acesso a um valor só é valido através do seu dono. Isso também se aplica aos argumentos de funções, assim, ocorre o seguinte trecho:
```rust
fn stuff(x: Vec<i32>){ /* stuff */ }

let v1 = vec![1, 2];
stuff(v1); //valor de v1 movido para x na função stuff
//referências a v1 a partir desse ponto são inválidas
```
> Se houver a necessidade de fazer uma cópia profunda de um valor, existe o `Trait` `Clone`, que expõem a função .clone() no tipo de dados. Ela retorna uma cópia profunda do valor.
### Borrow
Mas e o caso do empréstimo? Empréstimos são situações quando se trata de referências. Referências são extremamente similares a ponteiros, para quem já lidou com C, mas têm o adicional que não podem ser nulas. Portanto, que nem referências em C++. Em rust, tem-se o exemplo a seguir.
```rust
let v1 = vec![1, 2];
let v2 = &v1;
//       ^
//       | uso do & para indicar o borrow.
```
Nele, v2 é uma referência a v1.  Podendo acessar o valor interno de v1, mas **não modifica-lo**. Esse é um comportamento adicional das referências, elas são imutáveis por padrão. No fim das contas, elas são ponteiros para valores na pilha. Isso resolve, em parte, o problema de passagem de parâmetros para funções, podendo ler das variáveis, sem mover os valores:
```rust
fn stuff(x: &Vec<i32>){ /* stuff */ }

let v1 = vec![1, 2];
stuff(&v1); //valor de v1 emprestado para x na função stuff
```
Mas mais interessante que a referência em si é as consequências da sua existência para a operação de `move`. Quando existe uma referência **ativa** para um variável, o valor dessa variável não pode ser movido. Mas para ilustrar isso, tem-se:
```rust
let a = String::from("hello");
let b = &a;
let c = a; // error: cannot move out of `a` because it is borrowed
    
println!("{:?}", b); 
println!("{:?}", c);
```
Esse código falha, pois o `move` `let c = a` não pode ocorrer enquanto houver referências para `a`.

Mas e se for desejável ao programa modificar o valor apontado pela referência, como isso pode ser feito? Para isso existe um tipo especial de empréstimo, o empréstimo mutável (*borrow mut*). Ele carrega também uma regra especial, pode existir **ou** 1 empréstimo mutável, **ou** $n$ empréstimos imutáveis. Uma situação em que ele ocorre, é no seguinte trecho:
```rust
fn stuff(x: &mut Vec<i32>){ x.push(3); }

//   |variáveis precisam ser anotadas com mut para serem mutáveis 
//   V
let mut v1 = vec![1, 2];
stuff(&mut v1); //valor de v1 emprestado mutavelmente para x na função stuff
```
Em `stuff`, `push` é uma operação que tem que modificar o valor de x, então só passando uma referência mutável que a função poderia funcionar. A limitação que a referência mutável gera no `move` é a mesma das normais.   
Um programa que não funciona, dado aa regra do número de empréstimo que pode exister é o seguinte:
```rust
fn stuff(x: &mut Vec<i32>){ x.push(3); }

let mut v1 = vec![1, 2];
let v2 = &v1; // < -- referência imutável ocorre aqui
stuff(&mut v1);//erro: referência mutável ocorre enquanto existem referências imutáveis ativas. 
```
### Drop
O elemento que falta para completar o raciocínio do *Borrow Checker* é quando que a memória é liberada. Como citado antes, Rust não possui um *Garbage Collector* (GC). A regra de memória é consideravelmente simples: quando o dono de um valor sai de escopo, a memória associada é limpada junto. Mais especificamente, o método `.drop()` da estrutura de dados é chamado, método esse que todas as estruturas com o `Trait` `Drop` possuem. Referências, mutáveis ou não, **nunca** limpam memória. Quando elas saem de escopo, limpam o seu valor de ponteiro da pilha, mas não a variável que referenciam.

### Tudo junto
Essas regras listadas interagem entre si para gerar um sistema que é muito menos restritivo que parece. Uma demonstração disso é o código a seguir:
```rust
fn stuff(x: &mut Vec<i32>){ x.push(3); }

fn main() {
	let mut v1 = vec![1, 2];
	let m_v1 = &mut v1; //cria referência mutável
	stuff(v1);  //referência é movida para stuff
	let v2 = &v1;
	println!("{:?}", v2);
}
```
Esse exemplo é uma ótima combinação das regras. `m_v1` é uma referência mutável a `v1`. Ao chamar a função `stuff`, o valor de `m_v1` é movido para o argumento `x` da função, tornando `m_v1` e, por consequência, a referência mutável inválida a partir desse ponto. Assim, ao atribuir o valor de `v2` com `&v1`, não há referências mutáveis válidas ao mesmo tempo, fazendo essa ação ser correta no programa.

O trecho acima é bem mais comum que parece, por exemplo, tem-se o seguinte código:
```rust
fn main() {
	let mut v1 = vec![1, 2];
	v1.push(3);
	println!("{:?}", v1);
}
```
Pode não parecer muito semelhante, mas em questão de empréstimos é exatamente igual. Uma forma de ver isso é remover um pouco do açúcar sintático e fazer anotações no código:
```rust
fn main() {
	let mut v1 = vec![1, 2];
	//cria uma referência mutável e imediatamente move ela para a função push
	//equivalente a let m_v1 = &mut v1; Vec::push(m_v1, 3);
	Vec::push(&mut v1, 3); 
	//a partir desse ponto não referências mutáveis válidas para v1
	//pega uma referência imutável para v1 para a função println!
	println!("{:?}", v1); // o & é omitido aqui, pois println! é um macro
}
```
Essa relação de fazer referências e imediatamente move-lás para funções permite que $n$ `Vec::push` possam ser realizados em sequência, pois em nenhum ponto do código existirão mais de 1 referência mutável. Isso pois toda vez que ela é criada ela imediatamente é movida para a função. Essa que termina, libera essa referência antes da próxima chamada de `Vec::push`.
## Lifetimes

(In)Felizmente, ainda não acabou, pois esse sistema tem mais um truque na sua manga. Tempos de vida, ou *lifetimes*, são atributos de tipo que descrevem o escopo válido de uma referência. Voltando para o método `stuff` por exemplo, o tempo de vida da referência pode ser anotado como:
```rust
fn stuff<'a>(x: &'a mut Vec<i32>){ /* stuff */}
```
Tempos de vida são sempre anotados começando com um `'` seguido de um nome, que normalmente é só uma letra minúscula, porque Rust é bem matemático e tals. Eles são declarados entre os `< >` depois do nome da função, no mesmo lugar em que se define os [genéricos](https://doc.rust-lang.org/1.8.0/book/generics.html). Para funções simples como o nosso `stuff` e `Vec::push` , a linguagem tem regras para [elidir esses tempos de vida](https://doc.rust-lang.org/1.8.0/book/lifetimes.html#lifetime-elision), poupando anotações.

Atualmente, tempos de vida podem ser pensados como os escopos do programa. Projetos com [Polonius](https://github.com/rust-lang/polonius) se propõem a repensar esse funcionamento, a fim de aumentar o escopo de programas válidos que passam no *Borrow Checker*. Mas, no contexto atual, tempos de vida **são** escopos. Visto no exemplo abaixo:
```rust
let a = &1; // lifetime 'a
{
	let b = &a;   //lifetime 'b
	//b é liberado aqui
}
```
Nesse trecho, `b` é liberado no fim do escopo, ou melhor, no fim da duração do seu tempo de vida.

Essas anotações são mais comuns em structs, impl blocks e funções, locais em que as regras de elisão são mais justas. Um exemplo em que é necessária a anotação de tempo de vida segue:
```rust
fn maior_string<'a>(str1: &'a String, str2: &'a String) -> &'a String {
    if str1.len() > str2.len() {
        str1 //omíti-se o return e ; se for o último elemento da expressão para retornar
    }else{
        str2
    }
}
```
A função pode ser lida como: `maior_string` recebe duas referências a `String`,  `str1` e `str2`, com tempo de vida `'a` e retorna uma referência a uma `String` com um tempo de vida `'a`.  Isso é um conjunto de restrições para se chamar a operação. Um caso trivial disso é quando todos os tempos de vida são iguais, como em:  
```rust
//este escopo tem tempo de vida '1
let s1 = String::from("hello");
let s2 = String::from("hey");

//o tipo de s3 é &'1 String
let s3 = maior_string(& /* '1 */ s1, & /* '1 */ s2);
```
Mas essa operação também é válida para o seguinte caso 
```rust
//este escopo tem tempo de vida '1
let s1 = String::from("hello");
{
	//este escopo tem tempo de vida '2
	let s2 = String::from("hey");
	
	//o tipo de s3 é &'2 String
	let s3 = maior_string(& /* '1 */ s1, & /* '2 */ s2);
}
```
Nele, mesmo s1 tendo um tempo de vida diferente dos demais, como `'1` engloba `'2`, `'1` pode ser coagido em `'2`. Isso fecha as restrições estabelecidas. Tendo isso em mente, pode-se analisar porque o seguinte trecho é inválido.
```rust
//este escopo tem tempo de vida '1
let a = String::from("hello");
//toda expressão pode retornar valores
let c = { 
	//este escopo tem tempo de vida '2
	let b = String::from("hey");
	//maior_string retona uma referência com tempo de vida '1
	maior_string(& /* '1 */ a, & /* '2 */ b)
};
//erro: empréstimo b não vive tempo suficiente.
println!("{:?}", c);
```
Começando com `a` e `c`. O valor de `str1` terá tempo de vida `'1` e o tempo de vida de retorno também será `'1`. `b`, por outro lado, tem tempo de vida `'2`. Com esses valores, não se consegue satisfazer as restrições, `'2` não engloba `'1`, por isso não há coerção e a formula fica incorreta. Assim, `b` não vive tempo suficiente para essa chamada de função ser válida.

> Vale mencionar que o processo de atribuição `let c = { /* */ };` envolve um elemento de rust chamado [Subtyping](/blog/posts/subtyping), relevante ao estudo do *Borrow Checker*, mas não ao seu entendimento.

Um raciocínio alternativo pode ser feito através das regras de *Drop* da linguagem. A função `maior_string` pode retornar tanto uma referência a `s1` quanto a `s2`. Porém se `s1` e `s2` não vivem a mesma duração, o valor referente retornado pode não referenciar um valor válido. Nisso, o tempo de vida do retorno **deve** ser o menor entre os dois, para que o retorno sempre seja válido.

Uma consequência dessas regras é que elas definem bem que tipo de referência podem ser retornadas de funções. Por exemplo:
```rust
fn ret_s<'a>() -> &'a String {
    //este escopo tem tempo de vida '2
    let s = String::from("hey");
    &s
}

fn main(){
	//este escopo tem tempo de vida '1
    let c = ret_s();
    println!("{:?}", c);
}
```
Esse código não compila, e por bons motivos. Pelas regras de `Drop`, `s` seria deleta no fim do escopo, e o valor retornado seria uma referencia inválida. Analisando pelas regras do tempo de vida, vê-se que:  `c` tem tempo de vida `'1` e `s` tem tempo de vida `'2`. `'1` engloba `'2`. Logo, o tempo de vida retornado de `ret_s` deve ser `'1`, dado `c`. Entretanto `s` tem tempo de vida `'2`, e não há coerção de `'2` para `1`, pois `'1` contém `'2`, e não o contrário. Assim, o programa falha em resolver as restrições e não compila. Isso tudo para dizer:  **não há como retornar referências para valores que são propriedades de funções**.

## Conclusão
O *Borrow Checker* em Rust é uma poderosa ferramenta para assegurar a escrita de programas sem problemas de memória. Os seus mecanismos, inicialmente obscuros, ficam mais claros a medida que se escreve mais na linguagem. Intuitivamente, não é tão complicado, teoricamente, um tanto. Mas essa é a minha missão e objetivo do TCC. 

Neste artigo, faltou-se discutir alguns elementos de rust, como [paralelismo](https://doc.rust-lang.org/book/ch16-00-concurrency.html), [closures](https://doc.rust-lang.org/1.8.0/book/closures.html), [genéricos](https://doc.rust-lang.org/1.8.0/book/generics.html) , e as suas interações com o *Borrow Checker*. Alguns elementos mais específicos também ficaram faltando, como [*reborrows*](https://haibane-tenshi.github.io/rust-reborrowing/), *interior pointers*, *double references*, etc, que eu busco discorrer em uma postagem futura.

Muito obrigado por lerem e tal.

![chopper-rust.jpg](/blog/chopper-rust.jpg)

Me again, btw.