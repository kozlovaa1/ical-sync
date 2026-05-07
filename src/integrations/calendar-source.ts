import type { AppConfig } from "../config/env";
import { type Logger, sanitizeUrlForLogs } from "../observability/logger";

export type CalendarSourceErrorCode =
  | "timeout"
  | "upstream_status"
  | "size_limit"
  | "network";

export class CalendarSourceError extends Error {
  public readonly code: CalendarSourceErrorCode;
  public readonly statusCode?: number;

  constructor(code: CalendarSourceErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = "CalendarSourceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface FetchCalendarInput {
  config: Pick<
    AppConfig,
    "icalUrl" | "icalUsername" | "icalPassword" | "requestTimeoutMs" | "maxIcalBytes"
  >;
  logger: Logger;
  requestId?: string;
  fetchFn?: typeof fetch;
}

export const fetchCalendarFromSource = async ({
  config,
  logger,
  requestId,
  fetchFn = fetch,
}: FetchCalendarInput): Promise<string> => {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  const sanitizedUrl = sanitizeUrlForLogs(config.icalUrl);
  const auth = Buffer.from(`${config.icalUsername}:${config.icalPassword}`).toString("base64");

  logger.debug("upstream fetch started", {
    requestId,
    endpointUrl: sanitizedUrl,
    timeoutMs: config.requestTimeoutMs,
    maxIcalBytes: config.maxIcalBytes,
  });

  try {
    const response = await fetchFn(config.icalUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "text/calendar,*/*;q=0.9",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const latencyMs = Date.now() - startTime;
      logger.warn("upstream fetch returned non-2xx status", {
        requestId,
        endpointUrl: sanitizedUrl,
        latencyMs,
        upstreamStatus: response.status,
      });
      throw new CalendarSourceError(
        "upstream_status",
        `Upstream responded with status ${response.status}`,
        response.status,
      );
    }

    const bodyText = await readResponseTextWithLimit(response, config.maxIcalBytes);
    const latencyMs = Date.now() - startTime;
    logger.debug("upstream fetch completed", {
      requestId,
      endpointUrl: sanitizedUrl,
      latencyMs,
      bytes: Buffer.byteLength(bodyText, "utf8"),
      upstreamStatus: response.status,
    });

    return bodyText;
  } catch (error: unknown) {
    if (error instanceof CalendarSourceError) {
      if (error.code === "size_limit") {
        logger.warn("upstream fetch exceeded configured size limit", {
          requestId,
          endpointUrl: sanitizedUrl,
          maxIcalBytes: config.maxIcalBytes,
        });
      }
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      logger.warn("upstream fetch timed out", {
        requestId,
        endpointUrl: sanitizedUrl,
        timeoutMs: config.requestTimeoutMs,
      });
      throw new CalendarSourceError("timeout", "Upstream request timed out");
    }

    logger.error("upstream fetch failed with network error", {
      requestId,
      endpointUrl: sanitizedUrl,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown failure",
    });
    throw new CalendarSourceError("network", "Network error while fetching upstream calendar");
  } finally {
    clearTimeout(timeout);
  }
};

const readResponseTextWithLimit = async (
  response: Response,
  maxBytes: number,
): Promise<string> => {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      throw new CalendarSourceError(
        "size_limit",
        `Upstream response exceeds MAX_ICAL_BYTES (${maxBytes})`,
      );
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
};
