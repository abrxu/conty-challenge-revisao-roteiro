import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.ts";

type StatusRoteiro = "aguardando_marca" | "alteracao_pedida" | "aprovado";

type Versao = {
  numero: number;
  conteudo: string;
  criadaEm: string;
};

type PedidoAlteracao = {
  motivo: string;
  prazo: string;
  solicitadoEm: string;
};

type Roteiro = {
  id: string;
  status: StatusRoteiro;
  versoes: Versao[];
  pedidoAlteracao: PedidoAlteracao | null;
};

const CONTEUDO_V1 = "Abre com o produto na mesa.";
const CONTEUDO_V2 = "Abre com o produto na mão, em close.";
const MOTIVO = "O gancho não mostra o produto.";
const INSTANTE_ANTES_DO_FIM = "2026-10-11T15:00:00.000Z";
const PRAZO_NO_DIA = "2026-10-11";

const apps: FastifyInstance[] = [];

function relogioFixo(iso: string): { now(): Date } {
  const instante = new Date(iso);
  return {
    now() {
      return new Date(instante.getTime());
    },
  };
}

async function abrirApp(iso: string): Promise<FastifyInstance> {
  const app = (await buildApp({ clock: relogioFixo(iso) })) as FastifyInstance;
  apps.push(app);
  return app;
}

afterEach(async () => {
  while (apps.length > 0) {
    const app = apps.pop();
    if (app) {
      await app.close();
    }
  }
});

async function criarRoteiro(
  app: FastifyInstance,
  conteudo: string = CONTEUDO_V1,
): Promise<Roteiro> {
  const resposta = await app.inject({
    method: "POST",
    url: "/roteiros",
    payload: { conteudo },
  });
  expect(resposta.statusCode).toBe(201);
  return resposta.json() as Roteiro;
}

async function lerRoteiro(app: FastifyInstance, id: string): Promise<Roteiro> {
  const resposta = await app.inject({
    method: "GET",
    url: `/roteiros/${id}`,
  });
  expect(resposta.statusCode).toBe(200);
  return resposta.json() as Roteiro;
}

describe("revisão de roteiro", () => {
  it('critério: "Dá para seguir o fluxo inteiro sem adivinhar o estado."', async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);

    const criado = await app.inject({
      method: "POST",
      url: "/roteiros",
      payload: { conteudo: CONTEUDO_V1 },
    });
    expect(criado.statusCode).toBe(201);
    const roteiro = criado.json() as Roteiro;
    expect(roteiro.id).toEqual(expect.any(String));
    expect(roteiro.id.length).toBeGreaterThan(0);
    expect(roteiro).toEqual({
      id: roteiro.id,
      status: "aguardando_marca",
      versoes: [
        {
          numero: 1,
          conteudo: CONTEUDO_V1,
          criadaEm: INSTANTE_ANTES_DO_FIM,
        },
      ],
      pedidoAlteracao: null,
    });

    expect(await lerRoteiro(app, roteiro.id)).toEqual(roteiro);

    const pedido = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: PRAZO_NO_DIA },
    });
    expect(pedido.statusCode).toBe(201);
    const comPedido = pedido.json() as Roteiro;
    expect(comPedido.status).toBe("alteracao_pedida");
    expect(comPedido.pedidoAlteracao).toEqual({
      motivo: MOTIVO,
      prazo: PRAZO_NO_DIA,
      solicitadoEm: INSTANTE_ANTES_DO_FIM,
    });
    expect(await lerRoteiro(app, roteiro.id)).toEqual(comPedido);

    const novaVersao = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/versoes`,
      payload: { conteudo: CONTEUDO_V2 },
    });
    expect(novaVersao.statusCode).toBe(201);
    const revisado = novaVersao.json() as Roteiro;
    expect(revisado.status).toBe("aguardando_marca");
    expect(revisado.pedidoAlteracao).toBeNull();
    expect(revisado.versoes).toEqual([
      {
        numero: 1,
        conteudo: CONTEUDO_V1,
        criadaEm: INSTANTE_ANTES_DO_FIM,
      },
      {
        numero: 2,
        conteudo: CONTEUDO_V2,
        criadaEm: INSTANTE_ANTES_DO_FIM,
      },
    ]);

    const aposVersao = await lerRoteiro(app, roteiro.id);
    expect(aposVersao.status).toBe("aguardando_marca");
    expect(aposVersao.pedidoAlteracao).toBeNull();
    expect(aposVersao.versoes).toHaveLength(2);

    const aprovacao = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/aprovacao`,
    });
    expect(aprovacao.statusCode).toBe(200);
    expect((aprovacao.json() as Roteiro).status).toBe("aprovado");

    const aprovado = await lerRoteiro(app, roteiro.id);
    expect(aprovado.status).toBe("aprovado");
  });

  it('critério: "Pedido de alteração sem motivo ou sem prazo não passa."', async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const roteiro = await criarRoteiro(app);

    const semMotivo = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { prazo: PRAZO_NO_DIA },
    });
    expect(semMotivo.statusCode).toBe(400);

    const semPrazo = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO },
    });
    expect(semPrazo.statusCode).toBe(400);

    const motivoVazio = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: "", prazo: PRAZO_NO_DIA },
    });
    expect(motivoVazio.statusCode).toBe(400);

    const motivoSoEspacos = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: "   ", prazo: PRAZO_NO_DIA },
    });
    expect(motivoSoEspacos.statusCode).toBe(400);

    const atual = await lerRoteiro(app, roteiro.id);
    expect(atual.status).toBe("aguardando_marca");
    expect(atual.pedidoAlteracao).toBeNull();
    expect(atual.versoes).toHaveLength(1);
  });

  it('critério: "O prazo no fuso da marca não vira o dia errado quando o horário UTC já virou." no início e no fim do horário de verão', async () => {
    const ultimoAntesDeAdiantar = "2018-11-04T02:59:59.999Z";
    const primeiroDepoisDeAdiantar = "2018-11-04T03:00:00.000Z";
    const diaQueAdianta = "2018-11-03";

    const antes = await abrirApp(ultimoAntesDeAdiantar);
    const roteiroAntes = await criarRoteiro(antes);
    const pedidoAntes = await antes.inject({
      method: "POST",
      url: `/roteiros/${roteiroAntes.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: diaQueAdianta },
    });
    expect(pedidoAntes.statusCode).toBe(201);
    expect((pedidoAntes.json() as Roteiro).pedidoAlteracao).toEqual({
      motivo: MOTIVO,
      prazo: diaQueAdianta,
      solicitadoEm: ultimoAntesDeAdiantar,
    });

    const depois = await abrirApp(primeiroDepoisDeAdiantar);
    const roteiroDepois = await criarRoteiro(depois);
    const pedidoDepois = await depois.inject({
      method: "POST",
      url: `/roteiros/${roteiroDepois.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: diaQueAdianta },
    });
    expect(pedidoDepois.statusCode).toBe(422);
    expect((await lerRoteiro(depois, roteiroDepois.id)).status).toBe("aguardando_marca");

    const ultimoAntesDeAtrasar = "2019-02-17T02:59:59.999Z";
    const primeiroDepoisDeAtrasar = "2019-02-17T03:00:00.000Z";
    const diaQueAtrasa = "2019-02-16";

    const aindaNoDia = await abrirApp(ultimoAntesDeAtrasar);
    const roteiroAinda = await criarRoteiro(aindaNoDia);
    const pedidoAinda = await aindaNoDia.inject({
      method: "POST",
      url: `/roteiros/${roteiroAinda.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: diaQueAtrasa },
    });
    expect(pedidoAinda.statusCode).toBe(201);
    expect((pedidoAinda.json() as Roteiro).pedidoAlteracao?.solicitadoEm).toBe(
      ultimoAntesDeAtrasar,
    );

    const diaSeguinte = await abrirApp(primeiroDepoisDeAtrasar);
    const roteiroSeguinte = await criarRoteiro(diaSeguinte);
    const pedidoSeguinte = await diaSeguinte.inject({
      method: "POST",
      url: `/roteiros/${roteiroSeguinte.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: diaQueAtrasa },
    });
    expect(pedidoSeguinte.statusCode).toBe(422);
    expect((await lerRoteiro(diaSeguinte, roteiroSeguinte.id)).pedidoAlteracao).toBeNull();
  });

  it('critério: "O prazo no fuso da marca não vira o dia errado quando o horário UTC já virou." durante o horário de verão (UTC-2)', async () => {
    // 2018-12-10T02:30Z é 10/12 às 00:30 em São Paulo (UTC-2). Um fuso fixo de -03:00 leria 09/12.
    const app = await abrirApp("2018-12-10T02:30:00.000Z");
    const roteiro = await criarRoteiro(app);

    const deOntem = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: "2018-12-09" },
    });
    expect(deOntem.statusCode).toBe(422);

    const deHoje = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: "2018-12-10" },
    });
    expect(deHoje.statusCode).toBe(201);
  });

  it('critério: "O prazo no fuso da marca não vira o dia errado quando o horário UTC já virou." às 23h em São Paulo, já dia seguinte em UTC', async () => {
    const instante = "2026-10-12T02:00:00.000Z";
    const app = await abrirApp(instante);
    const roteiro = await criarRoteiro(app);

    const pedido = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: PRAZO_NO_DIA },
    });

    expect(pedido.statusCode).toBe(201);
    const corpo = pedido.json() as Roteiro;
    expect(corpo.status).toBe("alteracao_pedida");
    expect(corpo.pedidoAlteracao).toEqual({
      motivo: MOTIVO,
      prazo: PRAZO_NO_DIA,
      solicitadoEm: instante,
    });
  });

  it('critério: "Roteiro aprovado não aceita nova versão nem novo pedido de alteração."', async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const roteiro = await criarRoteiro(app);

    const aprovacao = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/aprovacao`,
    });
    expect(aprovacao.statusCode).toBe(200);

    const versao = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/versoes`,
      payload: { conteudo: CONTEUDO_V2 },
    });
    expect(versao.statusCode).toBe(409);

    const pedido = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: PRAZO_NO_DIA },
    });
    expect(pedido.statusCode).toBe(409);

    const atual = await lerRoteiro(app, roteiro.id);
    expect(atual.status).toBe("aprovado");
    expect(atual.pedidoAlteracao).toBeNull();
    expect(atual.versoes).toEqual([
      {
        numero: 1,
        conteudo: CONTEUDO_V1,
        criadaEm: INSTANTE_ANTES_DO_FIM,
      },
    ]);
  });

  it("roteiro aprovado com prazo já vencido responde 409, não 422", async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const roteiro = await criarRoteiro(app);

    await app.inject({ method: "POST", url: `/roteiros/${roteiro.id}/aprovacao` });

    const pedido = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: "2026-10-10" },
    });

    expect(pedido.statusCode).toBe(409);
    expect((await lerRoteiro(app, roteiro.id)).status).toBe("aprovado");
  });

  it('critério: "Versão antiga não se perde quando chega uma nova."', async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const roteiro = await criarRoteiro(app);

    const pedido = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: PRAZO_NO_DIA },
    });
    expect(pedido.statusCode).toBe(201);

    const novaVersao = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/versoes`,
      payload: { conteudo: CONTEUDO_V2 },
    });
    expect(novaVersao.statusCode).toBe(201);

    const atual = await lerRoteiro(app, roteiro.id);
    expect(atual.versoes).toEqual([
      {
        numero: 1,
        conteudo: CONTEUDO_V1,
        criadaEm: INSTANTE_ANTES_DO_FIM,
      },
      {
        numero: 2,
        conteudo: CONTEUDO_V2,
        criadaEm: INSTANTE_ANTES_DO_FIM,
      },
    ]);
  });

  it('entrega: "Testes do prazo no último instante do dia"', async () => {
    const instante = "2026-10-12T02:59:59.999Z";
    const app = await abrirApp(instante);
    const roteiro = await criarRoteiro(app);

    const pedido = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: PRAZO_NO_DIA },
    });

    expect(pedido.statusCode).toBe(201);
    expect((pedido.json() as Roteiro).status).toBe("alteracao_pedida");
    expect((pedido.json() as Roteiro).pedidoAlteracao?.solicitadoEm).toBe(instante);
  });

  it('entrega: "Testes do prazo no primeiro instante do dia seguinte"', async () => {
    const app = await abrirApp("2026-10-12T03:00:00.000Z");
    const roteiro = await criarRoteiro(app);

    const pedido = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: PRAZO_NO_DIA },
    });

    expect(pedido.statusCode).toBe(422);
    const atual = await lerRoteiro(app, roteiro.id);
    expect(atual.status).toBe("aguardando_marca");
    expect(atual.pedidoAlteracao).toBeNull();
  });

  it('regra: "Pedido de alteração com prazo que já passou não vale."', async () => {
    const app = await abrirApp("2026-10-12T03:00:00.001Z");
    const roteiro = await criarRoteiro(app);

    const pedido = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: PRAZO_NO_DIA },
    });

    expect(pedido.statusCode).toBe(422);
    const atual = await lerRoteiro(app, roteiro.id);
    expect(atual.status).toBe("aguardando_marca");
    expect(atual.pedidoAlteracao).toBeNull();
    expect(atual.versoes).toHaveLength(1);
  });

  it('regra: "Aprovar encerra a revisão, e a aprovação não reabre."', async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const roteiro = await criarRoteiro(app);

    const primeira = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/aprovacao`,
    });
    expect(primeira.statusCode).toBe(200);
    expect((primeira.json() as Roteiro).status).toBe("aprovado");

    const segunda = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/aprovacao`,
    });
    expect(segunda.statusCode).toBe(409);
    expect(segunda.json()).toEqual({
      erro: "A aprovação encerra a revisão e não reabre.",
    });

    const atual = await lerRoteiro(app, roteiro.id);
    expect(atual.status).toBe("aprovado");
  });

  it("conteúdo vazio ou ausente na criação do roteiro responde 400", async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);

    const vazio = await app.inject({
      method: "POST",
      url: "/roteiros",
      payload: { conteudo: "" },
    });
    expect(vazio.statusCode).toBe(400);

    const ausente = await app.inject({
      method: "POST",
      url: "/roteiros",
      payload: {},
    });
    expect(ausente.statusCode).toBe(400);
  });

  it("consultar roteiro inexistente responde 404", async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const resposta = await app.inject({
      method: "GET",
      url: "/roteiros/inexistente",
    });
    expect(resposta.statusCode).toBe(404);
  });

  it("prazo que não é YYYY-MM-DD responde 400 e o estado não muda", async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const roteiro = await criarRoteiro(app);

    const pedido = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: "11/10/2026" },
    });
    expect(pedido.statusCode).toBe(400);

    const atual = await lerRoteiro(app, roteiro.id);
    expect(atual.status).toBe("aguardando_marca");
    expect(atual.pedidoAlteracao).toBeNull();
  });

  it("prazo com data que não existe no calendário responde 400 e o estado não muda", async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const roteiro = await criarRoteiro(app);

    for (const prazo of ["2026-02-30", "2027-02-29", "2026-13-01", "2026-00-10", "2026-10-00"]) {
      const pedido = await app.inject({
        method: "POST",
        url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
        payload: { motivo: MOTIVO, prazo },
      });
      expect(pedido.statusCode, prazo).toBe(400);
    }

    const atual = await lerRoteiro(app, roteiro.id);
    expect(atual.status).toBe("aguardando_marca");
    expect(atual.pedidoAlteracao).toBeNull();
  });

  it("29 de fevereiro de ano bissexto é um prazo válido", async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const roteiro = await criarRoteiro(app);

    const pedido = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: "2028-02-29" },
    });
    expect(pedido.statusCode).toBe(201);
  });

  it("pedido de alteração em roteiro inexistente responde 404", async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const resposta = await app.inject({
      method: "POST",
      url: "/roteiros/inexistente/pedidos-alteracao",
      payload: { motivo: MOTIVO, prazo: PRAZO_NO_DIA },
    });
    expect(resposta.statusCode).toBe(404);
  });

  it("pedido de alteração com pedido já aberto responde 409", async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const roteiro = await criarRoteiro(app);

    const primeiro = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: PRAZO_NO_DIA },
    });
    expect(primeiro.statusCode).toBe(201);

    const segundo = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: "Outro motivo", prazo: PRAZO_NO_DIA },
    });
    expect(segundo.statusCode).toBe(409);

    const atual = await lerRoteiro(app, roteiro.id);
    expect(atual.status).toBe("alteracao_pedida");
    expect(atual.pedidoAlteracao).toEqual({
      motivo: MOTIVO,
      prazo: PRAZO_NO_DIA,
      solicitadoEm: INSTANTE_ANTES_DO_FIM,
    });
  });

  it("nova versão com conteúdo vazio responde 400", async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const roteiro = await criarRoteiro(app);

    const pedido = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: PRAZO_NO_DIA },
    });
    expect(pedido.statusCode).toBe(201);

    const versao = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/versoes`,
      payload: { conteudo: "" },
    });
    expect(versao.statusCode).toBe(400);

    const atual = await lerRoteiro(app, roteiro.id);
    expect(atual.status).toBe("alteracao_pedida");
    expect(atual.versoes).toHaveLength(1);
  });

  it("nova versão sem pedido de alteração aberto responde 409", async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const roteiro = await criarRoteiro(app);

    const versao = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/versoes`,
      payload: { conteudo: CONTEUDO_V2 },
    });
    expect(versao.statusCode).toBe(409);

    const atual = await lerRoteiro(app, roteiro.id);
    expect(atual.status).toBe("aguardando_marca");
    expect(atual.versoes).toHaveLength(1);
    expect(atual.versoes[0]?.conteudo).toBe(CONTEUDO_V1);
  });

  it("requisição mal formada responde 400 antes da checagem de estado", async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const roteiro = await criarRoteiro(app);

    await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/aprovacao`,
    });

    const versao = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/versoes`,
      payload: { conteudo: "" },
    });
    expect(versao.statusCode).toBe(400);

    const pedido = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: "11/10/2026" },
    });
    expect(pedido.statusCode).toBe(400);
  });

  it("aprovar no meio do pedido de alteração responde 409", async () => {
    const app = await abrirApp(INSTANTE_ANTES_DO_FIM);
    const roteiro = await criarRoteiro(app);

    const pedido = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/pedidos-alteracao`,
      payload: { motivo: MOTIVO, prazo: PRAZO_NO_DIA },
    });
    expect(pedido.statusCode).toBe(201);

    const aprovacao = await app.inject({
      method: "POST",
      url: `/roteiros/${roteiro.id}/aprovacao`,
    });
    expect(aprovacao.statusCode).toBe(409);
    expect(aprovacao.json()).toEqual({
      erro: "Há um pedido de alteração aberto. Envie a nova versão antes de aprovar.",
    });

    const atual = await lerRoteiro(app, roteiro.id);
    expect(atual.status).toBe("alteracao_pedida");
    expect(atual.pedidoAlteracao).not.toBeNull();
  });
});
