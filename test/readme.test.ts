import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PLACEHOLDER_USO_DE_IA =
  "<!-- PREENCHER: o que foi feito com IA e o que revisei -->";

function lerReadme(): string {
  return readFileSync(path.join(process.cwd(), "README.md"), "utf8");
}

describe("README", () => {
  it('critério: "README curto e honesto sobre o que ficou de fora."', () => {
    const readme = lerReadme();
    const fora = readme.slice(readme.indexOf("## O que ficou de fora"));

    expect(fora.startsWith("## O que ficou de fora")).toBe(true);
    expect(fora).toContain("vídeo");
    expect(fora).toContain("upload");
    expect(fora).toContain("autenticação");
    expect(fora).toContain("persistência");
    expect(readme).not.toContain("nada ficou de fora");
    expect(readme).toContain("Uso de IA");
    expect(readme).toContain(PLACEHOLDER_USO_DE_IA);
  });

  it('entrega: "Exemplos de request e response."', () => {
    const readme = lerReadme();

    expect(readme).toContain("curl -s -X POST http://localhost:3000/roteiros");
    expect(readme).toContain('"status": "aguardando_marca"');
    expect(readme).toContain('"status": "alteracao_pedida"');
    expect(readme).toContain('"numero": 2');
    expect(readme).toContain('"status": "aprovado"');
    expect(readme).toContain("curl -s http://localhost:3000/roteiros/");
  });

  it('entrega: "Uma nota das decisões que você deixaria diferentes com mais tempo."', () => {
    const readme = lerReadme();
    const nota = readme.slice(readme.indexOf("## O que eu faria diferente com mais tempo"));

    expect(nota.startsWith("## O que eu faria diferente com mais tempo")).toBe(true);
    expect(nota).toContain("SQLite");
    expect(nota).toContain("America/Sao_Paulo");
  });
});
