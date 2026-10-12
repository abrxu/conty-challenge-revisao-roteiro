import Fastify, { type FastifyError, type FastifyRequest } from "fastify";
import type { Clock } from "./clock.ts";
import { ErroDeRoteiro, type CodigoErro } from "./domain/erros.ts";
import { ServicoRoteiro, type RepositorioRoteiros } from "./domain/roteiro.ts";
import { RepositorioMemoria } from "./repositorio-memoria.ts";

export async function buildApp(deps: { clock: Clock; repositorio?: RepositorioRoteiros }) {
  const app = Fastify({ logger: false });
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

  app.post("/roteiros", async (request, reply) => {
    const roteiro = servico.criar(campo(request, "conteudo"));
    return reply.code(201).send(roteiro);
  });

  app.get("/roteiros/:id", async (request) => {
    return servico.buscar(idDe(request));
  });

  app.post("/roteiros/:id/pedidos-alteracao", async (request, reply) => {
    const roteiro = servico.pedirAlteracao(idDe(request), {
      motivo: campo(request, "motivo"),
      prazo: campo(request, "prazo"),
    });
    return reply.code(201).send(roteiro);
  });

  app.post("/roteiros/:id/versoes", async (request, reply) => {
    const roteiro = servico.enviarVersao(idDe(request), campo(request, "conteudo"));
    return reply.code(201).send(roteiro);
  });

  app.post("/roteiros/:id/aprovacao", async (request) => {
    return servico.aprovar(idDe(request));
  });

  return app;
}

function idDe(request: FastifyRequest): string {
  const params = request.params as { id?: string };
  return params.id ?? "";
}

function campo(request: FastifyRequest, nome: string): unknown {
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
    return undefined;
  }
  return (request.body as Record<string, unknown>)[nome];
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
