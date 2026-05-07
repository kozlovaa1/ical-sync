import type { AppConfig } from "../config/env";
import {
  CalendarSourceError,
  fetchCalendarFromSource,
  type FetchCalendarInput,
} from "../integrations/calendar-source";
import { InvalidCalendarError, validateCalendar } from "../ical/validate-calendar";
import type { Logger } from "../observability/logger";

type RefreshStatus = "success" | "failed" | "invalid";

interface CacheEntry {
  body: string;
  refreshedAtMs: number;
  lastRefreshStatus: RefreshStatus;
}

export type CalendarResponse =
  | { kind: "not_found" }
  | {
      kind: "ok";
      body: string;
      stale: boolean;
      fromCache: boolean;
      refreshedAtMs: number;
    }
  | { kind: "bad_gateway"; reason: string };

export interface GetCalendarInput {
  token: string;
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
  requestId?: string;
  nowMs?: number;
  fetchCalendar?: (input: FetchCalendarInput) => Promise<string>;
}

let cache: CacheEntry | null = null;

export const getCalendar = async ({
  token,
  config,
  logger,
  requestId,
  nowMs = Date.now(),
  fetchCalendar = fetchCalendarFromSource,
}: GetCalendarInput): Promise<CalendarResponse> => {
  logger.debug("calendar request accepted by service", {
    requestId,
    hasCache: Boolean(cache),
    cacheTtlSeconds: config.cacheTtlSeconds,
  });

  if (token !== config.publicToken) {
    logger.warn("calendar request token mismatch", {
      requestId,
    });
    return { kind: "not_found" };
  }

  const ttlMs = config.cacheTtlSeconds * 1000;
  if (cache && nowMs - cache.refreshedAtMs < ttlMs) {
    logger.debug("calendar cache hit (fresh)", {
      requestId,
      cacheAgeMs: nowMs - cache.refreshedAtMs,
      ttlMs,
      lastRefreshStatus: cache.lastRefreshStatus,
    });
    return {
      kind: "ok",
      body: cache.body,
      stale: false,
      fromCache: true,
      refreshedAtMs: cache.refreshedAtMs,
    };
  }

  logger.debug("calendar cache miss or stale", {
    requestId,
    hasCache: Boolean(cache),
    cacheAgeMs: cache ? nowMs - cache.refreshedAtMs : null,
    ttlMs,
  });

  try {
    const upstreamBody = await fetchCalendar({
      config,
      logger,
      requestId,
    });
    const validated = validateCalendar({
      calendarText: upstreamBody,
      maxBytes: config.maxIcalBytes,
      logger,
      source: "upstream",
      requestId,
    });

    cache = {
      body: validated,
      refreshedAtMs: nowMs,
      lastRefreshStatus: "success",
    };

    logger.info("calendar refresh succeeded", {
      requestId,
      bodySizeBytes: Buffer.byteLength(validated, "utf8"),
      cacheAgeMs: 0,
    });

    return {
      kind: "ok",
      body: validated,
      stale: false,
      fromCache: false,
      refreshedAtMs: nowMs,
    };
  } catch (error: unknown) {
    const reason = classifyReason(error);

    if (cache) {
      cache = {
        ...cache,
        lastRefreshStatus: reason === "invalid_calendar" ? "invalid" : "failed",
      };

      logger.warn("calendar refresh failed; returning stale cache", {
        requestId,
        reason,
        staleAgeMs: nowMs - cache.refreshedAtMs,
        lastRefreshStatus: cache.lastRefreshStatus,
      });

      return {
        kind: "ok",
        body: cache.body,
        stale: true,
        fromCache: true,
        refreshedAtMs: cache.refreshedAtMs,
      };
    }

    logger.error("calendar refresh failed and no stale cache available", {
      requestId,
      reason,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown failure",
    });

    return {
      kind: "bad_gateway",
      reason,
    };
  }
};

export const resetCalendarCache = (): void => {
  cache = null;
};

const classifyReason = (error: unknown): string => {
  if (error instanceof InvalidCalendarError) {
    return "invalid_calendar";
  }
  if (error instanceof CalendarSourceError) {
    return `upstream_${error.code}`;
  }
  if (error instanceof Error) {
    return "unexpected_error";
  }
  return "unknown_error";
};
