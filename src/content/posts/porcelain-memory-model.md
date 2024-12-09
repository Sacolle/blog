---
title: O Modelo de memória de Porcelain
author: Pedro Colle
createdAt: 15/11/2024
updatedAt: 09/12/2024
tags:
  - PCL
  - TCC
---
# O Modelo de memória de Porcelain

Para a linguagem *Porcelain* e seus objetivos, é importante definir como a memória do sistema operará. Isso é necessário, pois toda a relação de segurança que se deseja modelar trata-se de problemas de memória. Quanto mais próximo o modelo for do comportamento real de uma linguagem, mais facilmente se poderá representar os erros de acesso à memória. Para isso, parte-se de uma construção simplificada da linguagem, com apenas elementos relevantes ao acesso a memória. Assim, gera-se $PCL_{mem}$ .
## Gramática de PCL mem
A linguagem, na sua forma mais essencial, é descrita da seguinte forma:
- $x$ são variáveis
- $n$ são todos os números naturais.
- $l$ são localizações, representadas pelos números naturais
$$
\begin{align*}
Type \ni \tau  ::&= \mathbf{int} \; | \; \&\tau && \\
Value \ni v ::&= n \; | \; l \; | \; \&x && \\
Expression \ni e ::&= x \; | \; n \;|\; l \; | \; e + e \;|\; \text{*}e \; |\; \&e \;|\; \mathbf{malloc}(e)\\
Statement \ni S ::&= S;S \; \\
&| \; \{\,S\,\} \; \\ 
&| \; \mathbf{skip} \; \\ 
&| \; \mathbf{free}(e, e) \; \\ 
&| \; e := e \; \\
&| \; \mathbf{let} \; x: \tau \; \\
\end{align*}
$$
Para o sistema de transições, há dois elementos importantes, a pilha $p$ e a memória $m$. Nesses dois contextos há os valores notáveis $\bot$ e $-$ , representando valores de endereços declarados, mas não inicializados, e endereços não declarados, respectivamente. Neste trabalho, usa-se uma convenção similar a [convenção de Barendregt](https://www.pls-lab.org/en/Barendregt_convention#:~:text=The%20Barendregt%20convention%20is%20a,convertible%20terms%20as%20essentially%20equal.), em que pode-se renomear variáveis para evitar confundir duas variáveis. No contexto de PCL, assume-se que todos os identificadores do programa são únicos. Isso serve para simplificar o processo de indexação e substituição de variáveis na pilha.
### Pilha
A pilha do sistema é uma pilha de frames, sendo cada frame um mapa de chaves para valores. Esses valores podem ser os números naturais, referências a endereços, locais e os valores notáveis $\{\bot, -\}$. O frame vazio é anotado por abre e fecha chaves $\{\}$. Incialmente, o acesso a qualquer chave no frame retorna o valor notável $-$. Esse valor representa que a variável ainda não foi definida no frame. Operações específicas como declaração e alocação de memória operam sobre esses frames, atribuindo a chaves outros valores.

A notação da pilha é similar a haskell, em que se estende a pilha $p$ com o operador $::$ . Assim, aumentando a pilha $p$ em um frame genérico no topo tem a notação $\{\}::p$. A pilha também pode ser particionada com o operador $::$ , sendo uma pilha $frame :: p$ tendo o topo sendo o frame $frame$ e o restante sendo $p$ ($frame$ pode ser abreviado para $fr$).  A base da pilha é o valor $nil$.

Essa modelagem permite facilmente lidar com os escopos da linguagem. Ao abrir chaves, empilha-se um frame vazio, colocando declarações desse escopo dentro do frame. Ao fim das chaves, basta apenas remover o topo da pilha para desalocar todas as variáveis daquele escopo.
#### Manipulação da Pilha
Para acessar o valor de uma variável $x$ na pilha $p$, realiza-se $p(x)$. Essa notação retorna o valor definido de $x$ na pilha, consultando todos os frames deste em ordem:
$$
\begin{align*}
	&(frame :: p)(x) = \mathbf{if}\; frame(x) \neq - \;\mathbf{then}\; frame(x) \;\mathbf{else}\; p(x)\\
	&nil(x) = -
\end{align*}
$$
Sendo $frame(x)$ o valor que a chave $x$ contém no mapa $frame$. 
Atribuições na pilha tem um comportamento parecido. Para fazer atribuições usa-se a notação $p[x \mapsto v]$, que coloca o valor $v$ em $x$ na ocorrência de $x$ no frame em que esse se encontra definido:
$$
\begin{align*}
	&(frame :: p)[x \mapsto v] = \mathbf{if}\; frame(x) \neq - \;\mathbf{then}\; frame[x \mapsto v] :: p \;\mathbf{else}\; frame :: p[x \mapsto v]\\
	&nil[x \mapsto v] = nil
\end{align*}
$$
Sendo $frame[x \mapsto v]$ a operação que atribui a chave $x$ no mapa $frame$ para o valor $v$. Tendo essas regras, a pilha é definida. Nota-se que não há como atribuir valor a variáveis indefinidas via $p[x \mapsto v]$, para isso é necessário obter o frame específico que gostaria de inserir o valor, normalmente o topo usando $frame :: p$, inserindo diretamente no frame e recompondo a pilha $frame[x \mapsto \bot] :: p$.
No contexto atual da linguagem, a pilha de um programa inicial de $PCL_{mem}$ inicia com um frame vazio sobre $nil$ ($\{\} :: nil$).
### Memória
A memória, no contexto desta semântica operacional, se equivale com o conceito de [heap](https://en.wikipedia.org/wiki/Memory_management#HEAP). Ela é representada por um vetor, indexado pelas localizações $l$, que são os números naturais. No contexto dessa linguagem e do exercício deste trabalho, não será lidado com casos em que há limite de memória, para simplificar o sistema. Nisso, considera-se que o vetor de memória é infinito. 
No caso de alocações de memória, é necessário o uso de uma função auxiliar . Ela encontra um espaço na memória  com $n$ células não inicializadas, valor $-$, e retorna a localização  da célula que começa essa sequência. 
$$
\begin{align*}
& \mathbf{loc}(m, n) = \mathbf{loc}'(m, n, 0, 1) \\
& \mathbf{loc}'(m, n_0 , n_1, l) = \mathbf{if}\; m(l) \neq -  \; \mathbf{then}\; \mathbf{loc}'(m, n_0, 0, l + 1) \\
	&\quad \mathbf{else}\; \mathbf{if}\; n_0 = n_1 \; \mathbf{then}\; l \;\mathbf{else}\; \mathbf{loc}'(m, n_0, n_1 + 1, l)\\
\end{align*}
$$
No contexto dessa linguagem _C-like_, a representação do ponteiro `NULL` é o valor de localização $l$ 0. Nisso, reserva-se o endereço de memória 0, em que nele memória através das funções de alocação não será alocada. Por isso a função $\mathbf{loc}$ chama a função $\mathbf{loc}$' com o valor inicial de $l$ sendo 1

#### Manipulação da Memória
Diferentemente da pilha, como a estrutura da memória é uma lista, fica simples de definir que para uma memória $m$ e uma localização desta, $l$, $m(l)$ é o valor da memória na l-ésima posição, e $m[l \mapsto v]$ colocar o valor $v$ na l-ésima posição. Com as funções $\mathbf{malloc}$ e $\mathbf{free}$, há a necessidade de atribuir valores a múltiplas localizações contíguas ao mesmo tempo. Dessa forma, a notação $m[l_{0..n}\mapsto v]$ atribui da localização $l+0$ até a localização $l+ (n-1)$ o valor $v$. Com essas regras, define-se a memória.

## Comportamento Indefinido
Uma coisa muito importante para o modelo de memória dessa linguagem é a sua relação com comportamento indefinido (_undefined behavior_ - UB). Esse tópico requer uma discussão bem mais aprofundada e, portanto, uma análise do mapeamento de UB de C para PCL é necessário, mas será posposto para outro momento. Quando o post sair,  estará vinculado aqui: [Undefined Behavior](/blog/posts/undefined-behavior).
## Semântica Small-Step
A semântica small-step da linguagem define a derivação de um estado ao outro após um único passo. Um programa finaliza corretamente ao tentar derivar a expressão $\langle \mathbf{skip}, p, m \rangle$. Como a definição de $PCL_{mem}$ não contém estruturas iterativas ou recursivas, todos os seus problemas terminam. Assim, segue-se as regras da semântica da linguagem.
### Composição
A composição de $PCL_{mem}$ consiste em interligar as demais declarações da linguagem, adicionando o elemento de escopo, que será mais relevante na próxima etapa. Mesmo assim, o escopo permite uma expressividade adicional. Dessa forma, tem-se as regras básicas de composição:
$$
\begin{align*}
&\text{S-compose} && \text{S-skip} \\ 
&\frac{\St{S_1, p, m} \to \St{S_1', p', m'}} {\St{S_1;S_2, p, m} \to \St{S_1';S_2, p', m'}} &&
\frac{}{\St{\mathbf{skip};S, p, m} \to \St{S, p, m}}\\
&\text{S-escopo} && \text{S-pop}\\ 
&\frac{}{\St{\{S\}, p, m} \to \St{S;\mathbf{pop}, \{\}::p, m}} &&
\frac{}{\St{\mathbf{pop}, fr :: p, m} \to \St{\mathbf{skip}, p, m}}
\end{align*}
$$
A nova regra $\mathbf{pop}$ existe somente na semântica operacional e remove o topo da pilha.

### Declarações
As outras declarações da linguagem são a declaração, atribuição e a liberação de memória. A atribuição é _C-like_, no sentido que toda variável é mutável por padrão. Dessa forma, tem-se as regras de declaração e atribuição:
$$
\begin{align*}
&\text{S-declara}\\ 
&\frac{}{\St{\mathbf{let}\; x: \tau, fr::p, m} \to \St{\mathbf{skip}, fr[x \mapsto \bot] :: p, m}} \\
&\text{S-atribui-step} && \text{S-atribui-deref-ref}\\
&\frac{\St{e_1, p, m} \to \St{e_1', p', m'}}{\St{\text{*}e_1 := e_2, p, m} \to \St{\text{*}e_1' := e_2, p', m'}} &&
\frac{}{\St{\text{*}\&e_1 := e_2, p, m} \to \St{e_1 := e_2, p, m}} \\
&\text{S-atribui-var-step}  && \text{S-atribui-loc-step} \\
&\frac{\St{e, p, m} \to \St{e', p', m'}}{\St{x := e, p, m} \to \St{x := e', p', m'}} &&
\frac{\St{e, p, m} \to \St{e', p', m'}}{\St{\text{*}l := e, p, m} \to \St{\text{*}l := e', p', m'}} \\
&\text{S-atribui-var}  && \text{S-atribui-loc} \\
&\frac{p(x) \neq -}{\St{x := v, p, m} \to \St{\mathbf{skip}, p[x \mapsto v], m}} &&
\frac{m(l) \neq -}{\St{\text{*}l := v, p, m} \to \St{\mathbf{skip}, p, m[l \mapsto v]}} \\
&\text{S-free-step-1} && \text{S-free-step-2}\\ 
&\frac{\St{e_1, p, m} \to \St{e_1', p', m'}}{\St{\mathbf{free}(e_1, e_2), p, m} \to \St{\mathbf{free}(e_1', e_2), p', m'}} &&  \frac{\St{e, p, m} \to \St{e', p', m'}}{\St{\mathbf{free}(l, e), p, m} \to \St{\mathbf{free}(l, e'), p', m'}} \\
&\text{S-free}\\ 
& \frac{}{\St{\mathbf{free}(l, n), p, m} \to \St{\mathbf{skip}, p, m[l_{0..n} \mapsto -]}}\\ 
\end{align*}
$$
As expressões da linguagem são limitadas, mas, para o contexto de memória e descrição dessa linguagem, são suficiente. 
### Expressões
As expressões da linguagem são limitadas também, contendo apenas a soma como operação algébrica e elementos de operação de ponteiro. Isso, pois há aritmética de ponteiro, então $l + n$ resulta em um valor que pode ser coagido ou como número ou ponteiro. Dessa forma, tem-se as expressões:
$$
\begin{align*}
&\text{E-sum-esq} && \text{E-sum-dir}\\ 
&\frac{\St{e_1, p, m} \to \St{e_1', p', m'}}{\St{e_1 + e_2, p, m} \to \St{e_1' + e_2, p', m'}} && \frac{\St{e, p, m} \to \St{e', p', m'}}{\St{v + e, p, m} \to \St{v + e', p', m'}}\\ 
&\text{E-sum} && \text{E-var}\\ 
&\frac{\mathcal{N}(v_1 + v_2) = v}{\St{v_1 + v_2, p, m} \to \St{v, p, m}} && \frac{p(x) = v}{\St{x, p, m} \to \St{v, p, m}} \\
&\text{E-deref-step} && \text{E-deref-loc}\\ 
&\frac{\St{e, p, m} \to \St{e', p', m'}}{\St{\text{*}e, p, m} \to \St{\text{*}e', p', m'}} && \frac{m(l) = v}{\St{\text{*}l, p, m} \to \St{v, p, m}}\\ 
&\text{E-ref-deref} && \text{E-deref-ref}\\ 
&\frac{}{\St{\&\text{*}e, p, m} \to \St{e, p, m}} && \frac{}{\St{\text{*}\&e, p, m} \to \St{e, p, m}}\\ 
&\text{E-malloc-step} && \text{E-malloc}\\ 
&\frac{\St{e, p, m} \to \St{e', p', m'}}{\St{\mathbf{malloc}(e), p, m} \to \St{\mathbf{malloc}(e'), p', m'}} && \frac{\mathbf{loc}(m, n) = l}{\St{\mathbf{malloc}(n), p, m} \to \St{l, p, m[l_{0..n} \mapsto \bot]}} \\ 
\end{align*}
$$
Na regra $\text{E-sum}$ há a função $\mathcal{N}$. Ela recebe um construto de soma da linguagem, traduz ele para um contexto matemático e realiza a operação. Então nesse caso, $v_1$ e $v_2$ podem ser locais, números ou referências. Se forem locais ou números, são convertidos aos naturais para realizar a soma. $\mathcal{N}$ não é definido quando $v_1$ ou $v_2$ são referências, então se um deles for, a pré-condição não é válida e não pode-se realizar a soma. 

Dessa forma, define-se $PCL_{mem}$. A linguagem é mínima neste estado para poder focar especificamente nas características de memória que gostaria de se representar. Com esse exercício, pode-se representar algumas construções da linguagem C e Rust e realizar comparações.
## Exemplos
Segue agora alguns exemplos da fatoração das regras, com as suas equivalências em C e Rust. No caso dessas duas linguagens, omite-se a main para o formato se a semelhar melhor a PCL.
### Referências a pilha

#### C
Nesse programa declara-se duas variáveis, $x$ e $y$. Inicializa $x$ com 2 e $y$ com o endereço de $x$. Depois, atribui o valor 2 a $x$, através da desreferência da variável $y$ que contém o ponteiro para $x$. 
```c
int x;
int* y;
x = 4;
y = &x;
*y = 2;
// printf("x: %d, y: %p", x, y); -> x: 2, y: o endereço de x (ex: 000000000061FE14)
```
#### Rust
O exemplo em Rust é essencialmente o mesmo, porém com mais anotações devido as regras da linguagem. Nela variáveis são imutáveis por padrão, então após do `let` deve-se colocar a palavra-chave `mut` para indicar que a variável é mutável. O mesmo vale para a referência a $x$, deve-se indicar que a referência irá modificar o valor. Outra coisa interessante é o `println!` comentado. Nele, usa-se `*y` ao invés de x. Isso ocorre devido as regras do [Borrow Checker](/blog/posts/borrow-checker), em que não pode gerar uma referência imutável enquanto tem-se uma referência mutável ativa.
```rust
let mut x: u32;
let y: &mut u32;
x = 4;
y = &mut x;
*y = 2;
//println!("x: {}, y:{:p}", *y, y); -> x: 2, y: o endereço de x (ex: 0x8284f7fbac)
```
#### PCL mem
O comportamento de $PCL_{mem}$ é, neste momento, muito mais próxima do exemplo de C. De certa forma, opera de forma exatamente igual, que é a intenção para essa versão inicial da linguagem.
```rust
//pilha {} :: nil
let x: int;    //S-declara fr[x > bot] :: nil
let y: &int;   //S-declara fr[x > bot; y > bot] :: nil
x := 4;        //S-atribui-var fr[x > 4; y > bot] :: nil
y := &x;       //S-atribui-var fr[x > 4; y > &x] :: nil
*y := 2;       //S-atribui-esq -> E-deref-step -> E-var 
// *&x := 2;   //E-deref-ref
//  x  := 2;   //S-atribui-var fr[x > 2; y > &x] :: nil
```
### Referências a memória
#### C
Nesse programa, aloca-se dois espaços de tamanho `int` em memória usando a função `malloc` do header `<stdio.h>`. Com isso atribui os valores 7 e 3 para os dois lugares. Depois, atribui o segundo endereço de $x$ para $y$ e, através desse, atribui o valor 5 a segunda posição. Ao fim, libera a memória usada.
```c
int* x;
int* y;
x = malloc(sizeof(int) * 2);
x[0] = 7;
x[1] = 3;
y = x + 1;
*y = 5;
//printf("x: %p, y: %p, [%d, %d]", x, y, x[0], x[1]); 
//   |> x: 00000000001E7700, y: 00000000001E7704, [7, 5]
free(x);
```
#### Safe Rust
Essa alocação de memória diretamente não existe na dentro das regras de segurança da linguagem Rust, assim, o código abaixo segue com abstrações seguras que a linguagem propõem. Um exemplo disso é a chamada de `resize` para alocar espaço no vetor, ela precisa de um valor para inicializar a lista, não tendo chance de indexar um elemento não inicializado. Isso é outra coisa, a linguagem checa o tamanho da lista antes de indexar, gerando um pânico caso o índice seja maior que o tamanho. A ação com chaves no fim do código é devido ao [Borrow Checker](/blog/posts/borrow-checker).
```rust
let mut x: Vec<u32>;
let y: &mut u32;
x = Vec::new();
x.resize(2, 0);
x[0] = 7;
x[1] = 3;
{
	y = &mut x[1];
	*y = 5;
	print!("y:{:p}, ", y);
}
println!("x: {:?}", x);
```

#### Unsafe Rust
[Unsafe Rust](/blog/posts/unsafe-rust) é uma característica da linguagem que permite ignorar as suas regras de segurança para atingir maior expressividade, como o acesso e manipulação direta à memória. Nota-se que, fora as indicações de tipo e métodos adicionais, dentro do segmento delimitado por `unsafe`, o código é extremamente similar a C. 
```rust
let x: *mut u32;
let y: *mut u32;
let layout = Layout::array::<u32>(2).unwrap();
unsafe{
	x = alloc(layout) as *mut u32;
	*x.add(0) = 7u32;
	*x.add(1) = 3u32;
	y = x.add(1);
	*y = 5u32;
	//println!("x: {:p}, y: {:p}, [{}, {}]", x, y, *x, *x.add(1));
	//   |> x: 0x1e86c236440, y: 0x1e86c236444, [7, 5]
	dealloc(x as *mut u8, layout)
}
```
#### PCL mem
Assim como no caso anterior, é, por design, similar a C. Uma diferença importante é que o modelo de memória não são endereços de tamanho único, mas do tamanho necessário para o tipo de dado. Então não é necessário dizer o tamanho do tipo de dados na função `malloc`, pois todo tipo de dado tem tamanho 1. Além disso não há o açúcar sintático de C, que traduz `x[1]` para `*(x + 1)`, então este deve ser escrito. Ao fim, a função `free` precisa do tamanho alocado, pois diferente de `free` em C, ela não mantém uma lista com o tamanho das alocações.
```rust
//pilha {} :: nil
//mem [..., -, -, -, ...]
let x: &int;    //S-declara fr[x > bot] :: nil
let y: &int;    //S-declara fr[x > bot; y > bot] :: nil
x := malloc(2); //S-atribui-dir -> E-malloc mem[-, bot, bot, -, ...]
	// x := l   //S-atribui-var fr[x > l; y > bot] :: nil
*x := 7;        //S-atribui-esq -> E-deref-step -> E-var
	//*l := 7   //S-atribui-loc mem[-, 7, bot, -, ...]
*(x + 1) := 3;  //S-atribui-esq -> E-deref-step -> E-sum-esq -> E-Var
	//*(l + 1) := 3;  //E-sum 
	//*l1 := 3;       //S-atribui-loc mem[-, 7, 3, -, ...]
y := x + 1;     //S-atribui-dir -> E-sum-esq -> E-var
	//y := l + 1      //E-sum
	//y := l1         //S-atribui-var fr[x > l; y > l1] :: nil
*y := 5;        //S-atribui-loc mem[-, 7, 5, -, ...]
free(x, 2)      //S-free-step -> E-var
	//free(l, 2)//S-free mem[-, -, -, -, ...]
```

## Interpretador em Haskell
Um simples interpretador da linguagem foi escrito em haskell para testar algumas construções e verificar que tudo funciona corretamente. Haskell foi escolhido para isso pois ela apresenta um mapeamento bem direto entre a grafia da semântica small-step e os construtos da linguagem para descrevê-los. Falta testes e algo ainda pode estar errado, mas o código em seu estado atual se encontra no meu [github](https://github.com/Sacolle/Interpretador-PCL).

Futuramente planejo adicionar um interpretador de PCL no blog com as respectivas versões da linguagem, para poder demonstrar a evolução dos aspectos de segurança.
## Conclusão
Na atual descrição, $PCL_{mem}$ serve bem o seu propósito, descrever uma forma de acesso a memória. Com essa linguagem pode-se começar a analisá-la e provar, o que é ser seguro, quando que é seguro e o que poderá fazê-la mais segura. Nas postagem seguintes busco complementar a linguagem e demonstrar matematicamente as suas propriedades, definindo formalmente o que significa uma linguagem ser segura.
