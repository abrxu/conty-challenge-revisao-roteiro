import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import type { Clock } from "./clock.js";
import { ErroDeRoteiro, type CodigoErro } from "./domain/erros.js";
import { ServicoRoteiro } from "./domain/roteiro.js";
import { RepositorioMemoria } from "./repositorio-memoria.js";

export async function buildApp(deps: { clock: Clock }) {
  const app = Fastify({ logger: false });
  const servico = new ServicoRoteiro(new RepositorioMemoria(), deps.clock);

  app.post("/roteiros", async (request, reply) => {
    try {
      const roteiro = servico.criar(campo(request, "conteudo"));
      return reply.code(201).send(roteiro);
    } catch (erro) {
      return responder(reply, erro);
    }
  });

  app.get("/roteiros/:id", async (request, reply) => {
    try {
      return servico.buscar(idDe(request));
    } catch (erro) {
      return responder(reply, erro);
    }
  });

  app.post("/roteiros/:id/pedidos-alteracao", async (request, reply) => {
    try {
      const roteiro = servico.pedirAlteracao(idDe(request), {
        motivo: campo(request, "motivo"),
        prazo: campo(request, "prazo"),
      });
      return reply.code(201).send(roteiro);
    } catch (erro) {
      return responder(reply, erro);
    }
  });

  app.post("/roteiros/:id/versoes", async (request, reply) => {
    try {
      const roteiro = servico.enviarVersao(idDe(request), campo(request, "conteudo"));
      return reply.code(201).send(roteiro);
    } catch (erro) {
      return responder(reply, erro);
    }
  });

  app.post("/roteiros/:id/aprovacao", async (request, reply) => {
    try {
      return servico.aprovar(idDe(request));
    } catch (erro) {
      return responder(reply, erro);
    }
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

function responder(reply: FastifyReply, erro: unknown) {
  if (erro instanceof ErroDeRoteiro) {
    return reply.code(statusDe(erro.codigo)).send({ erro: erro.message });
  }
  throw erro;
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
