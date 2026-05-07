import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/server";
import { resetCalendarCache } from "../src/services/calendar-service";
import type { Logger, LogContext } from "../src/observability/logger";

const VALID_ICAL = "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n";

interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context: LogContext | undefined;
}

const createTestLogger = () => {
  const entries: LogEntry[] = [];
  const logger: Logger = {
    debug: (message, context) => entries.push({ level: "debug", message, context }),
    info: (message, context) => entries.push({ level: "info", message, context }),
    warn: (message, context) => entries.push({ level: "warn", message, context }),
    error: (message, context) => entries.push({ level: "error", message, context }),
    child: () => logger,
  };
  return { logger, entries };
};

const baseConfig = {
  publicToken: "this-is-a-long-public-token-with-32-chars",
  cacheTtlSeconds: 120,
  maxIcalBytes: 1024 * 1024,
  icalUrl: "https://calendar.example.com/private.ics",
  icalUsername: "user",
  icalPassword: "password",
  requestTimeoutMs: 3000,
};

const apps: Array<ReturnType<typeof buildServer>> = [];

afterEach(async () => {
  resetCalendarCache();
  for (const app of apps.splice(0)) {
    await app.close();
  }
});

describe("routes contract", () => {
  it("returns health payload", async () => {
    const { logger } = createTestLogger();
    const app = buildServer({ config: baseConfig, logger });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("returns 404 for invalid token without leaking token to logs", async () => {
    const { logger, entries } = createTestLogger();
    const app = buildServer({ config: baseConfig, logger });
    apps.push(app);
    const leakedToken = "wrong-token-should-not-leak";

    const response = await app.inject({
      method: "GET",
      url: `/calendar/${leakedToken}.ics`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ message: "Not Found" });
    expect(JSON.stringify(entries)).not.toContain(leakedToken);
  });

  it("returns calendar payload with expected headers for valid token", async () => {
    const { logger } = createTestLogger();
    const app = buildServer({
      config: baseConfig,
      logger,
      fetchCalendar: async () => VALID_ICAL,
    });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: `/calendar/${baseConfig.publicToken}.ics`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/calendar; charset=utf-8");
    expect(response.headers["cache-control"]).toBe(`public, max-age=${baseConfig.cacheTtlSeconds}`);
    expect(response.body.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });

  it("maps malformed upstream calendar to 502 when stale cache is absent", async () => {
    const { logger } = createTestLogger();
    const app = buildServer({
      config: baseConfig,
      logger,
      fetchCalendar: async () => "NOT_A_CALENDAR",
    });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: `/calendar/${baseConfig.publicToken}.ics`,
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ message: "Bad Gateway" });
  });
});
