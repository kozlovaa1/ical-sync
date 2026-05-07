import { describe, expect, it, beforeEach } from "vitest";
import { EnvValidationError, loadEnv } from "../src/config/env";
import { validateCalendar } from "../src/ical/validate-calendar";
import { getCalendar, resetCalendarCache } from "../src/services/calendar-service";
import { sanitizeUrlForLogs, type Logger, type LogContext } from "../src/observability/logger";

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
  cacheTtlSeconds: 60,
  maxIcalBytes: 1024 * 1024,
  icalUrl: "https://calendar.example.com/private.ics",
  icalUsername: "user",
  icalPassword: "password",
  requestTimeoutMs: 3000,
};

describe("env validation", () => {
  it("rejects too short PUBLIC_TOKEN", () => {
    expect(() =>
      loadEnv({
        PORT: "3000",
        PUBLIC_TOKEN: "short",
        ICAL_URL: "https://calendar.example.com/private.ics",
        ICAL_USERNAME: "user",
        ICAL_PASSWORD: "pass",
      }),
    ).toThrowError(EnvValidationError);
  });

  it("rejects PUBLIC_TOKEN values that are unsafe in a URL path", () => {
    expect(() =>
      loadEnv({
        PORT: "3000",
        PUBLIC_TOKEN: "this-token-has/a-path-separator-over-32-chars",
        ICAL_URL: "https://calendar.example.com/private.ics",
        ICAL_USERNAME: "user",
        ICAL_PASSWORD: "pass",
      }),
    ).toThrowError(EnvValidationError);
  });

  it("accepts URL-safe PUBLIC_TOKEN values", () => {
    const { config } = loadEnv({
      PORT: "3000",
      PUBLIC_TOKEN: "url_safe-token-0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      ICAL_URL: "https://calendar.example.com/private.ics",
      ICAL_USERNAME: "user",
      ICAL_PASSWORD: "pass",
    });

    expect(config.publicToken).toBe("url_safe-token-0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  });

  it("sanitizes ICAL_URL metadata to origin and pathname only", () => {
    const { metadata } = loadEnv({
      PORT: "3000",
      PUBLIC_TOKEN: baseConfig.publicToken,
      ICAL_URL: "https://calendar.example.com/private/feed.ics?token=secret#fragment",
      ICAL_USERNAME: "user",
      ICAL_PASSWORD: "pass",
    });

    expect(metadata.sanitizedIcalEndpoint).toBe("https://calendar.example.com/private/feed.ics");
  });
});

describe("logger sanitization", () => {
  it("preserves URL origin and pathname while removing query and fragment", () => {
    expect(
      sanitizeUrlForLogs("https://calendar.example.com/private/feed.ics?token=secret#fragment"),
    ).toBe("https://calendar.example.com/private/feed.ics");
  });
});

describe("ical validation", () => {
  it("accepts valid vcalendar payload", () => {
    const { logger } = createTestLogger();
    const result = validateCalendar({
      calendarText: VALID_ICAL,
      maxBytes: 1024,
      logger,
      source: "test",
    });
    expect(result).toBe(VALID_ICAL);
  });

  it("rejects malformed payload", () => {
    const { logger } = createTestLogger();
    expect(() =>
      validateCalendar({
        calendarText: "NOT_A_CALENDAR",
        maxBytes: 1024,
        logger,
        source: "test",
      }),
    ).toThrowError();
  });
});

describe("calendar service cache behavior", () => {
  beforeEach(() => {
    resetCalendarCache();
  });

  it("returns not_found for invalid token", async () => {
    const { logger, entries } = createTestLogger();

    const result = await getCalendar({
      token: "invalid-token-value",
      config: baseConfig,
      logger,
      nowMs: 1000,
      fetchCalendar: async () => VALID_ICAL,
    });

    expect(result.kind).toBe("not_found");
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain("invalid-token-value");
    expect(serialized).not.toContain(baseConfig.icalPassword);
  });

  it("serves fresh cache without upstream call", async () => {
    const { logger } = createTestLogger();
    let fetchCalls = 0;

    const fetchCalendar = async () => {
      fetchCalls += 1;
      return VALID_ICAL;
    };

    const first = await getCalendar({
      token: baseConfig.publicToken,
      config: baseConfig,
      logger,
      nowMs: 1000,
      fetchCalendar,
    });

    const second = await getCalendar({
      token: baseConfig.publicToken,
      config: baseConfig,
      logger,
      nowMs: 1500,
      fetchCalendar,
    });

    expect(first.kind).toBe("ok");
    expect(second.kind).toBe("ok");
    expect(fetchCalls).toBe(1);
  });

  it("refreshes cache after ttl expiry", async () => {
    const { logger } = createTestLogger();
    let fetchCalls = 0;

    const fetchCalendar = async () => {
      fetchCalls += 1;
      return VALID_ICAL;
    };

    await getCalendar({
      token: baseConfig.publicToken,
      config: baseConfig,
      logger,
      nowMs: 1000,
      fetchCalendar,
    });

    await getCalendar({
      token: baseConfig.publicToken,
      config: baseConfig,
      logger,
      nowMs: 1000 + baseConfig.cacheTtlSeconds * 1000 + 1,
      fetchCalendar,
    });

    expect(fetchCalls).toBe(2);
  });

  it("returns stale cache when refresh fails", async () => {
    const { logger } = createTestLogger();

    await getCalendar({
      token: baseConfig.publicToken,
      config: baseConfig,
      logger,
      nowMs: 1000,
      fetchCalendar: async () => VALID_ICAL,
    });

    const stale = await getCalendar({
      token: baseConfig.publicToken,
      config: baseConfig,
      logger,
      nowMs: 1000 + baseConfig.cacheTtlSeconds * 1000 + 1,
      fetchCalendar: async () => {
        throw new Error("upstream is down");
      },
    });

    expect(stale.kind).toBe("ok");
    if (stale.kind === "ok") {
      expect(stale.stale).toBe(true);
      expect(stale.fromCache).toBe(true);
    }
  });

  it("returns stale cache when refreshed upstream calendar is malformed", async () => {
    const { logger } = createTestLogger();

    await getCalendar({
      token: baseConfig.publicToken,
      config: baseConfig,
      logger,
      nowMs: 1000,
      fetchCalendar: async () => VALID_ICAL,
    });

    const stale = await getCalendar({
      token: baseConfig.publicToken,
      config: baseConfig,
      logger,
      nowMs: 1000 + baseConfig.cacheTtlSeconds * 1000 + 1,
      fetchCalendar: async () => "BEGIN:VEVENT\nEND:VEVENT",
    });

    expect(stale.kind).toBe("ok");
    if (stale.kind === "ok") {
      expect(stale.stale).toBe(true);
      expect(stale.fromCache).toBe(true);
    }
  });

  it("returns bad_gateway when refresh fails without cache", async () => {
    const { logger } = createTestLogger();
    const result = await getCalendar({
      token: baseConfig.publicToken,
      config: baseConfig,
      logger,
      nowMs: 1000,
      fetchCalendar: async () => {
        throw new Error("upstream is down");
      },
    });

    expect(result.kind).toBe("bad_gateway");
  });

  it("returns bad_gateway for malformed upstream calendar without stale cache", async () => {
    const { logger } = createTestLogger();

    const result = await getCalendar({
      token: baseConfig.publicToken,
      config: baseConfig,
      logger,
      nowMs: 1000,
      fetchCalendar: async () => "BEGIN:VEVENT\nEND:VEVENT",
    });

    expect(result.kind).toBe("bad_gateway");
  });
});
