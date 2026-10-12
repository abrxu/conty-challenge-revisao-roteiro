import { ErroDeRoteiro } from "./erros.js";

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
  const [ano, mes, dia] = prazo.split("-").map(Number) as [number, number, number];
  const seguinte = diaCivilSeguinte(ano, mes, dia);
  const limiteExclusivo = inicioDoDiaNoFuso(
    seguinte.ano,
    seguinte.mes,
    seguinte.dia,
    FUSO_DA_MARCA,
  );
  return agora.getTime() < limiteExclusivo;
}

function diaCivilSeguinte(
  ano: number,
  mes: number,
  dia: number,
): { ano: number; mes: number; dia: number } {
  const cursor = new Date(Date.UTC(ano, mes - 1, dia));
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  return {
    ano: cursor.getUTCFullYear(),
    mes: cursor.getUTCMonth() + 1,
    dia: cursor.getUTCDate(),
  };
}

function inicioDoDiaNoFuso(ano: number, mes: number, dia: number, fuso: string): number {
  const chute = Date.UTC(ano, mes - 1, dia, 0, 0, 0, 0);
  const ajustado = chute - deslocamentoDoFuso(new Date(chute), fuso);
  return chute - deslocamentoDoFuso(new Date(ajustado), fuso);
}

function deslocamentoDoFuso(instante: Date, fuso: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instante);

  const ler = (tipo: Intl.DateTimeFormatPartTypes): number =>
    Number(partes.find((parte) => parte.type === tipo)?.value);

  let hora = ler("hour");
  if (hora === 24) {
    hora = 0;
  }

  const comoUtc = Date.UTC(
    ler("year"),
    ler("month") - 1,
    ler("day"),
    hora,
    ler("minute"),
    ler("second"),
  );

  return comoUtc - instante.getTime();
}
