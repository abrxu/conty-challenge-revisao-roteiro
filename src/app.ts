import Fastify, { type FastifyError } from "fastify";
import type { Clock } from "./clock.ts";
import { ErroDeRoteiro, type CodigoErro } from "./domain/erros.ts";
import { ServicoRoteiro, type RepositorioRoteiros } from "./domain/roteiro.ts";
import { RepositorioMemoria } from "./repositorio-memoria.ts";

type ComId = { Params: { id: string } };

const params = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string" } },
} as const;

const corpoConteudo = {
  type: "object",
  required: ["conteudo"],
  properties: { conteudo: { type: "string" } },
} as const;

const corpoPedido = {
  type: "object",
  required: ["motivo", "prazo"],
  properties: {
    motivo: { type: "string" },
    prazo: { type: "string", format: "date" },
  },
} as const;

export async function buildApp(deps: { clock: Clock; repositorio?: RepositorioRoteiros }) {
  // Sem coerção: o default do Fastify transformaria {"conteudo": 123} em "123".
  const app = Fastify({ logger: false, ajv: { customOptions: { coerceTypes: false } } });
  const servico = new ServicoRoteiro(deps.repositorio ?? new RepositorioMemoria(), deps.clock);

  app.setErrorHandler<FastifyError>((erro, _request, reply) => {
    if (erro instanceof ErroDeRoteiro) {
      return reply.code(statusDe(erro.codigo)).send({ erro: erro.message });
    }
    const status = erro.statusCode ?? 500;
    if (status < 500) {
      return reply.code(status).send({ erro: erro.message });
    }
    reply.log.error(erro);
    return reply.code(500).send({ erro: "Erro interno." });
  });

  app.post<{ Body: { conteudo: string } }>(
    "/roteiros",
    { schema: { body: corpoConteudo } },
    async (request, reply) => {
      const roteiro = servico.criar(request.body.conteudo);
      return reply.code(201).send(roteiro);
    },
  );

  app.get<ComId>("/roteiros/:id", { schema: { params } }, async (request) => {
    return servico.buscar(request.params.id);
  });

  app.post<ComId & { Body: { motivo: string; prazo: string } }>(
    "/roteiros/:id/pedidos-alteracao",
    { schema: { params, body: corpoPedido } },
    async (request, reply) => {
      const roteiro = servico.pedirAlteracao(request.params.id, request.body);
      return reply.code(201).send(roteiro);
    },
  );

  app.post<ComId & { Body: { conteudo: string } }>(
    "/roteiros/:id/versoes",
    { schema: { params, body: corpoConteudo } },
    async (request, reply) => {
      const roteiro = servico.enviarVersao(request.params.id, request.body.conteudo);
      return reply.code(201).send(roteiro);
    },
  );

  app.post<ComId>("/roteiros/:id/aprovacao", { schema: { params } }, async (request) => {
    return servico.aprovar(request.params.id);
  });

  return app;
}

function statusDe(codigo: CodigoErro): number {
  switch (codigo) {
    case "requisicao_invalida":
      return 400;
    case "prazo_expirado":
      return 422;
    case "conflito":
      return 409;
    case "nao_encontrado":
      return 404;
  }
}
