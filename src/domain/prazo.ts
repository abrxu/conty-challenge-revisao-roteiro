export const FUSO_DA_MARCA = "America/Sao_Paulo";

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
