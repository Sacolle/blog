---
title: Porcelain - Unsafe Porcelain
author: Pedro Colle
createdAt: 07/01/2025
updatedAt: 26/03/2025
tags:
  - TCC
  - PCL
---
# Porcelain - Unsafe Porcelain

Este artigo é uma revisão de [Porcelain - Memory Model](/blog/posts/porcelain-memory-model). Esse artigo anterior dava os inícios da linguagem: explicações, intenções e aspirações. Entretanto a linguagem possuía algumas limitações que precisavam ser revisadas. 

Uma delas é que se propôs adicionar chamada de funções como expressões, entretanto pela divisão entre expressões e declarações da semântica operacional isso não seria possível. Além disso eu não estava satisfeito com a estrutura da pilha. Representá-la como uma pilha de mapas era útil e simples, mas complicava a definição de estruturas na pilha e tornava guardar referências algo incongruente a proposta da linguagem. Também precisava-se adicionar estruturas condicionais como $\mathbf{if}$ e $\mathbf{while}$, pois não estou construindo calculo lambda aqui.

Assim este artigo serve como a reintrodução da linguagem, a sua nova estrutura e novos construtos.
## Base da linguagem Revisada

Dado a vontade de usar chamadas de funções como expressões, as declarações da linguagem anterior foram convertidas em expressões. Agora todos os construtos da linguagem retornam valores, por mais estranho que pareça.
$$
\begin{align*}
Locals \ni l ::&= l^m \OR l^p &&\\ 
LocalNames \ni local ::&= \mathbf{m} \OR \mathbf{p}\\
Value \ni v ::&= n \OR l && \\
BinOp \ni op ::&= + | - | * | < | > | = | \land | \lor \\
Expression \ni e ::&= x \OR v \\
&\NLOR e\; op\; e \OR !e \OR e \; \mathbf{as} \; local \\
&\NLOR \text{*}e \OR \&x \\
&\NLOR e;e \; \OR \{\,e\,\} \; \\ 
&\NLOR \mathbf{malloc}(e) \OR \mathbf{free}(e, e) \; \\ 
&\NLOR \mathbf{let}\; x[n] \OR e :\!n\!= e \; \\
&\NLOR \mathbf{if}(e) \; e \; \mathbf{else} \; e \; \OR \mathbf{while}(e) \; e \\
&\NLOR f(\bar e) \\ 
Function \ni F ::&= \mathbf{let} \; f(\overline{x})\; e \; F \; | \; \mathbf{let}\;() \; e
\end{align*}
$$
- Os símbolos $x$ e $f$ são meta variáveis que representam um nome de variável e um nome de função respectivamente. 
- O símbolo $n$ representa um número inteiro qualquer.
- Os símbolos $l^p$ e $l^m$ representam locais (endereços) na pilha e na memória respectivamente. O símbolo $l$ cobre os dois casos. Um local é uma dupla número natural e tag de local, pilha ou memória.
 
## Modificação dos Ambientes
Nessa nova versão, a pilha precisa ser modificada para acomodar funções. Além disso, é vantajoso remodelar a pilha para que seja indexada por um número, simplificando a implementação de tuplas e unions. Para isso, deve-se adicionar códigos de controle na pilha, para poder retornar de funções, além de um ambiente de nomes, que salva a relação `varname -> varlocation`. 
Assim, tem-se as seguintes estruturas:
- Ambiente de Funções $F$
- O ambiente de Nomes $a$, que contém as associações símbolo-local da linguagem
- A pilha do sistema $p$
- A memória do sistema $m$
Uma avaliação de uma expressão da linguagem tem o seguinte formato:
$F \vdash \langle S, a, p, m \rangle \to \langle S', a', p', m' \rangle$

O $F$ a esquerda da avaliação serve para simplificar a tupla e para indicar que as funções são declaradas estaticamente e não modificadas no sistema de transição normal da linguagem.

### Ambiente de Nomes

O novo ambiente de nomes é exatamente igual a pilha descrita na versão anterior da linguagem. Ela associa símbolos a valores. Neste caso, os valores são especificamente locais de pilha $l^p$.
Para clarificar o funcionamento nesse contexto, o ambiente de nomes é uma pilha de mapas de símbolo para valor. Ao iniciar um novo escopo, empilha-se um novo mapa, e saindo desempilha-se. Ao buscar o valor de um símbolo no código, percorre-se todos os mapas, obtendo o valor mais próximo do topo. 

Com a introdução de funções é importante limitar esse escopo de busca. Dado que função $f$ seja chamada dentro de um escopo $e$, ela não deveria poder acessar o valor desses símbolos contidos em $e$, mesmo que o seu mapa de símbolos de $f$ seja empilhado acima do mapa de símbolos de $e$. Para resolver isso, precisa-se introduzir um código de controle que limita essa busca, no caso de $PCL_{unsafe}$ será $\text{STOP}$. Assim, **ambiente de nomes** é uma pilha em que cada elemento ou é um mapa de variável a local ou é um código de controle $\text{STOP}$.

>A notação utilizada para indicar a inserção, ou atualização caso exista, da variável $x$ com o valor $l$  no mapa $frame$ é $frame[x \mapsto l]$. Para obter qual valor está associado a chave $x$ no mapa $frame$, utiliza-se $frame(x)$. Caso $x$ não exista em $frame$, retorna-se o valor notável $-$. 

>A notação para manipular a pilha é extremamente similar a que a linguagem haskell usa para manipular pilhas. Dado uma pilha $a$, pode-se obter a cabeça e o resto com a notação $a = head :: tail$, sendo $head$ um mapa e $tail$ uma pilha de mapas. A consequência disso é que tail pode ser subsequentemente dividido até a terminação da lista, que é com o valor $[]$. A inserção de elementos na lista é com a mesma notação, então adicionar um frame $frame$ no topo da pilha $a$ é escrever $frame :: a$. Para definir as funções neste trabalho, também será utilizada outra conveniência de haskell que é o casamento de padrões nos argumentos das funções, simplificando a notação.

#### Manipulação do Ambiente de Nomes
Para obter valores do ambiente de nomes, usa-se a notação $a(x)$, em que se obtém o local associado a $x$ mais próximo do topo da pilha.
$$
\begin{align*}
	&(frame :: a_r)(x) = \mathbf{if}\; frame(x) \neq - \;\mathbf{then}\; frame(x) \;\mathbf{else}\; a_r(x)\\
	&(\text{STOP} :: a_r)(x) = - \\
	&[](x) = -
\end{align*}
$$
>Clarificando a notação acima da função $a(x)$: Quando $a$ pode ser dividido em $frame$ e $a_r$ (o restante da pilha), se $x$ existe em $frame$, então retorna o valor de $x$ em $frame$, se não, busca no restante da pilha. Quando $a$ pode ser divido no valor notável $\text{STOP}$ e $a_r$, para a busca e retorna o valor notável de indefinido. O mesmo vale quando faz-se a busca na pilha vazia.

Para fazer atribuições no ambiente de nomes usa-se a notação $a[x \mapsto l]$, em que insere-se $x$ no mapa do topo da pilha com o local $l$ como valor:
$$
\begin{align*}
	&(frame :: a_r)[x \mapsto l] = frame[x \mapsto l] :: a_r \\
\end{align*}
$$
>Nota-se que não foi definido os casos de inserir elementos na pilha quando o topo é $\text{STOP}$ ou quando a pilha é $[]$. Na semântica da linguagem isso não vem a acontecer. Caso ocorram a indefinição impede o próximo passo de execução e indica um erro.

Remover elementos do ambiente de nomes ocorre somente quando um mapa é removido da pilha, sendo usado na transição do pop como $\langle \mathbf{pop}\;v, frame :: a_r, ... \rangle \to \langle v, a_r, ... \rangle$.
### Ambiente de Funções

O novo ambiente de funções serve para salvar os argumentos das funções e o corpo desta em um mapa associado ao nome. Nisso, constrói-se um mapa de $f \mapsto \langle[\overline{x_i}], e \rangle$. A expressão $[\overline{x_i}]$ representa uma lista com 0 ou mais argumentos da função declarada.

#### Manipulação do Ambiente de Funções
Esse mapa é muito mais simples que os demais, pois as declarações de funções são estáticas, não tendo a necessidade de removê-las os editá-las depois de inseridas no mapa. Mesmo assim, define-se $F[f \mapsto \langle\overline{x}, e\rangle]$, como a função que insere no mapa $F$ com a chave $f$ a dupla: lista de argumentos, corpo da função. Para obter a dupla novamente a partir do nome, basta apenas realizar $F(f)$, que obtém a dupla associada com a chave $f$.

### Pilha

A nova pilha é modificada para poder construir estruturas de diferentes tamanhos. Agora, ao invés de uma pilha de mapas, a pilha é uma lista de valores. Esses valores podem ser códigos de controle $c_{ctrl} \in \{\text{stack}, \text{func}\}$ ou valores $v \in \{l, n, \bot, -\}$. Os códigos de controle servem para definir as fronteiras de escopo de função, indicando até onde a deve-se desempilhar. Os valores podem ser números com tamanho e magnitude arbitrária; o valor notável $\bot$, indicando um espaço inicializado, mas não ocupado ainda; e o valor notável $-$, indicando um espaço não inicializado.

> No contexto deste trabalho decidiu-se não lidar com limites nos números inteiros, pois não se considerou vantajoso na análise de segurança de memória.

A pilha é indexável. Considerando pilha de tamanho $n$, o elemento $n - 1$ corresponde ao topo da pilha e o elemento $0$ a base desta. Essa indexação pode ser descrita pelas funções:
$$
\begin{align*}
	&p(l^p) = \mathbf{get}(l^p, length(p) - 1, p) \\
	&\mathbf{get}(l^p, i, p_v : p_r) = \mathbf{if}\;l^p = i \;\mathbf{then}\;p_v\;\mathbf{else}\;\mathbf{get}(l^p, i - 1, p_r)\\
	&\mathbf{get}(\_, \_, []) = -\\
\end{align*}
$$
#### Manipulação da Pilha
Para inserir elementos na pilha, usa-se a mesma notação de lista de haskell. A expressão $\bot :: 1 :: p$, resulta na lista $[\bot, 1, ...p]$. Para inserir mais de um elemento igual no topo da lista, há a notação compacta $v_n$, que indica $n$ elementos $v$ sendo inseridos. Portanto $\bot_4 :: p$, resulta em $[\bot, \bot, \bot, \bot, ...p]$.

Para editar elementos na pilha, usa-se a notação $p[l^p \mapsto v]$. Indicando que o local $l^p$ recebe o valor $v$. Caso deseje alterar vários elementos para o mesmo valor, usa-se a notação $p[l^p_{m...n} \mapsto v]$. Em que $l^p + m$ até $l^p + n - 1$ recebem o valor $v$.

A localização no topo da pilha pode ser obtida utilizando a função $\mathbf{top}(p)$, que retorna o índice $l^p$ do elemento acima do topo da pilha. Como o elemento ao topo de uma pilha de tamanho $n$ é, por definição, o índice $n - 1$, $\mathbf{top}(p)$ retorna $n$, equivalente ao elemento no topo da pilha $+1$.

Para deletar segmentos da pilha, pode-se sobrescrever com o valor $-$, ou remover do fim da lista. Vale a pena definir funções para remover valores até os códigos de controle. Assim define-se $\mathbf{pop}_{stack}(p)$ e $\mathbf{pop}_{func}(p)$, que deletam elementos da pilha até os seus respectivos códigos de controle da seguinte forma:
$$
\begin{align*}
	&\mathbf{pop}_{stack}(p) = \mathbf{pop}(p, stack) \\
	&\mathbf{pop}_{func}(p) = \mathbf{pop}(p, func) \\
	&\mathbf{pop}(h :: t, c_{ctrl}) = \mathbf{if} \; h \neq c_{ctrl} \;\mathbf{then} \; \mathbf{pop}(t, c_{ctrl}) \; \mathbf{else} \; t  \\
	&\mathbf{pop}([], c_{ctrl}) =  [] \\
\end{align*}
$$
### Memória

A memória é a única estrutura que não foi modificada nessa nova versão, sendo agora muito mais parecida com a pilha. A memória é uma lista teoricamente infinita podendo conter os valores $v \in \{l, n, \bot, -\}$. Todos os os campos da lista possuem o valor inicial $-$. 
Para melhor modelar as linguagens _C-like_, é necessário a introdução de um ponteiro nulo. Nesse caso, reserva-se o endereço 0 da memória para essa função.
#### Manipulação da Memória
Como a memória não possui a necessidade de desempilhar, há como simplificar os seus construtos de acesso e atribuição. Para uma memória $m$ e uma localização desta, $l^m$, $m(l^m)$ é o valor da memória na l-ésima posição, e $m[l^m \mapsto v]$ colocar o valor $v$ na l-ésima posição. Com as funções $\mathbf{malloc}$ e $\mathbf{free}$, há a necessidade de atribuir valores a múltiplas localizações contíguas ao mesmo tempo. Dessa forma, a notação $m[l^m_{m..n}\mapsto v]$ atribui da localização $l^m + m$ até a localização $l^n+ n-1$ o valor $v$. 

No caso do $\mathbf{malloc}$ há a necessidade de achar um espaço para a alocação de memória. Assim, define-se a função auxiliar $\mathbf{loc}$ . Ela encontra um espaço na memória com $n$ células não inicializadas, valor $-$, e retorna a localização  da célula que começa essa sequência. 
$$
\begin{align*}
& \mathbf{loc}(m, n) = \mathbf{loc}'(m, n, 0, 1) \\
& \mathbf{loc}'(m, n_0 , n_1, l) = \mathbf{if}\; m(l) \neq -  \; \mathbf{then}\; \mathbf{loc}'(m, n_0, 0, l + 1) \\
	&\quad \mathbf{else}\; \mathbf{if}\; n_0 = n_1 \; \mathbf{then}\; l \;\mathbf{else}\; \mathbf{loc}'(m, n_0, n_1 + 1, l)\\
\end{align*}
$$

## Semântica Small-Step

Agora que $PCL_{unsafe}$ é uma linguagem de expressões, cada termo da linguagem avalia para algum valor. Assim, é necessário revisar todas as definições.
### Composição
Mesmo sendo uma semântica de expressões, a linguagem ainda tem um aspecto imperativo, tendo os operadores de composição $;$ e $\{\}$. É nesta versão de $PCL_{unsafe}$ em que a regra de escopo terá mais utilidade. Dessa forma, tem-se as regras básicas de composição:
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
& \frac{\mathbf{pop}_{stack}(p) = p'}{F \vdash \St{\mathbf{pop}\;v,frame::a, p, m} \to\St{v,a, p', m}}
\end{align*}
$$
Teve-se que mudar a regra de escopo, pois agora ele resolve para um valor, e fazendo $e;\mathbf{pop}$, descartaria o valor de $e$. A palavra chave $\mathbf{pop}$ agora server apenas para diferenciar o primeiro passo do operador $\{\}$, reservando esse para iniciar o processo e empilhar os frames na pilha.

### Atribuições e Declarações
A declaração apresenta uma oportunidade de utilizar a nova pilha de endereços. Adicionando um parâmetro de tamanho na expressão, pode-se representar estruturas de tamanho >1 na pilha, abrindo espaço para tipos de dados mais complexos. Convenciona-se que uma declaração $\mathbf{let}\; x[n]$ não só declara $x$ na pilha e ambiente de nomes e aloca $n$ espaços na pilha,  como resolve para o local de $x$ na pilha.   
$$
\begin{align*}
&\text{Let}\\ 
&\frac{\mathbf{top}(p) = l^p}{F \vdash \St{\mathbf{let}\; x[n],fr :: a, p, m} \to \St{l^p, fr[x \mapsto l^p] :: a,\bot_n :: p, m}} \\
\end{align*}
$$
Assim como o resto da linguagem, as atribuições são modeladas para se assemelhar a C. A semântica de expressões nesse contexto ajuda, pois em atribuições também resultam em um valor em C por exemplo,`return x = 3`, em que se atribui o valor a `x` e retorna esse valor da função também. Em PCL a atribuição $e_1 := e_2$ resulta em $e_1$ recebendo o valor $e_2$ e a expressão inteira resolvendo para o valor de $e_2$.
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
&\text{Atribui-var}  \\
&\frac{a(x) = l^p \quad p(l^p) = \bot \lor v' }
{F \vdash \St{x := v, a, p, m} \to \St{v, a, p[l^p \mapsto v], m}} \\
& \text{Atribui-deref}_{mem} \\
&\frac{m(l^m) \neq -}
{F\vdash\St{\text{*}l^m := v, a, p, m} \to \St{v, a, p, m[l^m \mapsto v]}} \\
& \text{Atribui-deref}_{pilha} \\
&\frac{p(l^p) = \bot \lor v'}
{F\vdash\St{\text{*}l^p := v, a, p, m} \to \St{v, a, p[l^p \mapsto v], m}} \\
\end{align*}
$$

### Manipulação de memória
Para manipular a memória, usa-se as funções pré definidas $\mathbf{free}$ e $\mathbf{malloc}$. A primeira libera $e_2$ espaços de memória a partir de $e_1$, enquanto a segunda encontra $e$ espaços de memória contíguos livres e devolve a localização do inicio deles. Ao se tornar expressão, $\mathbf{free}$ passa a precisar retornar um valor. Convenciona-se que a função retorna a quantidade $n$ de espaços liberados.
$$
\begin{align*}
&\text{Malloc}_{step} \\
&\frac{F\vdash\St{e, a, p, m} \to\St{e', a', p', m'}}{F\vdash\St{\mathbf{malloc}(e),a, p, m} \to\St{\mathbf{malloc}(e'),a', p', m'}} \\
&\text{Malloc} \\
&\frac{\mathbf{loc}(m, n) = l^m}{F\vdash\St{\mathbf{malloc}(n),a, p, m} \to\St{l^m, a, p, m[l^m_{0..n} \mapsto \bot]}} \\
&\text{Free}_{left-step} \\
&\frac{F\vdash\St{e_1, a, p, m} \to\St{e_1', a', p', m'}}{F\vdash\St{\mathbf{free}(e_1, e_2),a, p, m} \to\St{\mathbf{free}(e_1', e_2),a', p', m'}} \\
&\text{Free}_{right-step} \\
&\frac{F\vdash\St{e, a, p, m} \to\St{e', a', p', m'}}{F\vdash\St{\mathbf{free}(l^m, e),a, p, m} \to\St{\mathbf{free}(l^m, e'),a', p', m'}} \\
&\text{Free}\\ 
& \frac{}{F\vdash\St{\mathbf{free}(l^m, n),a, p, m} \to\St{n,a, p, m[l^m_{0..n} \mapsto -]}}\\ 
\end{align*}
$$

### Expressões Aritméticas e Booleanas

Neste contexto de somas e subtrações é importante notar que $n$ representa um número em código, mas não necessariamente um número matemático. Isso vale também para as localizações $l^m$ e $l^p$, que para a computação devem ser tratadas como números. Assim define-se $\mathcal{N}(v)$, que transforma um valor $v$ em um número matemático, sendo esse número representado por $N$. Para converter de volta, de número matemático a número de sintaxe é define-se $\mathcal{N}^{-1}_{type \in \{n, l^p, l^m\}}(N)$, que devolve um número ou localização sintática a partir de um número matemático.

Nesse mesmo contexto de operações binárias, é importante poder converter de locais $l$ a números e vice versa, assim, define-se a semântica do operador $\mathbf{as}$.
$$
\begin{align*}
&\text{As}_{step} \\
&\frac{F\vdash\St{e, a, p, m} \to\St{e', a', p', m'}}{F\vdash\St{e\;\mathbf{as}\;local,a, p, m} \to\St{e'\;\mathbf{as}\;local,a', p', m'}} \\
\end{align*}
$$
$$
\begin{align*}
&\text{As}_{pilha} && \text{As}_{mem} \\
&\frac{\mathcal{N}^{-1}_{l^p}(\mathcal{N}(v)) = l^p_0} 
{F\vdash\St{v\;\mathbf{as}\;\mathbf{p},a, p, m} \to\St{l^p_0,a, p, m}}
&&\frac{\mathcal{N}^{-1}_{l^m}(\mathcal{N}(v)) = l^m_0} 
{F\vdash\St{v\;\mathbf{as}\;\mathbf{m},a, p, m} \to\St{l^m_0,a, p, m}} \\
\end{align*}
$$

Dentro da descrição da linguagem se utilizou da estrutura $op$ para simplificar a descrição das diferentes operações binárias. Esse construto também será utilizado para simplificar a semântica operacional, definindo a operação $\mathbf{binop}(op, v_1,v_2)$:
$$
\begin{align*}
& \mathbf{binop}(op, n_1, n_2) = \mathbf{binop}'(op, \mathcal{N}(n_1), \mathcal{N}(n_2)) \\
& \mathbf{binop}(op, n, l^p) = \mathcal{N}^{-1}_{l^p}(\mathbf{binop}'(op, \mathcal{N}(n), \mathcal{N}(l^p)))\\
& \mathbf{binop}(op,l^p,n) =  \mathcal{N}^{-1}_{l^p}(\mathbf{binop}'(op, \mathcal{N}(l^p), \mathcal{N}(n)))\\
& \mathbf{binop}(op, n, l^m) = \mathcal{N}^{-1}_{l^m}(\mathbf{binop}'(op, \mathcal{N}(n), \mathcal{N}(l^m)))\\
& \mathbf{binop}(op, l^m, n) = \mathcal{N}^{-1}_{l^m}(\mathbf{binop}'(op, \mathcal{N}(l^m), \mathcal{N}(n)))\\
\\
& \mathbf{binop}'(+, N_1, N_2) = \mathcal{N}^{-1}_n(N_1 + N_2)  \\
& \mathbf{binop}'(-, N_1, N_2) = \mathcal{N}^{-1}_n(N_1 + N_2)  \\
& \mathbf{binop}'(*, N_1, N_2) = \mathcal{N}^{-1}_n(N_1 + N_2)  \\
& \mathbf{binop}'(<, N_1, N_2) = \mathcal{N}^{-1}_n(\mathbf{if}\; N_1 < N_2 \;\mathbf{then}\; 1 \;\mathbf{else} \;0)  \\
& \mathbf{binop}'(>, N_1, N_2) = \mathcal{N}^{-1}_n(\mathbf{if}\; N_1 > N_2 \;\mathbf{then}\; 1 \;\mathbf{else} \;0)  \\
& \mathbf{binop}'(=, N_1, N_2) = \mathcal{N}^{-1}_n(\mathbf{if}\; N_1 = N_2 \;\mathbf{then}\; 1 \;\mathbf{else} \;0)  \\
& \mathbf{binop}'(\land, N_1, N_2) = \mathcal{N}^{-1}_n(\mathbf{if}\; N_1 \neq 0 \;\mathbf{then}\; (\mathbf{if}\; N_2 \neq 0 \;\mathbf{then}\; 1 \;\mathbf{else} \;0) \;\mathbf{else} \;0)  \\
& \mathbf{binop}'(\lor, N_1, N_2) = \mathcal{N}^{-1}_n(\mathbf{if}\; N_1 \neq 0 \;\mathbf{then}\; 1 \;\mathbf{else} \;(\mathbf{if}\; N_2 \neq 0 \;\mathbf{then}\; 1 \;\mathbf{else} \;0))  \\
\end{align*}
$$
Por questões de simplicidade, a linguagem atual segue a convenção de que 0 representa falso e qualquer outro valor representa verdadeiro.  Operadores que resultam em valores booleanos retornam 1 para verdadeiro e 0 para falso.
Também escreve-se uma função para a negação, para ela não ficar sozinha:
$$
\mathbf{not}(v) = \mathcal{N}^{-1}_n(\mathbf{if}\; \mathcal{N}(v) \neq 0 \;\mathbf{then}\; 0 \;\mathbf{else} \;1)
$$

Assim pode-se o definir as operações da linguagem:
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

Não pode-se esquecer da manipulação e acesso de variáveis:
$$
\begin{align*}
&\text{Var} &&\text{Ref}\\
&\frac{a(x) = l^p \quad p(l^p) = v }
{F \vdash \St{x, a, p, m} \to \St{v, a, p, m}} 
&&\frac{a(x) = l^p}
{F \vdash \St{\&x, a, p, m} \to \St{l^p, a, p, m}} \\
&\text{Deref}_{step}\\
&\frac{F \vdash \St{e,a, p, m} \to \St{e', a', p', m'}}
{F \vdash \St{\text{*}e, a, p, m} \to \St{\text{*}e', a', p', m'}} \\
&\text{Deref}_{pilha} &&\text{Deref}_{memoria}\\
&\frac{p(l^p) = v }
{F \vdash \St{\text{*}l^p, a, p, m} \to \St{v, a, p, m}} 
&&\frac{m(l^m) = v }
{F \vdash \St{\text{*}l^m, a, p, m} \to \St{v, a, p, m}} \\
\end{align*}
$$


### Construtos Condicionais

Com operadores para lidar com booleanos, define-se então o $\mathbf{if}$ e o $\mathbf{while}$. O valor de retorno da expressão $\mathbf{if}$ é obviamente a o braço da expressão que o condicional toma. Para o $\mathbf{while}$, é necessário uma convenção. Em linguagens funcionais com essa construção, como [Ocaml](https://ocaml.org/), o $\mathbf{while}$ retorna o tipo unidade, $()$, que é uma tupla com 0 elementos. Como $PCL_{unsafe}$ não possui tuplas ou semelhantes, convenciona-se, então, que o $\mathbf{while}$ retorna 0. Zero representa o último valor computado da expressão booleana que é avaliada para realizar cada passo.

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


### Funções

A parte mais complicada dessa implementação é lidar com funções. A mudança para uma linguagem de expressões foi motivada para implementar a chamada de funções como expressões. 
O primeiro passo é salva-las no ambiente de funções. Durante todas as etapas anteriores, o ambiente de funções $F$ focou a esquerda da avaliação ($\vdash$), isso não só simplificava a notação como dava a entender que os passos não alteravam F. Como F agora será modificado, pode-se definir um tipo de transição diferente $\to_F$ que coleta as funções no ambiente $F$. 
$$
\begin{align}
&\text{LetFunction}_{collect}\\
&\frac{}
{\St{\mathbf{let} \; f(\overline{x_i})\; e \; F_0 ,F} \to_F \St{F_0, F[f \mapsto \langle[\overline{x_i}], e\rangle]}} \\
\end{align}
$$
Essa transição pode ser unida com a transição normal para construir uma execução completa de um programa. Nesse caso, a execução de um programa $P$ em PCL unsafe é:
$$
\begin{align}
&\frac{\St{P, \{\}} \to_F^* \St{\mathbf{let}\;()\;e , F}}
{F \vdash \St{\{e\}, [],[],[]} \to^* \St{v, [], [], m}} \\
\end{align}
$$
O asterisco acima das setas indica 0 ou mais passos. Nota-se que com as regras de $\{\}$, se um programa é propriamente tipado e se ele finaliza, ele termina com a pilha e o ambiente de nomes vazio. A memória ainda pode conter valores, mesmo em um programa bem tipado.

A chamada de função é algo mais complicado. É necessário avaliar todos os argumentos antes de se instanciar o corpo da função, evitando erros quando se trata de funções recursivas e variáveis inalcançáveis.
$$
\begin{align*}
&\text{CallFunction}_{eval(m,0)}\\
&\frac{F \vdash \St{e_0,a, p, m} \to \St{e_0',a', p', m'}}
{F \vdash \St{f(e_0, e_{1..m}), a, p, m} \to \St{f(e_0', e_{1..m}), a, p, m}} \\
&\text{CallFunction}_{eval(m,n)}\\
&\frac{F \vdash \St{e_{n+1},a, p, m} \to \St{e_{n+1}',a', p', m'}}
{F \vdash \St{f(v_{0..n}, e_{n+1}, e_{(n + 2)..m}), a, p, m} \to \St{f(v_{0..n}, e_{n+1}', e_{(n + 2)..m}), a', p', m'}} \\
\end{align*} \\
$$
Uma limitação que acabou aparecendo é a passagem de parâmetros para as funções e retorno de elementos destas. Mesmo com a possibilidade de alocar estruturas com tamanho >1 na pilha, a implementação de argumentos de funções com tamanho >1 apresenta desafios. Seria necessário limitar que, quando um argumento é declarado com um tamanho maior que 1, esse seja passado como uma variável que não será reduzida a valor, mas sim a sua localização na pilha. Através de um estrutura tal qual $x :\!n\!= l^p$ seria possível colocar as $n$ posições a partir de $l^p$ nas $n$ posições a partir de $x$. Essa incongruência vai um pouco de encontro a proposta, visto que se uma cópia é necessária, basta passar o ponteiro para a função e manualmente realizar a cópia. Outra coisa é que o retorno das funções é por resolução da expressão e não por localização na pilha, limitando que o valor de retorno tenha tamanho 1. Isso não impede de se utilizar um parâmetro de saída para imitar o retorno de uma estrutura mais complexa.

Considerando esses aspectos, a chamada de função é relativamente simples. Com os parâmetros avaliados, empilha-se os códigos de controles necessários, e instancia declarações e atribuições na ordem de declaração afim de passar os parâmetros para os argumentos das funções. Assim define-se a chamada de função como:
$$
\begin{align*}
&\text{CallFunction}\\
&\frac{F(f) = \langle[\overline{x_i}], e\rangle}
{F \vdash \St{f(\overline{v_i}), a, p, m} \to \St{\mathbf{Fpop}\,\{\ \overline{\mathbf{let}\;x_i[1]; x_i := v_i;} e\}, STOP::a, func :: p, m}} \\
\end{align*} \\
$$
$$
\begin{align*}
&\text{CallFunction}_{step}  && \text{CallFunction}_{pop}\\
&\frac{F \vdash \St{e,a, p, m} \to \St{e',a', p', m'}}
{F \vdash \St{\mathbf{Fpop}\;e,a, p, m} \to \St{\mathbf{Fpop}\;e',a', p', m'}} 
&&\frac{\mathbf{pop}_{func}(p) = p'}
{F \vdash \St{\mathbf{Fpop}\; v, h :: a, p, m} \to \St{v, a, p', m}} \\
\end{align*} \\
$$


## Implementação em Haskell

O [interpretador em Haskell](https://github.com/Sacolle/Interpretador-PCL/blob/main/Porcelainv2.hs) é uma simples tradução da semântica operacional para a linguagem. Haskell é uma ótima linguagem para esse tipo de operação, pois há como fazer casamento de padrões nos argumentos das funções, simplificando e segmentando a implementação.

## Exemplos

Com essa versão mais avançada do código, pode-se traduzir exemplos mais complexos em C. Por exemplo, na linguagem, a checagem por 0 é similar a C, então traduzir um exemplo de iterador é  

#### Iteradores
um exemplo simples que aloca uma lista com tamanho 3 e preenche ela com os valores de 0 a 2.
##### C
```c
#include<stdlib.h>

int main(){
	int i = 3;
	int* m = (int*) malloc(sizeof(int) * i);
	while(-1 < --i){
		m[i] = i;
	}
	// m = [0, 1, 2]
	return 0;
}
```
##### PCL unsafe
```rust

let () 
	let i[1];
	i := 3;

	let m[1];
	m := malloc(i);

	while(-1 < (i := i - 1)){
		*(m + i) := a;
	}
	// m = [Mnull, 0, 1, 2]
	// 0 reservado para o nullptr
```

Essa tradução usa do fato que atribuições retornam os valores da direita, simulando bem o `i--`. Uma coisa interessante que pode ser feita com esses retornos de expressão é que uma declaração e atribuição podem ser feitas na mesma expressão. Em PCL pode ser escrito: `*let x[1] := 5`, nesse caso, pela ordem de avaliação, primeiro realiza o `let`, resultando num local da pilha `*lp := 5` e então realiza-se a atribuição. Nisso simula-se o `int x = 5` sem adicionar mais semântica operacional.
#### Funções
Pode-se pular exemplos básicos e ir diretamente a estruturas de dados mais complexas. Assim, demonstra-se a equivalência com um exemplo de uma árvore binária com uma função de inserir e outra de obter:
```c
#include <stdio.h>
#include <stdlib.h>
struct Btree {
    int x;
    struct Btree* left;
    struct Btree* right;
};

struct Btree* newNode(int val){
    struct Btree* node = (struct Btree*) malloc(sizeof(struct Btree));
    node->x = val;
    node->left = NULL;
    node->right = NULL;
  
    return node;
}

struct Btree* insert(struct Btree* tree, int val){
    if(tree == NULL) return newNode(val);

    if(val > tree->x) tree->right = insert(tree->right, val);
    else tree->left = insert(tree->left, val);
    
    return tree;
}

struct Btree* get(struct Btree* tree, int val){
    if(tree == NULL) return NULL;

    if(val == tree->x) return tree;
    else if(val > tree->x) return get(tree->right, val);
    else return get(tree->left, val);
}

int main(){
    struct Btree* tree = NULL;

    tree = insert(tree, 5);
    tree = insert(tree, 1);
    tree = insert(tree, 7);
    tree = insert(tree, 4);

    struct Btree* tree5 = get(tree, 7);

    return 0;
}

```
PCL
```rust

let newNode(val) {
	let node[1];
	node := malloc(3);
	*node := val;
	*(node + 1) := 0 as m;
	*(node + 2) := 0 as m;
	node
}

let insert(tree, val){
	if (tree == 0) 
		newNode(val)
	else
		if (val > *tree) *(tree + 1) := insert(*(tree + 1), val)
		else *(tree + 2) := insert(*(tree + 2), val);
		tree
}

let get(tree, val){
	if (tree == 0) 
		0 as m
	else
		if (val == *tree)
			tree
		else
			if (val > *tree) get(*(tree + 1), val)
			else get(*(tree + 2), val)
}

let () 
	let tree[1];
	tree := 0 as m;
	tree := insert(tree, 5);
	tree := insert(tree, 1);
	tree := insert(tree, 7);
	tree := insert(tree, 4);
	
	let branch[1];
	branch := get(tree, 7);
	0
```
O exemplo em PCL é mais confuso pois é necessário realizar o offset das estruturas manualmente e os campos destas não são nomeados. Mas eles realizam a mesma coisa, gerando a mesma árvore:
```
  5
 /\
7  1
   /
  4  
```

Essa estrutura pode ser usada para gerar um Bmap. Isso também demonstra uma alta paridade entre as duas linguagem em termos visuais.

Os exemplos foram breves, mais como um overview de $PCL_{unsafe}$. A próxima etapa do projeto é demonstrar como a linguagem emula os erros de memória de C. 
[Porcelain - Emulando os erros de memória de C](/blog/posts/porcelain-emulando-os-erros-de-memoria-de-c)