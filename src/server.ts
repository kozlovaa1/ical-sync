import Fastify from "fastify";
import { EnvValidationError, loadEnv } from "./config/env";
import type { RouteDependencies } from "./http/routes";
import { registerRoutes } from "./http/routes";
import { createLogger } from "./observability/logger";

export const buildServer = (deps: RouteDependencies) => {
  const app = Fastify({
    logger: false,
  });
  registerRoutes(app, deps);
  return app;
};

const start = async (): Promise<void> => {
  const bootstrapLogger = createLogger("bootstrap", process.env.LOG_LEVEL ?? "info");

  try {
    const { config, metadata } = loadEnv(process.env);
    const logger = createLogger("app", config.logLevel);

    logger.info("environment loaded", {
      port: config.port,
      cacheTtlSeconds: config.cacheTtlSeconds,
      requestTimeoutMs: config.requestTimeoutMs,
      maxIcalBytes: config.maxIcalBytes,
      endpointUrl: metadata.sanitizedIcalEndpoint,
    });

    const app = buildServer({
      config,
      logger,
    });

    await app.listen({
      host: "0.0.0.0",
      port: config.port,
    });

    logger.info("server started", {
      host: "0.0.0.0",
      port: config.port,
    });
  } catch (error: unknown) {
    if (error instanceof EnvValidationError) {
      bootstrapLogger.error("environment validation failed", {
        issueCount: error.issues.length,
        issues: error.issues.map((issue) => ({
          key: issue.key,
          code: issue.code,
          message: issue.message,
        })),
      });
      process.exitCode = 1;
      return;
    }

    bootstrapLogger.error("server startup failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown failure",
    });
    process.exitCode = 1;
  }
};

if (require.main === module) {
  void start();
}
