const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SECRET_KEY_PATTERN =
  /(pass|password|token|secret|authorization|cookie|set-cookie|apikey|api-key)/i;

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(defaultContext: LogContext): Logger;
}

export const createLogger = (
  scope: string,
  levelInput: string = "info",
  defaultContext: LogContext = {},
): Logger => {
  const level = parseLogLevel(levelInput);

  const log = (targetLevel: LogLevel, message: string, context: LogContext = {}): void => {
    if (LOG_LEVEL_ORDER[targetLevel] < LOG_LEVEL_ORDER[level]) {
      return;
    }

    const payload = {
      ts: new Date().toISOString(),
      level: targetLevel,
      scope,
      message,
      ...sanitizeContext({
        ...defaultContext,
        ...context,
      }),
    };

    const line = JSON.stringify(payload);
    if (targetLevel === "error") {
      console.error(line);
      return;
    }
    if (targetLevel === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  };

  return {
    debug: (message, context) => log("debug", message, context),
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, context) => log("error", message, context),
    child: (childContext) => createLogger(scope, level, { ...defaultContext, ...childContext }),
  };
};

export const sanitizeUrlForLogs = (value: string): string => {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return value;
  }
};

const parseLogLevel = (value: string): LogLevel => {
  const normalized = value.toLowerCase();
  if (normalized === "debug" || normalized === "info" || normalized === "warn" || normalized === "error") {
    return normalized;
  }
  return "info";
};

const sanitizeContext = (context: LogContext): LogContext => {
  const entries = Object.entries(context).map(([key, value]) => [key, sanitizeField(key, value)]);
  return Object.fromEntries(entries);
};

const sanitizeField = (key: string, value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (SECRET_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }
  if (typeof value === "string") {
    if (isLikelyUrl(key, value)) {
      return sanitizeUrlForLogs(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeField(key, item));
  }
  if (typeof value === "object") {
    const nested = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(nested).map(([nestedKey, nestedValue]) => [
        nestedKey,
        sanitizeField(nestedKey, nestedValue),
      ]),
    );
  }
  return value;
};

const isLikelyUrl = (key: string, value: string): boolean => {
  if (/url|uri|endpoint/i.test(key)) {
    return true;
  }
  return value.startsWith("http://") || value.startsWith("https://");
};
