import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PLACEHOLDER_USO_DE_IA =
  "<!-- PREENCHER: o que foi feito com IA e o que revisei -->";

describe("README", () => {
  it('critério: "README curto e honesto sobre o que ficou de fora."', () => {
    const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");

    expect(readme).toContain("ficou de fora");
    expect(readme).toContain("Uso de IA");
    expect(readme).toContain(PLACEHOLDER_USO_DE_IA);
  });
});
