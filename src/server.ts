import { buildApp } from "./app.js";

const porta = Number(process.env.PORT ?? 3000);
const app = await buildApp({
  clock: {
    now: () => new Date(),
  },
});

await app.listen({ port: porta, host: "0.0.0.0" });
console.log(`API de revisão de roteiro em http://localhost:${porta}`);
