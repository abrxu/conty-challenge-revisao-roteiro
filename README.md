# Revisão de roteiro

API para a marca pedir alteração de um roteiro, com motivo e prazo, e para o criador enviar outra versão sem perder as anteriores. Aprovar encerra a revisão.

## Como rodar

Requer Node 22.6 ou superior, porque o `npm start` usa `--experimental-strip-types`.

```bash
npm install
npm test
npm run typecheck
npm start
```

A API sobe em `http://localhost:3000` (`PORT` muda a porta). Os dados ficam só em memória: reiniciar o processo apaga os roteiros.

## Exemplos

Criar a primeira versão. O estado já vem na resposta.

```bash
curl -s -X POST http://localhost:3000/roteiros \
  -H 'content-type: application/json' \
  -d '{"conteudo":"Abre com o produto na mesa."}'
```

```json
{
  "id": "7c1b9a2e-4f0d-4a6b-9c31-2e8d5a0b6f14",
  "status": "aguardando_marca",
  "versoes": [
    {
      "numero": 1,
      "conteudo": "Abre com o produto na mesa.",
      "criadaEm": "2026-10-11T15:00:00.000Z"
    }
  ],
  "pedidoAlteracao": null
}
```

Pedir alteração. `prazo` é um dia `YYYY-MM-DD` no fuso da marca (`America/Sao_Paulo`). O último instante desse dia ainda vale. Os exemplos supõem o relógio em `2026-10-11T15:00:00Z` (e `18:30` na versão 2); com o relógio real, um prazo que já passou responde 422, então ao testar use uma data de hoje em diante.

```bash
curl -s -X POST http://localhost:3000/roteiros/7c1b9a2e-4f0d-4a6b-9c31-2e8d5a0b6f14/pedidos-alteracao \
  -H 'content-type: application/json' \
  -d '{"motivo":"O gancho não mostra o produto.","prazo":"2026-10-11"}'
```

```json
{
  "id": "7c1b9a2e-4f0d-4a6b-9c31-2e8d5a0b6f14",
  "status": "alteracao_pedida",
  "versoes": [
    {
      "numero": 1,
      "conteudo": "Abre com o produto na mesa.",
      "criadaEm": "2026-10-11T15:00:00.000Z"
    }
  ],
  "pedidoAlteracao": {
    "motivo": "O gancho não mostra o produto.",
    "prazo": "2026-10-11",
    "solicitadoEm": "2026-10-11T15:00:00.000Z"
  }
}
```

Enviar outra versão. A anterior continua na lista e o status volta para `aguardando_marca`.

```bash
curl -s -X POST http://localhost:3000/roteiros/7c1b9a2e-4f0d-4a6b-9c31-2e8d5a0b6f14/versoes \
  -H 'content-type: application/json' \
  -d '{"conteudo":"Abre com o produto na mão, em close."}'
```

```json
{
  "id": "7c1b9a2e-4f0d-4a6b-9c31-2e8d5a0b6f14",
  "status": "aguardando_marca",
  "versoes": [
    {
      "numero": 1,
      "conteudo": "Abre com o produto na mesa.",
      "criadaEm": "2026-10-11T15:00:00.000Z"
    },
    {
      "numero": 2,
      "conteudo": "Abre com o produto na mão, em close.",
      "criadaEm": "2026-10-11T18:30:00.000Z"
    }
  ],
  "pedidoAlteracao": null
}
```

Aprovar. O status fica `aprovado` e um segundo pedido de aprovação responde 409.

```bash
curl -s -X POST http://localhost:3000/roteiros/7c1b9a2e-4f0d-4a6b-9c31-2e8d5a0b6f14/aprovacao
```

```json
{
  "id": "7c1b9a2e-4f0d-4a6b-9c31-2e8d5a0b6f14",
  "status": "aprovado",
  "versoes": [
    {
      "numero": 1,
      "conteudo": "Abre com o produto na mesa.",
      "criadaEm": "2026-10-11T15:00:00.000Z"
    },
    {
      "numero": 2,
      "conteudo": "Abre com o produto na mão, em close.",
      "criadaEm": "2026-10-11T18:30:00.000Z"
    }
  ],
  "pedidoAlteracao": null
}
```

Consultar o estado atual, incluindo todas as versões:

```bash
curl -s http://localhost:3000/roteiros/7c1b9a2e-4f0d-4a6b-9c31-2e8d5a0b6f14
```

Criar, pedir alteração e enviar versão respondem 201. Aprovar e consultar respondem 200. Roteiro inexistente responde 404.

Pedido sem motivo ou sem prazo responde 400. Prazo que já passou responde 422. Roteiro aprovado não aceita versão nova nem outro pedido de alteração (409). Quando mais de uma regra falha, a ordem é: formato da requisição (400), estado do roteiro (409), prazo (422).

## Estados

| Status | O que a marca pode fazer | O que o criador pode fazer |
| --- | --- | --- |
| `aguardando_marca` | Pedir alteração ou aprovar | Esperar |
| `alteracao_pedida` | Esperar a nova versão | Enviar outra versão |
| `aprovado` | Nada: a revisão encerrou | Nada: a revisão encerrou |

## Decisões

- O prazo é um dia civil em `America/Sao_Paulo`. O pedido vale quando a data local nesse fuso ainda é o dia do prazo. Em um dia comum, 23:59:59.999 ainda vale e 00:00:00.000 do dia seguinte já não vale. Se o relógio adianta ou atrasa, vale o dia que o fuso mostra, e não a data em UTC.
- O prazo trava só o pedido de alteração. Com o pedido já aberto, a versão nova entra mesmo depois desse dia.
- O relógio entra por injeção (`Clock`). O domínio não chama `Date.now()`.
- Cada resposta devolve o roteiro inteiro (`status`, `versoes`, `pedidoAlteracao`) para o próximo passo não depender de memória de chat.
- Ao enviar a nova versão, o pedido aberto sai do campo `pedidoAlteracao`. As versões anteriores permanecem.
- O formato da requisição (campos obrigatórios, texto, dia `YYYY-MM-DD` que existe) é checado pelo schema das rotas no Fastify, sem coerção de tipos: `{"conteudo": 123}` responde 400. O domínio fica com as regras: motivo não vazio, prazo vencido e estado.
- Todo erro sai como `{ "erro": "..." }`. As regras respondem em português; as mensagens de validação do schema saem como o Ajv as gera, em inglês. Erro inesperado responde 500 com `"Erro interno."`, sem detalhes.

## O que ficou de fora

Ficou de fora vídeo, upload, interface, autenticação de marca e criador, persistência entre reinícios e mais de um fuso por marca. Também ficou de fora o histórico dos pedidos de alteração já respondidos: só o pedido aberto aparece na resposta.

## O que eu faria diferente com mais tempo

Guardaria cada pedido junto da versão que ele revisou, em vez de zerar `pedidoAlteracao` quando a versão nova chega. Trocaria a memória por SQLite, separaria quem é a marca e quem é o criador, e leria o fuso da marca em vez de fixar `America/Sao_Paulo`.

## Uso de IA

<!-- PREENCHER: o que foi feito com IA e o que revisei -->
