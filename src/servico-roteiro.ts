import type { Clock } from "./clock.ts";
import { ErroDeRoteiro } from "./domain/erros.ts";
import {
  aprovar,
  criarRoteiro,
  enviarVersao,
  pedirAlteracao,
  type Roteiro,
} from "./domain/roteiro.ts";

export type RepositorioRoteiros = {
  salvar(roteiro: Roteiro): void;
  buscar(id: string): Roteiro | undefined;
};

export class ServicoRoteiro {
  private readonly repositorio: RepositorioRoteiros;
  private readonly clock: Clock;
  private readonly gerarId: () => string;

  constructor(repositorio: RepositorioRoteiros, clock: Clock, gerarId: () => string) {
    this.repositorio = repositorio;
    this.clock = clock;
    this.gerarId = gerarId;
  }

  criar(conteudo: string): Roteiro {
    const roteiro = criarRoteiro(this.gerarId(), conteudo, this.clock.now());
    this.repositorio.salvar(roteiro);
    return roteiro;
  }

  buscar(id: string): Roteiro {
    return this.exigir(id);
  }

  pedirAlteracao(id: string, entrada: { motivo: string; prazo: string }): Roteiro {
    const atual = this.exigir(id);
    const revisado = pedirAlteracao(atual, entrada, this.clock.now());
    this.repositorio.salvar(revisado);
    return revisado;
  }

  enviarVersao(id: string, conteudo: string): Roteiro {
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
