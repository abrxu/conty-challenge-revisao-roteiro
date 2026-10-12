import { ErroDeRoteiro } from "./erros.ts";

export const FUSO_DA_MARCA = "America/Sao_Paulo";

const PRAZO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function prazoCalendario(valor: unknown): string {
  if (typeof valor !== "string" || !PRAZO_DIA.test(valor)) {
    throw new ErroDeRoteiro(
      "requisicao_invalida",
      "Informe o prazo como um dia no formato YYYY-MM-DD.",
    );
  }

  const [ano, mes, dia] = valor.split("-").map(Number) as [number, number, number];
  const conferido = new Date(Date.UTC(ano, mes - 1, dia));
  const existe =
    conferido.getUTCFullYear() === ano &&
    conferido.getUTCMonth() === mes - 1 &&
    conferido.getUTCDate() === dia;

  if (!existe) {
    throw new ErroDeRoteiro(
      "requisicao_invalida",
      "Informe o prazo como um dia no formato YYYY-MM-DD.",
    );
  }

  return valor;
}

export function prazoAindaVale(prazo: string, agora: Date): boolean {
  return diaCivilNoFuso(agora, FUSO_DA_MARCA) <= prazo;
}

function diaCivilNoFuso(instante: Date, fuso: string): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instante);

  const ler = (tipo: Intl.DateTimeFormatPartTypes): string =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";

  return `${ler("year")}-${ler("month")}-${ler("day")}`;
}
