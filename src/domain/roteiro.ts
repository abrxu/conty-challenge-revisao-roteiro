import { ErroDeRoteiro } from "./erros.ts";
import { prazoAindaVale } from "./prazo.ts";

export type StatusRoteiro = "aguardando_marca" | "alteracao_pedida" | "aprovado";

export type Versao = {
  numero: number;
  conteudo: string;
  criadaEm: string;
};

export type PedidoAlteracao = {
  motivo: string;
  prazo: string;
  solicitadoEm: string;
};

export type Roteiro = {
  id: string;
  status: StatusRoteiro;
  versoes: Versao[];
  pedidoAlteracao: PedidoAlteracao | null;
};

export function criarRoteiro(id: string, conteudo: string, agora: Date): Roteiro {
  return {
    id,
    status: "aguardando_marca",
    versoes: [montarVersao(1, conteudo, agora)],
    pedidoAlteracao: null,
  };
}

export function pedirAlteracao(
  roteiro: Roteiro,
  entrada: { motivo: string; prazo: string },
  agora: Date,
): Roteiro {
  const motivo = textoObrigatorio(entrada.motivo, "Informe o motivo da alteração.");
  const prazo = entrada.prazo;

  if (roteiro.status !== "aguardando_marca") {
    throw new ErroDeRoteiro(
      "conflito",
      "O roteiro não aceita pedido de alteração neste estado.",
    );
  }

  if (!prazoAindaVale(prazo, agora)) {
    throw new ErroDeRoteiro("prazo_expirado", "O prazo informado já passou.");
  }

  return {
    id: roteiro.id,
    status: "alteracao_pedida",
    versoes: copiarVersoes(roteiro.versoes),
    pedidoAlteracao: {
      motivo,
      prazo,
      solicitadoEm: agora.toISOString(),
    },
  };
}

export function enviarVersao(roteiro: Roteiro, conteudo: string, agora: Date): Roteiro {
  const texto = textoObrigatorio(conteudo, "Informe o conteúdo da versão.");

  if (roteiro.status !== "alteracao_pedida") {
    throw new ErroDeRoteiro(
      "conflito",
      "Só existe nova versão quando há pedido de alteração aberto.",
    );
  }

  const proximoNumero = roteiro.versoes.reduce(
    (maior, versao) => Math.max(maior, versao.numero),
    0,
  );

  return {
    id: roteiro.id,
    status: "aguardando_marca",
    versoes: [...copiarVersoes(roteiro.versoes), montarVersao(proximoNumero + 1, texto, agora)],
    pedidoAlteracao: null,
  };
}

export function aprovar(roteiro: Roteiro): Roteiro {
  switch (roteiro.status) {
    case "aguardando_marca":
      return {
        id: roteiro.id,
        status: "aprovado",
        versoes: copiarVersoes(roteiro.versoes),
        pedidoAlteracao: null,
      };
    case "alteracao_pedida":
      throw new ErroDeRoteiro(
        "conflito",
        "Há um pedido de alteração aberto. Envie a nova versão antes de aprovar.",
      );
    case "aprovado":
      throw new ErroDeRoteiro(
        "conflito",
        "A aprovação encerra a revisão e não reabre.",
      );
  }
}

function montarVersao(numero: number, conteudo: string, agora: Date): Versao {
  return {
    numero,
    conteudo: textoObrigatorio(conteudo, "Informe o conteúdo do roteiro."),
    criadaEm: agora.toISOString(),
  };
}

function textoObrigatorio(valor: string, mensagem: string): string {
  if (valor.trim() === "") {
    throw new ErroDeRoteiro("requisicao_invalida", mensagem);
  }
  return valor.trim();
}

function copiarVersoes(versoes: Versao[]): Versao[] {
  return versoes.map((versao) => ({ ...versao }));
}
