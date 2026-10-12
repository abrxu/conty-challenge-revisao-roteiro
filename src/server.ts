import { buildApp } from "./app.ts";

const porta = Number(process.env.PORT ?? 3000);
const app = await buildApp({
  clock: {
    now: () => new Date(),
  },
});

for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.once(sinal, () => {
    // close() termina as requisições em andamento e responde 503 às novas.
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: porta, host: "0.0.0.0" });
console.log(`API de revisão de roteiro em http://localhost:${porta}`);
