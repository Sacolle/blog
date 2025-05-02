---
title: Erros de Memória e Porcelain
author: Pedro Colle
createdAt: 26/03/2025
updatedAt: 02/05/2025
tags:
  - TCC
  - PCL
  - Rust
---
# Erros de Memória e Porcelain

> Esse artigo está incompleto. Com a possibilidade de envio deste trabalho como um short paper para o [SBLP](https://cbsoft.sbc.org.br/2025/sblp/), o escopo dele foi alterado. A profundidade da qual estratégias de solução de memória são discutidas talvez não seja necessária para o trabalho final. Essa sessão então é colocada ao ar incompleta, por questão de completude (e de porquê não?), e os tópicos abordados aqui serão revisados na elaboração do trabalho final.

Agora, após [Porcelain - Unsafe Porcelain](/blog/posts/porcelain-unsafe-porcelain), com a definição da linguagem pode-se encaminhar para o próximo passo que é fazer o mapeamento de erros de memória de C para $PCL_{unsafe}$. Nesse passo será definido se a linguagem desenvolvida é um instrumento útil para mapear e reproduzir os erros de memória que ocorrem em C. Inicialmente, precisa-se partir do que são erros de memória e como eles se manifestam na linguagem C.
# Erros de Memória

O artigo [Secure by Design: Google’s Perspective on Memory Safety](https://storage.googleapis.com/gweb-research2023-media/pubtools/pdf/70477b1d77462cfffc909ca7d7d46d8f749d5642.pdf) cobre uma taxonomia específica aos erros de memória que podem ocorrer em um programa. Ele os subdivide nas [seguintes classes](https://storage.googleapis.com/gweb-research2023-media/pubtools/pdf/70477b1d77462cfffc909ca7d7d46d8f749d5642.pdf): Erros espaciais (*space safety*), temporais (*temporal safety*), de tipo (*type safety*), de inicialização (*initialization safety*) e de condição de corrida (*data-race safety*). A vantagem dessas classes para outros métodos de classificação é que cada uma delas mapeia uma série de problemas para classes cuja solução é disjunta das demais. Ou seja, a solução para os problemas advindos de cada uma dessas classes pode ser pensado independentemente, sem gerar conflitos graves. 

Porém há alguns problemas que essas classes não cobrem, por serem muito específicos ou apenas incidentes à erros de memória. O paper [Seven Pernicious kingdoms](https://samate.nist.gov/SSATTM_Content/papers/Seven%20Pernicious%20Kingdoms%20-%20Taxonomy%20of%20Sw%20Security%20Errors%20-%20Tsipenyuk%20-%20Chess%20-%20McGraw.pdf) divide vários tipos de erros que podem acontecer em um programa em sete reinos mais um. Cada um desses é compostos de filos, sub-classes, que descrevem formas de erro mais específicas. O ponteiro nulo é um dos casos em que as classes do google não se encaixam tão bem, mas é um filo direto do reino *Code Quality* (qualidade de código). Além disso, outros reinos como *Errors*, que descreve praticas de código incorretas - focando unicamente no tratamento de exceções, e *Input Validation and Representation* (validação e representação de entrada), que contém filos como *String Termination Error* (erro de terminação de string) e *Format String* (string de formatação), podem direcionar ideias e práticas mais gerais ao desenvolvimento de PCL safe. Isto é, o artigo com a sua classificação apresenta a superfície de erro de software, que direciona e justifica linguagem mais seguras e modernas como Rust.

 [Seven Pernicious kingdoms](https://samate.nist.gov/SSATTM_Content/papers/Seven%20Pernicious%20Kingdoms%20-%20Taxonomy%20of%20Sw%20Security%20Errors%20-%20Tsipenyuk%20-%20Chess%20-%20McGraw.pdf)é muito citado no [CWE](https://cwe.mitre.org/index.html)(enumeração de fraquezas comuns), que é um agregador de falhas e vulnerabilidades de software e hardware. Entidades como [CVE](https://www.cve.org/)(Vulnerabilidade e Exposições Comuns) se utilizam dessas falhas para melhor descrever as vulnerabilidades encontradas (**mundo real**). O CWE de id [1399](https://cwe.mitre.org/data/definitions/1399.html) compreende uma lista de falhas de segurança e de memória. Os nomes de vulnerabilidades e exemplos destes nessa seção são baseados neles.

### Erros Espaciais
Essa classe de erros ocorre quando há manipulação de memória a uma região além do espaço alocado. Erros associados a acessos de memória em buffers podem ser classificados amplamente como [Out-of-Bounds-Read](https://cwe.mitre.org/data/definitions/125.html)ou [Out-of-Bounds-Write](https://cwe.mitre.org/data/definitions/787.html). Podendo ocorrer na [pilha](https://cwe.mitre.org/data/definitions/121.html) ou na [memória](https://cwe.mitre.org/data/definitions/122.html), para o [final](https://cwe.mitre.org/data/definitions/126.html) ou para o [começo](https://cwe.mitre.org/data/definitions/127.html) do buffer, devido a um [calculo incorreto de tamanho do buffer](https://cwe.mitre.org/data/definitions/131.html) ou de [índice de acesso](https://cwe.mitre.org/data/definitions/129.html). Fundamentalmente, esses erros são associados ao acesso arbitrário a memória e à falta de checks adequados.

Um exemplo de um [buffer under-read](https://cwe.mitre.org/data/definitions/127.html), em que não se checa se `idx >= 0`, possivelmente acessando memória antes do ponteiro.
```c
int get_val(int* list, int len, int idx){
	if(idx < len) return list[idx];
	else return -1;
}
```
em $PCL_{unsafe}$
```haskell
let get_val(list, len, idx){
	if(idx < len) *(list + idx)
	else (0 - 1)
}
```

Em PCL pode-se reproduzir os erros associados a [Incorrect Calculation of Buffer Size](https://cwe.mitre.org/data/definitions/131.html). Em que não se aloca o numero certo de elementos para higienizar a entrada. No trecho, era necessário alocar o tamanho máximo vezes 5. Porém, isso é difícil de notar, pois só gerará um erro quando uma string de tamanho máximo com mais de 80% & for usada, coisa que provavelmente só acontecerá no caso de um ataque.
```c
char * sanitize_input(char *user_supplied_string){
	char *dst_buf = (char*) malloc(4*sizeof(char) * MAX_SIZE);  
	if ( MAX_SIZE <= strlen(user_supplied_string) ){
		die("user string too long, die evil hacker!");
	}  
	int dst_index = 0;  
	for (int i = 0; i < strlen(user_supplied_string); i++ ){
		if( '&' == user_supplied_string[i] ){
			dst_buf[dst_index++] = '&';  
			dst_buf[dst_index++] = 'a';  
			dst_buf[dst_index++] = 'm';  
			dst_buf[dst_index++] = 'p';  
			dst_buf[dst_index++] = ';';
		}
		/*  
		else if ('<' == user_supplied_string[i] ){
			//encode to &lt; 
		}*/  
		else dst_buf[dst_index++] = user_supplied_string[i];
	}  
	// o exemplo no CWE não possui essa linha seguinte, o que me parece um erro.
	// Caso, por algum motivo, o buffer não seja incializado zerado, 
	// a string não é terminada. 
	dst_buf[dst_index] = '\0';
	return dst_buf;
}
```
Como $PCL_{unsafe}$ não possui `char`, usa-se o valor numérico dos ascii. 
```rust
let sanitize_input(user_supplied_string){
	let string_size[1];
	string_size := strlen(user_supplied_string); //size da string até o nulo
	let dst_buf[1];
	dst_buf := malloc(4 * 100); //MAX_SIZE hardcoded como 100
	if(101 < string_size){
		*(0 as m) //uso de deref do ponteiro nulo como uma forma tosca de die
	} else 0;
	let dst_index[1];
	dst_index := 0;
	let i[1];
	i := 0;
	while(i < string_size){
		if(*(user_supplied_string + i) = 38){
			*(dst_buf + dst_index) := 38; //&
			dst_index := dst_index + 1;
			*(dst_buf + dst_index) := 97; //a
			dst_index := dst_index + 1;
			*(dst_buf + dst_index) := 109; //m
			dst_index := dst_index + 1;
			*(dst_buf + dst_index) := 112; //p
			dst_index := dst_index + 1;
			*(dst_buf + dst_index) := 59; //;
			dst_index := dst_index + 1
		}else{
			*(dst_buf + dst_index) := *(user_supplied_string + i);
			dst_index := dst_index + 1
		};
		i := i + 1
	};
	*(dst_buf + dst_index) := 0;
	dst_buf
}
```

Todos esses erros podem ser mitigados com uma verificação em tempo de execução se o valor a ser acessado está nos limites do buffer. Isso requer a adição da informação de tamanho aos ponteiros que acessam essa estrutura. Em [cyclone](https://www.cs.umd.edu/~mwh/papers/cyclone-cuj.pdf) essa estrutura é descrita como um *fat-pointers*, adicionando o limite do buffer ao lado do ponteiro (simbolizado com `?`). Como *fat-pointer* descreve genericamente o conceito de um ponteiro mais uma informação adicional, linguagem atuais fazem referência a esse mecanismo como um *slice*. Linguagens compiladas como Rust, Zig e Go se utilizam desse mecanismo para evitar leitura e escrita para fora dos limites do buffer. Esse mecanismo gera um custo em tempo de execução e não evita terminações inesperadas, mas faz com que estas sejam controladas e não gerem erros que podem escalar para erros mais perigosos.

### Erros Temporais
Essa classe de erros ocorre quando há [acesso a uma região de memória não mais ativa no momento](https://cwe.mitre.org/data/definitions/825.html). Ela engloba casos de [use-after-free](https://cwe.mitre.org/data/definitions/416.html) e [use-after-return](https://cwe.mitre.org/data/definitions/562.html), assim como erros associados a função `free` de c. O caso de [use-after-free](https://cwe.mitre.org/data/definitions/416.html),  é uma descrição de todo e qualquer acesso a heap quando o objeto que se encontrava no local já tinha sido liberado. Quando ocorre na pilha, use-after-return, tem um nome mais preciso: [return of stack variable adress](https://cwe.mitre.org/data/definitions/562.html), descreve especificamente o caso de acesso a um endereço na pilha que já foi liberado pelo desempilhamento desta. 
Os dois casos são reproduzíveis em $PCL_{unsafe}$, no caso da *heap*, tem-se:
```c
char* ptr = (char*)malloc (SIZE);  
if (err) {
	abrt = 1;  
	free(ptr);
}  
...  
if (abrt) {
	logError("operation aborted before commit", ptr);
}
```
em PCL
```rust
let ptr[1];
ptr := malloc(10);
if(err){
	abrt := 1;
	free(ptr, 10)
}else 0;
//...
if(abrt){
	logError(ptr)
}else 0;
```

E no caso da pilha tem-se:
 ```c
char* getName() {
	char name[STR_MAX];  
	fillInName(name);  
	return name;
}
```
Em PCL
```rust
let getName(){
	let name[100];
	fillInName(&name);
	name
}
```

Fundamentalmente, a classe lida com leitura e escrita a regiões de memória não estáticas, ou seja, alocações na pilha, que são removidos no fim do escopo; e alocações na memória, que podem ser arbitrariamente de-alocados. 

(TODO trazer alguns dados estatísticos?)
A mitigação dessa classe de erros é a mais ampla e complexa desta lista. Desde a sua invenção em 1959, uma das soluções mais completas presente tem sido o uso de um GC (coletor de lixo), um mecanismo que, através de diversos meios, detecta e retorna memória alocada e não mais utilizada para o OS. Para muitas aplicações o uso de um GC é completamente aceitável. Linguagens como Go conseguem ter alta performance mesmo com o overhead de GC. Porém para certos sistemas, como o kernel de OSs, drivers e sistemas embarcados, o custo de usar um GC pode ser grande demais, assim como em sistemas em que as pausas geradas pelo GC são inaceitáveis.

(TODO eu acho que unique_ptr foi proposto em cyclone)
Outras soluções mantém o gerenciamento de memória manual, porém incluem mecanismos na linguagem para facilitar a administração de alocações e ponteiros. Cyclone é o progenitor, ou disseminador, de muitas dessas ideias, principalmente quanto se trata de linguagens C-like. 

(TODO tem que falar de alguma forma de move e swap)
Cyclone possui ponteiros únicos e ponteiros de contagem de referência (RC) como ferramentas de  controle de *aliasing*. O conceito desses ponteiros advém de diferentes sistemas de tipos, mas é crucial para tipos lineares, que farão uma aparição neste artigo futuramente. Como pode ser inferido, ponteiros únicos não permitem *aliasing*, ou seja, o objeto que apontam pode ser unicamente apontado por eles. Ponteiros únicos (e RC) podem (e devem) ser consumidos ao serem passados a uma função, como no caso de `free`. Assim, deletar um ponteiro único não pode resultar em ponteiros pendurados ou use-after-free. Ponteiros de contagem de referência (RC) mantém um contador global para o número de ponteiros que apontam para um objeto. Quando copiado, incrementa-se o ponteiro e quando deletado, decrementa-se. Caso chegue a 0 o objeto apontado é deletado. Em cyclone, essa cópia e deleção de ponteiros RC é manual, assim como no caso do único, necessitando de uma chamada de função para copiar e para deletar o ponteiro. Na iteração dessa ideia presente em C++, os *smart pointers* - nome da linguagem para os *tracked pointers* - também são usados para controlar o *aliasing* de objetos, mas conectam o seu escopo léxico com o tempo de vida dos seus objetos associados. Com isso, ao saírem de escopo, liberam a memória do objeto que apontam.


Originando em linguagem funcionais, tal como [ML kit](https://www.researchgate.net/publication/220606837_A_Retrospective_on_Region-Based_Memory_Management), cyclone trouxe o regime de gerência de memória baseada em regiões para linguagens imperativas (NOTE foi o primeiro mesmo?). Regiões são caracterizadas pelo regime de gerenciamento, arenas LIFO (último a entrar, primeiro a sair), *reaps*, arenas dinâmicas e a *heap*. Cada uma com as suas regras e os tipos de ponteiros que podem acessar. Inicialmente a linguagem só continha a *heap*, que era GC e arenas LIFO. A partir desses incluiu-se as arenas dinâmicas (add citation) e as reaps (add citation). 
Arenas por si só não resolvem os erros temporais, programas em C e C++ se utilizam desses mecanismos para simplificar e otimizar o gerenciamento de memória. Porém Cyclone não usa arenas nuas, a linguagem as integra no sistema de tipos para validar os seus acessos. Arenas LIFO são usadas em alocações locais, que são descartadas pós computação, sendo locais e liberadas no fim do escopo. Essas arenas também suportam o uso de *tracked pointers* (ponteiro único e ponteiro com contagem de referência) para alocar de de-alocar memória manualmente, tornando-se *reaps*. Isso permite o uso de arenas em contextos em que uma simples operação de incremento de ponteiro não poderia alocar toda a memória necessária, como loops e funções recursivas. Arenas dinâmicas, por fim, são um mecanismo mais refinado, que se utiliza do sistema de tipos construído até então para criar um sistema que pode ser aberto e fechado. Uma arena possui uma chave única, que é consumida ao abrir a região e devolvida quando essa região é fechada. Nisso, enquanto a memória da região é acessível (aberta), ela não pode ser liberada, visto que liberá-la requer a chave.
>(NOTE faltou falar de tempos de vida, de borrow, moves e swaps em cyclone, mas acho que pode-se tratar desses elementos quando se descrever a sua forma em rust, em que pode-se fazer um callback.)


Borrow Checker DO DA BORROW CHECKER


Diferentemente de CG, essas estratégias não previnem vazamentos de memória. Rust não dá garantias desse fato e com a introdução de *reaps* e arenas dinâmicas, cyclone também não pode.
>Falar mais de memory leaks, ou pelo menos de forma complementar ao borrow checker, tipos afim e tipos lineares.

Uma outra solução que vai para um lado completamente diferente é o uso de key-lock checks em tempo de execução para validar os ponteiros. https://dl.acm.org/doi/pdf/10.1145/3586038
>elaborar

### Erros de Inicialização
Essa classe de erros ocorre quando há acesso a uma região de memória alocada, mas ainda [não inicializada](https://cwe.mitre.org/data/definitions/456.html). Nesse caso, a leitura do espaço não inicializado gera valores incoerentes. No caso de [ponteiros](https://cwe.mitre.org/data/definitions/824.html), pode-se acessar locais de memória arbitrários. Tentar usar isso intencionalmente para gerar números aleatórios é UB (e quem teve a ideia deveria se sentir mal). 

Erros de inicialização podem existir em contextos estáticos ou dinâmicos. No caso de variáveis, somatórios (`tuples`, `structs`, `records`, ...) e lista de tamanho fixo, pode-se avaliar a inicialização do campo com uma análise estática de árvore. Para listas de tamanho dinâmico não há como realizar essa avaliação a tempo de compilação, por isso é de preferência que a API da linguagem requeira que a lista seja inicializada com valores base para os campos, evitando acessos a campos não inicializados. Isso também se estende as estruturas estáticas compostas, a inicialização e uso parcial delas pode gerar erros e dificulta a análise. Uma gerência mais restritiva, obrigar o programador a inicializar toda a estrutura não é um regime restritivo e incentiva boas práticas de código.


- PCL unsafe já é capaz de detectar erros de inicialização, pois espaços da memória são inicializados com um $\bot$.
### Erros de Tipos
Essa classe de erros ocorre quando há acesso a uma região de memória com o tipo incorreto de informação de tipo sobre a sua distribuição. Ela ocorre no caso de cast incorretos de pointers tanto para tipos de tamanhos diferentes, como com layouts diferentes. 
Essa classe de erros é interessante pois é nela em que há a maior intersecção com *undefined behavior*. UB é um tópico complicado e um buraco sem fundo que não será elaborado sobre. Mas, brevemente, o erro no caso do cast pode ser de ler a memória incorretamente, mas também pode ser por alguma otimização do compilador, que ou mudou o layout do objeto de origem/destino, ou alterou o resultado da operação pois a ação era UB.

### Erros de condição de corrida
Não é do escopo deste projeto.
- Há técnicas pra lidar com isso.



### Construções adicionais

Nessa etapa também cabe a discussão de construções adicionais das linguagens. Certo elementos possuem comportamentos emergentes e efeitos no código que podem aumentar ou diminuir a superfície de erro de um programa, assim como interagir com múltiplas classes de erros ao mesmo tempo.

### Free

 A função `free` da `stdlib` de c deveria ter sido discorrida junto dos outros erros temporais anteriormente, mas o mapeamento para $PCL_{unsafe}$ é inexato e requer uma discussão adicional. Erros como  [double-free](https://cwe.mitre.org/data/definitions/415.html) assim como  [free of memory not on the heap](https://cwe.mitre.org/data/definitions/590.html), [free of pointer not at start of buffer](https://cwe.mitre.org/data/definitions/761.html)e [release of invalid pointer or reference](https://cwe.mitre.org/data/definitions/763.html) são associados a corrupção da estrutura de memória que o `free` guarda para gerir as alocações. Devido a isso, elas não são mapeáveis um a um em PCL, pois decidiu-se utilizar de funções de alocação e desalocações mais triviais por simplicidade. Isso não significa que o princípio dos erros não existe. A versão de alocação de memória em PCL unsafe é substancialmente mais perigosa que os erros associados ao free, podendo liberar qualquer região de memória. Um exemplo disso seria o comando `free(0 as m, 1000000)`, que libera toda a memória do programa. Mas o sistema de gerência de memória de PCL incorpora os princípios de insegurança de C, pois ainda pode ocorrer liberações incorretas e imparciais de memória, mesmo que agora o espaço para erro seja muito maior.

Uma coisa que é reproduzível é o de alocadores como estruturas locais, tendo que ser passados para funções, visto que $PCL_{unsafe}$ não tem escopo global. Isso é um padrão visto na linguagem [Zig](https://ziglang.org/), que requer todas as alocações usem um alocador explícito. Nisso pode-se usar o `malloc` e `free` de $PCL_{unsafe}$ como se fossem funções do kernel e implementar um alocador com um algoritmo como [bget](https://www.fourmilab.ch/bget/). Assim pode-se reproduzir a corrupção de uma estrutura de controle na linguagem.

>Nota: introduzir um mecanismo para poder-se declarar um estado global no programa, como um `global { ... }` que pode ser declarado no topo do programa, antes das funções.

#### De-referenciando o ponteiro nulo

Um erro muito relevante e recorrente nos [CVE]s é o [de-referenciar o ponteiro](https://cwe.mitre.org/data/definitions/476.html). Mesmo não se encaixando bem nas classes de erros do [google], a sua inclusão no [Seven pernicious kindoms] faz dele uma discussão relevante. O ponteiro nulo é um valor explícito dado a um ponteiro para evitar erros de inicialização e indicar a ausência de um valor. Esse mecanismo cria uma superfície de erro no código, principalmente em linguagem em que não tem indicação da possibilidade de nulo no sistema de tipos. De-referenciar o ponteiro nulo leva a crashes pelo OS, o que não é ideal, e em caso de certos embarcados, pode levar a execução de código arbitrário.

Linguagem com um GC tendem a checar se um ponteiro é nulo antes de acessar o valor, como Go e Java. Em cyclone, foi introduzido o ponteiro `@`, que indica que o valor apontado não é nulo. Isso otimiza as checagem para apenas no caso do ponteiro genérico `*`, que ainda pode ser nulo, e na conversão de `*` a `@`. Outro mecanismo presente é o de referências, que não podem ser nulas. Elas existem em C++ e são extremamente úteis, mas sem a existência de um mecanismo conveniente de indicar a ausência de um valor, como tipos somatórios (`Option`, `Maybe` ...), é um mecanismo que as vezes vai de encontro a intenção do programador. Rust também se usa de referências, de forma mais robusta com o uso de tempos de vida, tópico para a seção de erros temporais, e tem um sistema de somatórios ótimos para indicar a ausência de valor e mais.

#### Exceções

São o demônio. Quebram o control flow e levam a erros temporais.
- Seven pernicious kingdoms

#### Iteradores
Uma estrutura comum em linguagens como C++ JAVA são os iteradores. Nele, utiliza-se de um ponteiro pra o começo e um para o final de uma lista, atravessando-a e incrementando um ponteiro, inicializado com o início, até que este seja igual ao fim. Nesse processo pode-se ocorrer a invalidação desse iterador, que é quando uma região de memória, a que estava sendo iterada sobre, é movida enquanto há um ponteiro lendo ela, gerando um *dangling pointer*. Isso geralmente ocorre quando se itera sobre uma estrutura dinâmica como um vetor e se adiciona elementos a ele além de sua capacidade, forçando uma realocação. Isso move o buffer interno, levando ao ponteiro que está iterando sobre a lista a apontar para memória possivelmente incompleta ou não inicializada. 
Um exemplo do padrão de iteradores aplicados a uma estrutura em C e a seguir uma implementação do mesmo trecho, reproduzindo o erro em $PCL_{unsafe}$. Nele, tenta-se dobrar um vetor usando `push` enquanto se itera sobre ele para obter os valores. Isso gera uma realocação e o ponteiro do iterador pode apontar para qualquer coisa.
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct vec{
    int size;
    int cap;
    int* list;
} Vec;

void vec_new(Vec* vec){
    #define VEC_INIT_CAP 4
    int* mem = (int*) malloc(VEC_INIT_CAP);

    vec->size = 0;
    vec->cap = VEC_INIT_CAP;
    vec->list = mem;
}

void vec_push(Vec* vec, int val){
    if(vec->size == vec->cap){
        vec->cap *= 2; //double the capacity
        // realocate
        int* mem = (int*) malloc(vec->cap * sizeof(int));
        memcpy(mem, vec->list, sizeof(int) * vec->size);
        free(vec->list);
        vec->list = mem;
    }
    vec->list[vec->size] = val;
    vec->size++;
}
int* vec_start(Vec* vec){
    return vec->list;
}
int* vec_end(Vec* vec){
    return vec->list + vec->size;
} 
  
int main(){
    Vec vec;
    vec_new(&vec);
	vec_push(&vec, 3);
	vec_push(&vec, 7);
	vec_push(&vec, 9);

    //double the vec, re aloca e explode
    for(int* ptr = vec_start(&vec); ptr < vec_end(&vec); ptr++){
        vec_push(&vec, *ptr);
    }
   
    return 0;
}
```
Em $PCL_{unsafe}$:
```rust
let newVec(vec) {
	*vec := 0;
	*(vec + 1) := 4;
	*(vec + 2) := malloc(4);
	vec
}

let push(vec, val){
	if (*vec = *(vec + 1)){
		let newCap[1];
		newCap := *(vec + 1) * 2;
		let newMem[1];
		newMem := malloc(newCap);
		// copy the memory
		let i[1];
		i := 0;
		while(i < *vec){
			*(newMem + i) := *(*(vec + 2) + i);
			i := i + 1
		};
		free(*(vec + 2), *(vec + 1));
		*(vec + 1) := newCap;
		*(vec + 2) := newMem;
		1
	}
	else 1;
	*(*(vec + 2) + *vec) := val;
	*vec := *vec + 1;
	1
}
let start(vec) *(vec + 2)
let end(vec) *(vec + 2) + *vec
let (){
	let vec[3];
	newVec(&vec);
	push(&vec, 3);
	push(&vec, 7);
	push(&vec, 9);

	//double the vec
	let ptr[1];
	let end[1];
	ptr := start(&vec);
	end := end(&vec);
	while(ptr < end){
		push(&vec, *ptr);
		ptr := ptr + 1
	};
	0
}
```

Iteradores não são exclusivos a listas, podendo ser implementados para uma série de estruturas de dados (mapas, árvores, grafos...), em que esse problema se mantém. Em linguagem interpretadas (mesmo que em bytecode), esses erros podem ser capturados pelo interpretador, mas no caso de C++, em que o padrão de iteradores é comum, não há nenhum mecanismo interno a linguagem para lidar com isso, além de não errar.

O que iteradores demonstram é um tipo de erro mais generalizado. O ato de mover uma região de memória enquanto há ponteiros ativos para a região gera um erro temporal/espacial. O uso de regiões de memória em cyclone ajuda, mas não soluciona o problema. Rust possui duas soluções para o problema. A primeira é limitar o número e tipo de ponteiros para um objeto, podendo haver `n` referências imutáveis a um objeto ou (xor) uma referência mutável. Isso previne que na iteração o objeto se mova, pois ele não pode ser modificado como um todo, apenas o elemento no índice da iteração. Para comportamento mais complexo, principalmente quanto de trata de estruturas auto referenciais, há os mecanismos [`Pin` e `Unpin`](https://rust-lang.github.io/async-book/04_pinning/01_chapter.html#pinning-in-practice), mas estes são melhores entendidos como contratos entre APIs e programadores, não sendo integrados fortemente no sistema de tipos. 


[Seven Pernicious kingdoms](https://samate.nist.gov/SSATTM_Content/papers/Seven%20Pernicious%20Kingdoms%20-%20Taxonomy%20of%20Sw%20Security%20Errors%20-%20Tsipenyuk%20-%20Chess%20-%20McGraw.pdf) contém na citação 13 o paper de CWE e na citação 7 o paper do CVE.
[ciclone](https://cyclone.thelanguage.org/)
[ciclone memory managment](https://www.cs.umd.edu/projects/PL/cyclone/scp.pdf)
