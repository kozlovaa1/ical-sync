import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config/env";
import { getCalendar } from "../services/calendar-service";
import type { Logger } from "../observability/logger";
import type { FetchCalendarInput } from "../integrations/calendar-source";

interface CalendarParams {
  token: string;
}

export interface RouteDependencies {
  config: Pick<
    AppConfig,
    | "publicToken"
    | "cacheTtlSeconds"
    | "maxIcalBytes"
    | "icalUrl"
    | "icalUsername"
    | "icalPassword"
    | "requestTimeoutMs"
  >;
  logger: Logger;
  fetchCalendar?: (input: FetchCalendarInput) => Promise<string>;
}

export const registerRoutes = (
  app: FastifyInstance,
  { config, logger, fetchCalendar }: RouteDependencies,
): void => {
  app.get("/health", async () => ({ ok: true }));

  app.get(
    "/calendar/:token.ics",
    async (request: FastifyRequest<{ Params: CalendarParams }>, reply: FastifyReply) => {
      const requestId = request.id;
      logger.debug("calendar route request received", {
        requestId,
        route: "/calendar/:token.ics",
      });

      const result = await getCalendar({
        token: request.params.token,
        config,
        logger,
        requestId,
        fetchCalendar,
      });

      if (result.kind === "not_found") {
        logger.warn("calendar route rejected invalid token", {
          requestId,
        });
        reply.code(404).send({ message: "Not Found" });
        return;
      }

      if (result.kind === "bad_gateway") {
        logger.info("calendar route upstream unavailable", {
          requestId,
          reason: result.reason,
          statusCode: 502,
        });
        reply.code(502).send({ message: "Bad Gateway" });
        return;
      }

      logger.info("calendar route served payload", {
        requestId,
        statusCode: 200,
        stale: result.stale,
        fromCache: result.fromCache,
      });

      reply
        .header("Content-Type", "text/calendar; charset=utf-8")
        .header("Cache-Control", `public, max-age=${config.cacheTtlSeconds}`)
        .code(200)
        .send(result.body);
    },
  );
};
