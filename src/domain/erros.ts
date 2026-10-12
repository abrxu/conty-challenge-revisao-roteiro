export type CodigoErro =
  | "requisicao_invalida"
  | "prazo_expirado"
  | "conflito"
  | "nao_encontrado";

export class ErroDeRoteiro extends Error {
  readonly codigo: CodigoErro;

  constructor(codigo: CodigoErro, message: string) {
    super(message);
    this.name = "ErroDeRoteiro";
    this.codigo = codigo;
  }
}
