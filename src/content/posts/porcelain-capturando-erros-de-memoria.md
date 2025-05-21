---
title: Panic! in Porcelain
author: Pedro Colle
createdAt: 02/05/2025
updatedAt: 21/05/2025
tags:
  - TCC
  - PCL
---
# Panic! in Porcelain

Este é um artigo enxuto com as modificações da linguagem, removendo mecanismos que se provaram insatisfatórios e introduzindo novas ferramentas. O principal são a detecção das violações de memória e emissão dos erros apropriados.

A implementação dessa etapa segue no meu [github](https://github.com/Sacolle/Interpretador-PCL). Sendo esse artigo baseado nesse [commit específico](https://github.com/Sacolle/Interpretador-PCL/commit/2699dcb512dff0e6a621995a186cd614f5e5acb6).

## Sintaxe modificada
Segue-se a modificação da sintaxe:
$$
\begin{align*}
Locals \ni l ::&= l^m \OR l^p &&\\ 
Value \ni v ::&= n \OR l && \\
BinOp \ni op ::&= + | - | * | < | > | = | \land | \lor \\
Expression \ni e ::&= x \OR v \\
&\NLOR e\; op\; e \OR !e  \\
&\NLOR \text{*}e \OR \&x \\
&\NLOR e;e \; \OR \{\,e\,\} \; \\ 
&\NLOR \mathbf{malloc}(e) \OR \mathbf{free}(e, e) \; \\ 
&\NLOR \mathbf{let}\; x[n] \OR e := e \; \\
&\NLOR \mathbf{if}(e) \; e \; \mathbf{else} \; e \; \OR \mathbf{while}(e) \; e \\
&\NLOR f(\bar e) \\ 
&\NLOR \mathbf{panic}\;pcode \\ 
PanicCodes \ni pcodes ::&= \mathbf{OutOfBoundsRead}\\
&\NLOR \mathbf{OutOfBoundsWrite}\\
&\NLOR \mathbf{UseAfterFree}\\
&\NLOR \mathbf{UninitializedAcess}\\
&\NLOR \mathbf{FreeMemoryNotOnHeap}\\
&\NLOR \mathbf{PartialFree}\\
&\NLOR \mathbf{DoubleFree}\\
Function \ni F ::&= \mathbf{let} \; f(\overline{x})\; e \; F \; | \; \mathbf{let}\;() \; e \\
Globals \ni G ::&= \mathbf{global}\; x[n] \;G \;|\; F
\end{align*}
$$
Removido o operador $\mathbf{as}$, pois no contexto de PCL unsafe, o programador pode gerar um código com locais diretamente escritos. No caso, não há mecanismo no compilador que faça essa operação possível. Porém, o único caso de uso frequente é o de checar se um ponteiro é o ponteiro nulo. Assim, na hora de programar existe o macro `NULL`, que expande para a localização na memória, $l^m$, de índice 0.

### Declarações Globais
Um elemento que estava em falta em PCL unsafe foram as declarações globais. Tecnicamente elas não são necessárias, mas o seu custo de implementação é relativamente baixo e com elas há um aumento considerável na expressividade da linguagem. A motivação principal foi a implementação de um `malloc` e um `free` na linguagem, usando uma estrutura global para lidar com segmentos de memória. Essa estrutura talvez seja implementada na transformação das linguagens.

Os globais são avaliados antes das funções e tem o seu espaço alocado na base da pilha. Uma execução de um programa $P$ de PCL unsafe é então:
$$
\begin{align*}
&\text{Globals}_{collect}\\
&\frac{\mathbf{newkey}() = k \quad \mathbf{top}(p) = i}
{\St{\mathbf{global} \; x[n]\; G , g, p} \to_G \St{G, g[x \mapsto l^p \{i, k, 0, n\}],(\bot, k)_n :: p,}} \\
\end{align*}
$$
$$
\begin{align*}
&\frac{\St{P, \{\}, []} \to_G^* \St{F_0, g, p}\quad\St{F_0, \{\}} \to_F^* \St{\mathbf{let}\;()\;e , F}}
{F \vdash \St{\{e\}, ([],g),p,[]} \to^* \St{v, ([],g), p, m}} \\
\end{align*}
$$
Pode-se observar que houve uma modificação no ambiente de nomes (e nas localizações, mas isso será elaborado na próxima sessão). Agora, o ambiente de nomes é uma dupla, com a pilha de mapas anteriores como um elemento e o mapa de nomes globais como segundo elemento. Isso altera as definições das seguintes formas:
Obter valor:
$$
\begin{align*}
	&(frame :: a_r, g)(x) = \mathbf{if}\; frame(x) \neq - \;\mathbf{then}\; frame(x) \;\mathbf{else}\; (a_r, g)(x)\\
	&(\text{STOP} :: a_r, g)(x) = g(x) \\
	&([], g)(x) = g(x)
\end{align*}
$$
Como $g$ é um mapa, caso $x \notin g$, retorna $-$.
Inserir o valor, que se mantem quase inalterado:
$$
\begin{align*}
	&(frame :: a_r, g)[x \mapsto l] = (frame[x \mapsto l] :: a_r, g)\\
\end{align*}
$$

### Ambientes de Memória

A estrutura interna do ponteiro foi modificada para detectar as demais classes erros possíveis na linguagem. Já existia o mecanismo de detecção de não inicialização, inspirado no TCC [The Semantics of Ownership and Borrowing in the Rust Programming Language](https://www.cs.ru.nl/bachelors-theses/2019/Nienke_Wessel___4598350___The_Semantics_of_Ownership_and_Borrowing_in_the_Rust_Programming_Language.pdf), e através dele podia-se as vezes detectar os demais erros. Erros espaciais eram detectável se, na de-referência do ponteiro, o endereço não estava sendo usado por nenhuma outra parte do código. Erros temporais eram detectáveis se a região de memória liberada não tivesse sido novamente ocupada, visto que $\mathbf{free}$ atribuía o valor $-$ ao limpar um segmento. 

Erros de confusão de tipos não eram possíveis também. Devido a semântica operacional, o interpretar avaliava na execução se o elemento era um número $n$ ou uma localizações $l$ e realiza a derivação baseado nisso. Ou seja, não era possível alterar um número e depois de-referenciar como se fosse um ponteiro, pois não há derivações para o caso $\text{*}n$.

Era necessário adicionar mecanismos para detectar as duas classes de erros restantes, e relevantes, ao projeto - erros temporais e espaciais. Para isso foi adicionado meta dados aos ponteiros. A escolha desses atributos foi inspirada em métodos de checagem em tempo de execução para erros de memória, mais especificamente o sistema de _slices_ para a detecção de erros temporais e de _key-lock_ para a detecção de erros espaciais.

O sistema de _slices_ adiciona um campo de tamanho $s$ no ponteiro, que na hora da indexação por um índice $i$, checa se  $0 <= i < s$. Como no contexto de PCL esse sistema deveria funcionar com a aritmética geral  de ponteiros, não só indexações, adicionou-se também um  campo de offset $o$. Assim, no contexto de somas ou subtrações de números aos ponteiros, altera-se o campo $o$ e não a base $p$. Assim, na hora do acesso, avalia se $0 <= o < s$, caso esteja nos limites, acessa a posição de memória $p + o$. Caso contrário, emite o erro espacial apropriado ao contexto.

O sistema de _key-lock_ adiciona um campo com uma chave única $k \in \mathbb{N}\text{*}$ no ponteiro $p$ e associa uma fechadura $l := k$ a região de memória apontada por $p$. Esse valor pode ser guardado em uma tabela global, ou junto a memória alocada. Quando é feito um acesso a $p$, ele é valido se $k = l$. Esse valor de $l$ é alterado no caso de chamadas de liberação de memória, como `free`, atribuindo 0 a $l$. Ou seja, dado que um ponteiro $p$ aponte para uma região de memória já liberada, então quando $p$ for acessado $k \in \mathbb{N}\text{*} \land l = 0 \to k \neq l$. No caso de uma nova alocação nessa região de memória, será associado a esse espaço uma nova chave distinta $k' \in \mathbb{N}\text{*}\!\setminus\!\{k\}$ e fechadura $l' := k'$. Acessos a essa região via o antigo ponteiro $p$ resultarão em um erro, pois $k \neq l'$.
Em PCL, cada célula de memória guarda a fechadura correspondente consigo como uma dupla valor-fechadura . Assim, um acesso a uma posição $i$  no local $local$ com uma chave $k$ é valido se $local(i) = (\_, l_i) \to k = l_i$. Na semântica operacional, as chaves serão geradas pela função $\mathbf{newkey}$(), que sempre resulta em uma chave distinta de todas as chaves geradas anteriormente.
> Na implementação em haskell, a memória e a pilha possuem contadores separados dentro das suas estruturas para gerar as chaves, visto que trabalhar com globais mutáveis em haskell é péssimo. Isso não vai gerar uma colisão pois endereços de pilha só acessam a pilha e endereços de memória só acessam a memória.

Assim, um ponteiro pode ser para a pilha $p$ ou para a memória $m$, contendo a posição de acesso $i$, a chave de acesso $k$, o offset da base $o$, e o espaço alocado $s$. Na derivação, locais são escritos como $l^p$ e $l^m$, se necessário usar os valores internos, eles podem ser expandidos nas formas $l^p \{i, k, o, s\}$ e $l^m \{i, k, o, s\}$ respectivamente. Essa forma expandida é apenas para a derivação e não pode ser acessada durante a escrita do programa.

#### Modificações na pilha

Como descrito no mecanismo _key-lock_, cada posição da pilha agora é uma dupla valor chave. Isso altera levemente as definições, principalmente se tratando da nova forma do ponteiro:

A função de acesso agora utiliza o valor interno do ponteiro somado ao seu offset. Observa-se que nenhum checagem é realizado na função, validações são feitas nas derivações. 
$$
\begin{align*}
	&p(i) = \mathbf{get}(i, length(p) - 1, p) \\
	&\mathbf{get}(i, size, p_v : p_r) = \mathbf{if}\;i = size \;\mathbf{then}\;p_v\;\mathbf{else}\;\mathbf{get}(i, size - 1, p_r)\\
	&\mathbf{get}(\_, \_, []) = (-,0)\\
\end{align*}
$$
Segue as mesmas regras para empilhar, mas agora considerando que uma chave deve ser adicionada junto. Códigos de controle sempre são empilhados com a chave 0. Observa-se que o caso base, quando a pilha é vazia, retorna $(-, 0)$. Esse caso, de realizar um $\mathbf{get}$ para uma posição fora da pilha, só ocorrerá no contexto de erros temporais. Isso pois, antes de chamar a função, há a validação espacial do ponteiro, caso a aritmética tenha realizado um offset $0 > o \ge s$, a avaliação gera um código de erro. Assim, $\mathbf{get}$ só será chamado para ponteiros _in-bounds_. Dessa forma, apontar para fora da pilha só acontece quando há o retorno de um endereço da pilha de dentro de um escopo para fora desse escopo. Como em:
```rust
let outter[1]; // pilha: [\bot]
{
	let a[1]; // pilha: [\bot, scope, \bot]
	outter := &a
};
// aqui outter tem o endereço 2, porém a pilha é [\bot]
```
Esse é um caso claro de violação temporal, mais especificamente de [ReturnOfVariableStackAdress](https://cwe.mitre.org/data/definitions/562.html). Devido a linguagem de implementação, e simplicidade da descrição da estrutura, a função $\mathbf{pop}$ remove os elementos do topo da pilha até o código de controle. Mesmo assim, qual a chave especificamente que gera a violação temporal não é relevante no sistema, dessa forma, essa modelagem desse caso base, com a função $\mathbf{pop}$ removendo o topo da pilha modela e detecta corretamente esses erros de memória.

 Além disso, a função $\mathbf{pop}$ também deve levar em consideração os códigos de controle na forma:
$$
\begin{align*}
	&\mathbf{pop}_{stack}(p) = \mathbf{pop}(p, stack) \\
	&\mathbf{pop}_{func}(p) = \mathbf{pop}(p, func) \\
	&\mathbf{pop}((v, \_) :: t, c_{ctrl}) = \mathbf{if} \; v \neq c_{ctrl} \;\mathbf{then} \; \mathbf{pop}(t, c_{ctrl}) \; \mathbf{else} \; t  \\
	&\mathbf{pop}([], c_{ctrl}) =  [] \\
\end{align*}
$$
Códigos de controle fazem dupla sempre com a chave 0, visto que o seu acesso é sempre inválido. Entretanto, a memória deles nunca será acessada, pois há a validação espacial sempre antes. 
#### Modificações na Memória

A mesma consideração feita na pilha após a adição do sistema de _key-lock_ se estende a memória, sendo necessário, quando inserido na memória, a adição de uma fechadura junto ao valor. 
Para a função $\mathbf{loc}$, tem-se a simples modificação de nomes de variáveis.
$$
\begin{align*}
& \mathbf{loc}(m, n) = \mathbf{loc}'(m, n, 0, 1) \\
& \mathbf{loc}'(m, n_0 , n_1, i) = \mathbf{if}\; m(i) \neq - \; \mathbf{then}\; \mathbf{loc}'(m, n_0, 0, i + 1) \\
	&\quad \mathbf{else}\; \mathbf{if}\; n_0 = n_1 \; \mathbf{then}\; i \;\mathbf{else}\; \mathbf{loc}'(m, n_0, n_1 + 1, i)\\
\end{align*}
$$

Nota-se que a definição de acesso a memória e a pilha agora usa apenas o índice de acesso e não mais o ponteiro inteiro.

### Modificações nas operações binárias

As operações binárias entre número e ponteiros foram reconsideradas. Agora, só há soma e subtração entre ponteiro e número. Entre ponteiros só há os comparadores booleanos, que retornam um número. Entre números não há alterações:
$$
\begin{align*}
& \mathbf{binop}(op, n_1, n_2) = \mathcal{N}^{-1}(\mathbf{binop}'(op, \mathcal{N}(n_1), \mathcal{N}(n_2))) \\
& \mathbf{binop}'(+, N_1, N_2) = N_1 + N_2\\
& \mathbf{binop}'(-, N_1, N_2) = N_1 + N_2\\
& \mathbf{binop}'(*, N_1, N_2) = N_1 + N_2\\
& \mathbf{binop}'(<, N_1, N_2) = \mathbf{if}\; N_1 < N_2 \;\mathbf{then}\; 1 \;\mathbf{else} \;0\\
& \mathbf{binop}'(>, N_1, N_2) = \mathbf{if}\; N_1 > N_2 \;\mathbf{then}\; 1 \;\mathbf{else} \;0\\
& \mathbf{binop}'(=, N_1, N_2) = \mathbf{if}\; N_1 = N_2 \;\mathbf{then}\; 1 \;\mathbf{else} \;0\\
& \mathbf{binop}'(\land, N_1, N_2) = \mathbf{if}\; N_1 \neq 0 \;\mathbf{then}\; (\mathbf{if}\; N_2 \neq 0 \;\mathbf{then}\; 1 \;\mathbf{else} \;0) \;\mathbf{else} \;0\\
& \mathbf{binop}'(\lor, N_1, N_2) = \mathbf{if}\; N_1 \neq 0 \;\mathbf{then}\; 1 \;\mathbf{else} \;(\mathbf{if}\; N_2 \neq 0 \;\mathbf{then}\; 1 \;\mathbf{else} \;0)\\
\\
& \mathbf{binop}(op, n, l^{local}\{i, k, o, s\}) = l^{local}\{i, k, \mathbf{binopnptr}(op, \mathcal{N}(n), o), s\} \\
& \mathbf{binop}(op, l^{local}\{i, k, o, s\}, n) = l^{local}\{i, k, \mathbf{binopnptr}(op, \mathcal{N}(n), o), s\} \\
& \mathbf{binopnptr}(+, N_1, N_2) = N_1 + N_2  \\
& \mathbf{binopnptr}(-, N_1, N_2) = N_1 + N_2  \\
\\
& \mathbf{binop}(op, l^p\{i_1, k_1, o_1, s_1\}, l^p\{i_2, k_2, o_2, s_2\}) = \mathcal{N}^{-1}(\mathbf{binopcomp}(op, i_1 + o_1, i_2 + o_2)) \\
& \mathbf{binopcomp}(<, N_1, N_2) = \mathbf{if}\; N_1 < N_2 \;\mathbf{then}\; 1 \;\mathbf{else} \;0  \\
& \mathbf{binopcomp}(>, N_1, N_2) = \mathbf{if}\; N_1 > N_2 \;\mathbf{then}\; 1 \;\mathbf{else} \;0  \\
& \mathbf{binopcomp}(=, N_1, N_2) = \mathbf{if}\; N_1 = N_2 \;\mathbf{then}\; 1 \;\mathbf{else} \;0  \\
& \mathbf{binopcomp}(\land, N_1, N_2) = \mathbf{if}\; N_1 \neq 0 \;\mathbf{then}\; (\mathbf{if}\; N_2 \neq 0 \;\mathbf{then}\; 1 \;\mathbf{else} \;0) \;\mathbf{else} \;0 \\
& \mathbf{binopcomp}(\lor, N_1, N_2) = \mathbf{if}\; N_1 \neq 0 \;\mathbf{then}\; 1 \;\mathbf{else} \;(\mathbf{if}\; N_2 \neq 0 \;\mathbf{then}\; 1 \;\mathbf{else} \;0)  \\

\end{align*}
$$
$$
\mathbf{not}(v) = \mathcal{N}^{-1}(\mathbf{if}\; \mathcal{N}(v) \neq 0 \;\mathbf{then}\; 0 \;\mathbf{else} \;1)
$$
Nesse processo houve-se uma simplificação na definição de $\mathcal{N}$ e $\mathcal{N}^{-1}$. Como os valores internos dos ponteiros são números matemáticos, e não símbolos da linguagem, não há necessidade de usar essa função de conversão neles. Com isso, pode-se omitir o tipo de valor que seria convertido de volta na função inversa $\mathcal{N}^{-1}$, fazendo-a sempre converter de volta para um número da linguagem.

## Novas derivações com os panics

##### Composição:
$$
\begin{align*}
&\text{Compose}_{step}\\
&\frac{F \vdash \St{e_1,a, p, m} \to \St{e_1',a', p', m'}} 
 {F \vdash \St{e_1;e_2,a, p, m} \to \St{e_1';e_2,a', p', m'}}\\
& \text{Compose}_{combine} \\ 
&\frac{}{F \vdash \St{v;e, a, p, m} \to \St{e, a, p, m}}\\
&\text{Escopo}_{init}\\ 
&\frac{}{F \vdash \St{\{e\},a, p, m} \to \St{\mathbf{pop}\; e,\{\} :: a,stack :: p, m}}\\
&\text{Escopo}_{step} \\ 
&\frac{F \vdash \St{e,a, p, m} \to \St{e',a', p', m'}}
{F \vdash \St{\mathbf{pop}\;e,a, p, m} \to
 \St{\mathbf{pop}\;e',a', p', m'}} \\
& \text{Escopo}_{pop}\\
& \frac{\mathbf{pop}_{stack}(p) = p'}{F \vdash \St{\mathbf{pop}\;v,(frame::a,g), p, m} \to\St{v,(a,g), p', m}}
\end{align*}
$$
##### Atribuições e declarações
Pode-se observar o novo uso dos ponteiros. O $\mathbf{let}$ gera um novo ponteiro com uma chave nova, partindo do antigo topo da pilha, com offset inicial 0 e tamanho $n$. Ele também, ao inserir no topo da pilha, insere os valores com a chave gerada, para validar o acesso.
$$
\begin{align*}
&\text{Let}\\ 
&\frac{\mathbf{top}(p) = i \quad \mathbf{newkey}() = k \quad l = l^p\{i, k, 0, n\}}{F \vdash \St{\mathbf{let}\; x[n],(fr :: a, g), p, m} \to \St{l, (fr[x \mapsto l] :: a, g),(\bot, k)_n :: p, m}} \\
\end{align*}
$$
$$
\begin{align*}
&\text{Atribui-deref}_{left-step}\\
&\frac{F \vdash \St{e_1,a, p, m} \to \St{e_1', a', p', m'}}
{F \vdash \St{\text{*}e_1 := e_2, a, p, m} \to \St{\text{*}e_1' := e_2, a', p', m'}} \\
&\text{Atribui-var}_{right-step}  \\
&\frac{F \vdash \St{e, a, p, m} \to \St{e', a', p', m'}}
{F \vdash \St{x := e, a, p, m} \to \St{x := e', a', p', m'}} \\
&\text{Atribui-deref}_{right-step}\\
&\frac{F \vdash \St{e,a, p, m} \to \St{e', a', p', m'}}
{F \vdash \St{\text{*}l := e, a, p, m} \to \St{\text{*}l := e', a', p', m'}} \\
\end{align*}
$$
Aqui fica um exemplo no caso de atribuição dos pânicos. Se $l$ está _out-of-bounds_ i.e $0 > o \ge s$, então é um $\mathbf{OutOfBoundsWrite}$. Se ele é válido nesse quesito, mas a chave é diferente da fechadura, tem-se um $\mathbf{UseAfterFree}$. No caso da pilha poderia ter se usado o nome mais específico,[ReturnOfVariableStackAdress](https://cwe.mitre.org/data/definitions/562.html), mas esse caso não parecia mapear perfeitamente para a situação atual, então usou-se o descritor mais generalizado. Caso todos esse valores se encaixem, realiza-se a atribuição.
$$
\begin{align*}
&\text{Atribui-var}_{out\text{-}of\text{-}bounds} \\[1pt]
&\frac{a(x) = l^p\{i, k, o, s\} \quad 0 > o \ge s}
{F \vdash \St{x := v, a, p, m} \to \St{\mathbf{panic}\;\mathbf{OutOfBoundsWrite}, a, p, m}} \\
&\text{Atribui-var}_{use\text{-}after\text{-}free} \\[1pt]
&\frac{a(x) = l^p\{i, k, o, s\} \quad 0 \leq o < s\quad p(i + o) = (v_p, k_p) \quad k \neq k_p }
{F \vdash \St{x := v, a, p, m} \to \St{\mathbf{panic}\;\mathbf{UseAfterFree}, a, p, m}} \\
&\text{Atribui-var} \\[1pt]
&\frac{a(x) = l^p\{i, k, o, s\} \quad 0 \leq o < s\quad p(i + o) = (v_p, k_p) \quad  k = k_p }
{F \vdash \St{x := v, a, p, m} \to \St{v, a, p[i + o \mapsto v], m}} \\
\end{align*}
$$
Esse caso é quase um para um com o acima, a diferença é que se usa a notação desconstrução do ponteiro dentro da tupla de avaliação. Isso serve só para simplificar as descrição e não é derivação própria.
$$
\begin{align*}
& \text{Atribui-deref-pilha}_{out\text{-}of\text{-}bounds} \\[1pt]
&\frac{0 > o \ge s}
{F\vdash\St{\text{*}l^p\{i, k, o, s\} := v, a, p, m} \to \St{\mathbf{panic}\;\mathbf{OutOfBoundsWrite}, a, p, m}} \\
& \text{Atribui-deref}_{use\text{-}after\text{-}free} \\[1pt]
&\frac{0 \leq o < s\quad p(i + o) = (v_p, k_p) \quad k \neq k_p }
{F\vdash\St{\text{*}l^p\{i, k, o, s\} := v, a, p, m} \to \St{\mathbf{panic}\;\mathbf{UseAfterFree}, a, p, m}} \\
& \text{Atribui-deref-pilha} \\[1pt]
&\frac{0 \leq o < s\quad p(i + o) = (v_p, k_p) \quad k = k_p }
{F\vdash\St{\text{*}l^p\{i, k, o, s\} := v, a, p, m} \to \St{v, a, p[i + o \mapsto v], m}} \\
\end{align*}
$$
$$
\begin{align*}
& \text{Atribui-deref-mem}_{out\text{-}of\text{-}bounds} \\[1pt]
&\frac{0 > o \ge s}
{F\vdash\St{\text{*}l^m\{i, k, o, s\} := v, a, p, m} \to \St{\mathbf{panic}\;\mathbf{OutOfBoundsWrite}, a, p, m}} \\
& \text{Atribui-deref-mem}_{use\text{-}after\text{-}free} \\[1pt]
&\frac{0 \leq o < s\quad m(i + o) = (v_m, k_m) \quad k \neq k_m }
{F\vdash\St{\text{*}l^m\{i, k, o, s\} := v, a, p, m} \to \St{\mathbf{panic}\;\mathbf{UseAfterFree}, a, p, m}} \\
& \text{Atribui-deref-mem} \\[1pt]
&\frac{0 \leq o < s\quad m(i + o) = (v_m, k_m) \quad k = k_m }
{F\vdash\St{\text{*}l^m\{i, k, o, s\} := v, a, p, m} \to \St{v, a, p, m[i + o \mapsto v]}} \\
\end{align*}
$$
##### Manipulação de memória
$$
\begin{align*}
&\text{Malloc}_{step} \\
&\frac{F\vdash\St{e, a, p, m} \to\St{e', a', p', m'}}{F\vdash\St{\mathbf{malloc}(e),a, p, m} \to\St{\mathbf{malloc}(e'),a', p', m'}} \\
&\text{Malloc} \\
&\frac{\mathbf{loc}(m, n) = i \quad \mathbf{newkey}() = k \quad l = l^m\{i, k, 0, n\}}{F\vdash\St{\mathbf{malloc}(n),a, p, m} \to\St{l, a, p, m[i_{0..n} \mapsto (\bot,k)]}} \\
&\text{Free}_{left-step} \\
&\frac{F\vdash\St{e_1, a, p, m} \to\St{e_1', a', p', m'}}{F\vdash\St{\mathbf{free}(e_1, e_2),a, p, m} \to\St{\mathbf{free}(e_1', e_2),a', p', m'}} \\
&\text{Free}_{right-step} \\
&\frac{F\vdash\St{e, a, p, m} \to\St{e', a', p', m'}}{F\vdash\St{\mathbf{free}(l, e),a, p, m} \to\St{\mathbf{free}(l, e'),a', p', m'}} \\
&\text{Free}\\ 
& \frac{}{F\vdash\St{\mathbf{free}(l^m, n),a, p, m} \to\St{n,a, p, m[l^m_{0..n} \mapsto -]}}\\ 
\end{align*}
$$
$$
\begin{align*}
&\text{Free}_{memory\text{-}not\text{-}on\text{-}heap}\\ 
& \frac{}{F\vdash\St{\mathbf{free}(l^p, n),a, p, m} \to\St{\mathbf{panic}\;\mathbf{FreeMemoryNotOnHeap},a, p, m[l^m_{0..n} \mapsto -]}}\\ 
&\text{Free}_{partial\text{-}free}\\ 
& \frac{o \neq 0 \lor s \neq n}{F\vdash\St{\mathbf{free}(l^m\{i, k, o, s\}, n),a, p, m} \to\St{\mathbf{panic}\;\mathbf{PartialFree},a, p, m}}\\ 
&\text{Free}_{double\text{-}free}\\ 
& \frac{o = 0 \quad s = n \quad m(i) = (v_m, k_m) \quad k \neq k_m}{F\vdash\St{\mathbf{free}(l^m\{i, k, o, s\}, n),a, p, m} \to\St{\mathbf{panic}\;\mathbf{DoubleFree},a, p, m}}\\ 
&\text{Free}\\ 
& \frac{o = 0 \quad s = n \quad m(i) = (v_m, k_m) \quad k = k_m}{F\vdash\St{\mathbf{free}(l^m\{i, k, o, s\}, n),a, p, m} \to\St{n,a, p, m[i_{0..n} \mapsto (-,0)]}}\\ 
\end{align*}
$$
As derivações são relativamente ao explicativas, mas é relevante considerar que no caso do $\mathbf{PartialFree}$, casos em que $o = 0 \land s < n$ limpam toda a memória do ponteiro, mais algum colateral. Como esse contexto não existe em C, decidiu-se adicionar esse caso no contexto do $\mathbf{PartialFree}$.

##### Operações binárias
$$
\begin{align*}
&\text{BinOp}_{left-step} &&\text{BinOp}_{right-step}\\
&\frac{F \vdash \St{e_1,a, p, m} \to \St{e_1', a', p', m'}}
{F \vdash \St{e_1 \;op\; e_2, a, p, m} \to \St{e_1' \;op\; e_2, a', p', m'}} 
&&\frac{F \vdash \St{e,a, p, m} \to \St{e', a', p', m'}}
{F \vdash \St{v \;op\; e, a, p, m} \to \St{v \;op\; e', a', p', m'}} \\
\end{align*}
$$
$$
\begin{align*}
&\text{BinOp}\\
&\frac{\mathbf{binop}(op, v_1, v_2) = v'}
{F \vdash \St{v_1 \;op\; v_2, a, p, m} \to \St{v', a, p, m}} \\
\end{align*}
$$
$$
\begin{align*}
&\text{Not}_{step} &&\text{Not}\\
&\frac{F \vdash \St{e,a, p, m} \to \St{e', a', p', m'}}
{F \vdash \St{!e, a, p, m} \to \St{!e', a', p', m'}}
&&\frac{\mathbf{not}(v) = n}
{F \vdash \St{!v, a, p, m} \to \St{n, a, p, m}} \\
\end{align*}
$$

##### Acesso a valores
O acesso a valores faz as mesmas validações que na atribuição. Há a avaliação adicional para checar se o valor na leitura já foi inicializado. Sendo necessário que o valor na posição seja diferente de $\bot$. Não é necessário checar os outros valores possíveis, como controle e $-$, pois se um ponteiro é _in-bounds_ e vivo $k = l$, então a região só pode conter valores ou $\bot$.
$$
\begin{align*}
&\text{Var}_{out\text{-}bounds\text{-}read}\\
&\frac{a(x) = l^p\{i, k, o, s\} \quad 0 > o \ge s}{F \vdash \St{x, a, p, m} \to \St{\mathbf{panic}\;\mathbf{OutOfBoundsRead}, a, p, m}}\\
&\text{Var}_{use\text{-}after\text{-}free}\\
&\frac{a(x) = l^p\{i, k, o, s\} \quad 0 \leq o < s\quad p(i + o) = (v_p, k_p) \quad k \neq k_p}
{F \vdash \St{x, a, p, m} \to \St{\mathbf{panic}\;\mathbf{UseAfterFree}, a, p, m}} \\
&\text{Var}_{uninitialized\text{-}acess}\\
&\frac{a(x) = l^p\{i, k, o, s\} \quad 0 \leq o < s\quad p(i + o) = (v_p, k_p) \quad k = k_p \quad v_p = \bot}
{F \vdash \St{x, a, p, m} \to \St{\mathbf{panic}\;\mathbf{UninitializedAcess}, a, p, m}} \\
&\text{Var}\\
&\frac{a(x) = l^p\{i, k, o, s\} \quad 0 \leq o < s\quad p(i + o) = (v_p, k_p) \quad k = k_p \quad v_p \neq \bot}
{F \vdash \St{x, a, p, m} \to \St{v_p, a, p, m}} \\
\end{align*}
$$
$$
\begin{align*}
&\text{Ref}\\
&\frac{a(x) = l^p}
{F \vdash \St{\&x, a, p, m} \to \St{l^p, a, p, m}} \\
&\text{Deref}_{step}\\
&\frac{F \vdash \St{e,a, p, m} \to \St{e', a', p', m'}}
{F \vdash \St{\text{*}e, a, p, m} \to \St{\text{*}e', a', p', m'}} 
\\
&\text{Deref-pilha}_{out\text{-}bounds\text{-}read}\\
&\frac{0 > o \ge s}{F \vdash \St{\text{*}l^p\{i, k, o, s\}, a, p, m} \to \St{\mathbf{panic}\;\mathbf{OutOfBoundsRead}, a, p, m}}\\
&\text{Deref-pilha}_{use\text{-}after\text{-}free}\\
&\frac{0 \leq o < s\quad p(i + o) = (v_p, k_p) \quad k \neq k_p}
{F \vdash \St{\text{*}l^p\{i, k, o, s\}, a, p, m} \to \St{\mathbf{panic}\;\mathbf{UseAfterFree}, a, p, m}} \\
&\text{Deref-pilha}_{uninitialized\text{-}acess}\\
&\frac{0 \leq o < s\quad p(i + o) = (v_p, k_p) \quad k = k_p \quad v_p = \bot}
{F \vdash \St{\text{*}l^p\{i, k, o, s\}, a, p, m} \to \St{\mathbf{panic}\;\mathbf{UninitializedAcess}, a, p, m}} \\
&\text{Deref-pilha}\\
&\frac{0 \leq o < s\quad p(i + o) = (v_p, k_p) \quad k = k_p \quad v_p \neq \bot}
{F \vdash \St{\text{*}l^p\{i, k, o, s\}, a, p, m} \to \St{v_p, a, p, m}} \\
\\
&\text{Deref-memória}_{out\text{-}bounds\text{-}read}\\
&\frac{0 > o \ge s}{F \vdash \St{\text{*}l^m\{i, k, o, s\}, a, p, m} \to \St{\mathbf{panic}\;\mathbf{OutOfBoundsRead}, a, p, m}}\\
&\text{Deref-memória}_{use\text{-}after\text{-}free}\\
&\frac{0 \leq o < s\quad m(i + o) = (v_m, k_m) \quad k \neq k_m}
{F \vdash \St{\text{*}l^m\{i, k, o, s\}, a, p, m} \to \St{\mathbf{panic}\;\mathbf{UseAfterFree}, a, p, m}} \\
&\text{Deref-memória}_{uninitialized\text{-}acess}\\
&\frac{0 \leq o < s\quad m(i + o) = (v_m, k_m) \quad k = k_m \quad v_m = \bot}
{F \vdash \St{\text{*}l^m\{i, k, o, s\}, a, p, m} \to \St{\mathbf{panic}\;\mathbf{UninitializedAcess}, a, p, m}} \\
&\text{Deref-memória}\\
&\frac{0 \leq o < s\quad m(i + o) = (v_m, k_m) \quad k = k_m \quad v_m \neq \bot}
{F \vdash \St{\text{*}l^m\{i, k, o, s\}, a, p, m} \to \St{v_m, a, p, m}} \\
\end{align*}
$$

##### Construtos Condicionais
Nenhuma modificação.
$$
\begin{align*}
&\text{If}_{step}\\
&\frac{F \vdash \St{e_1,a, p, m} \to \St{e_1', a', p', m'}}
{F \vdash \St{\mathbf{if}\;(e_1)\; e_2\; \mathbf{else}\; e_3 ,a, p, m} \to \St{\mathbf{if}\;(e_1')\; e_2\; \mathbf{else}\; e_3 ,a', p', m'}} \\
&\text{If}_{true} \\
&\frac{\mathcal{N}(v) \neq 0}
{F \vdash \St{\mathbf{if}\;(v)\; e_1\; \mathbf{else}\; e_2 ,a, p, m} \to \St{e_1, a, p, m}} \\
&\text{If}_{false} \\
&\frac{\mathcal{N}(v) = 0}
{F \vdash \St{\mathbf{if}\;(v)\; e_1\; \mathbf{else}\; e_2 ,a, p, m} \to \St{e_2, a, p, m}} \\
&\text{While} \\
&\frac{}
{F \vdash \St{\mathbf{while}\;(e_1)\; e_2, a, p, m} \to \St{\mathbf{if}\;(e_1)\; (e_2;\mathbf{while}\;(e_1)\; e_2)\; \mathbf{else}\; 0, a, p, m}} \\
\end{align*} \\
$$

##### Funções
Funções se mantém sem alteração.
$$
\begin{align*}
&\text{LetFunction}_{collect}\\
&\frac{}
{\St{\mathbf{let} \; f(\overline{x_i})\; e \; F_0 ,F} \to_F \St{F_0, F[f \mapsto \langle[\overline{x_i}], e\rangle]}} \\
\end{align*}
$$

## Conclusão

Agora PCL unsafe serve ao propósito inicial, modelar e detectar os erros de C. Com essa nova sintaxe e semântica operacional, o trabalho agora move-se para a próxima etapa, que é desenvolver uma linguagem de _front-end_, junto a um método de segurança de memória, para demonstrar a utilidade desses formato e projeto.
