import type { Roteiro } from "./domain/roteiro.ts";
import type { RepositorioRoteiros } from "./servico-roteiro.ts";

export class RepositorioMemoria implements RepositorioRoteiros {
  private readonly roteiros = new Map<string, Roteiro>();

  salvar(roteiro: Roteiro): void {
    this.roteiros.set(roteiro.id, structuredClone(roteiro));
  }

  buscar(id: string): Roteiro | undefined {
    const roteiro = this.roteiros.get(id);
    return roteiro ? structuredClone(roteiro) : undefined;
  }
}
