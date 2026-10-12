import type { RepositorioRoteiros, Roteiro } from "./domain/roteiro.js";

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
