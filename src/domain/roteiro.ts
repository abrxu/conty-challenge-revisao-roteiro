import type { Clock } from "../clock.js";
import { ErroDeRoteiro } from "./erros.js";
import { prazoAindaVale, prazoCalendario } from "./prazo.js";

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

export function criarRoteiro(id: string, conteudo: unknown, agora: Date): Roteiro {
  return {
    id,
    status: "aguardando_marca",
    versoes: [montarVersao(1, conteudo, agora)],
    pedidoAlteracao: null,
  };
}

export function pedirAlteracao(
  roteiro: Roteiro,
  entrada: { motivo: unknown; prazo: unknown },
  agora: Date,
): Roteiro {
  const motivo = textoObrigatorio(entrada.motivo, "Informe o motivo da alteração.");
  const prazo = prazoCalendario(entrada.prazo);

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

export function enviarVersao(roteiro: Roteiro, conteudo: unknown, agora: Date): Roteiro {
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
  if (roteiro.status !== "aguardando_marca") {
    throw new ErroDeRoteiro(
      "conflito",
      "A aprovação encerra a revisão e não reabre.",
    );
  }

  return {
    id: roteiro.id,
    status: "aprovado",
    versoes: copiarVersoes(roteiro.versoes),
    pedidoAlteracao: null,
  };
}

function montarVersao(numero: number, conteudo: unknown, agora: Date): Versao {
  return {
    numero,
    conteudo: textoObrigatorio(conteudo, "Informe o conteúdo do roteiro."),
    criadaEm: agora.toISOString(),
  };
}

function textoObrigatorio(valor: unknown, mensagem: string): string {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new ErroDeRoteiro("requisicao_invalida", mensagem);
  }
  return valor.trim();
}

function copiarVersoes(versoes: Versao[]): Versao[] {
  return versoes.map((versao) => ({ ...versao }));
}

export type RepositorioRoteiros = {
  salvar(roteiro: Roteiro): void;
  buscar(id: string): Roteiro | undefined;
};

export class ServicoRoteiro {
  constructor(
    private readonly repositorio: RepositorioRoteiros,
    private readonly clock: Clock,
  ) {}

  criar(conteudo: unknown): Roteiro {
    const roteiro = criarRoteiro(crypto.randomUUID(), conteudo, this.clock.now());
    this.repositorio.salvar(roteiro);
    return roteiro;
  }

  buscar(id: string): Roteiro {
    return this.exigir(id);
  }

  pedirAlteracao(id: string, entrada: { motivo: unknown; prazo: unknown }): Roteiro {
    const atual = this.exigir(id);
    const revisado = pedirAlteracao(atual, entrada, this.clock.now());
    this.repositorio.salvar(revisado);
    return revisado;
  }

  enviarVersao(id: string, conteudo: unknown): Roteiro {
    const atual = this.exigir(id);
    const revisado = enviarVersao(atual, conteudo, this.clock.now());
    this.repositorio.salvar(revisado);
    return revisado;
  }

  aprovar(id: string): Roteiro {
    const atual = this.exigir(id);
    const revisado = aprovar(atual);
    this.repositorio.salvar(revisado);
    return revisado;
  }

  private exigir(id: string): Roteiro {
    const roteiro = this.repositorio.buscar(id);
    if (!roteiro) {
      throw new ErroDeRoteiro("nao_encontrado", "Roteiro não encontrado.");
    }
    return roteiro;
  }
}
