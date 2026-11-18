import { buildApp } from "./app.js";
import { MockProvider } from "./providers/mock.js";
import { loadConfig } from "@platform/shared";

const config = loadConfig();
const app = buildApp({ provider: new MockProvider() });

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
