export type ConfigIssueCode =
  | "missing"
  | "invalid_number"
  | "too_short"
  | "invalid_token_format"
  | "invalid_url";

export interface ConfigIssue {
  key: string;
  code: ConfigIssueCode;
  message: string;
}

export class EnvValidationError extends Error {
  public readonly issues: ConfigIssue[];

  constructor(issues: ConfigIssue[]) {
    super("Environment validation failed");
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

export interface AppConfig {
  port: number;
  publicToken: string;
  icalUrl: string;
  icalUsername: string;
  icalPassword: string;
  cacheTtlSeconds: number;
  requestTimeoutMs: number;
  maxIcalBytes: number;
  logLevel: string;
}

export interface ConfigMetadata {
  sanitizedIcalEndpoint: string;
}

export const DEFAULT_CACHE_TTL_SECONDS = 300;
export const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
export const DEFAULT_MAX_ICAL_BYTES = 5 * 1024 * 1024;
const MIN_PUBLIC_TOKEN_LENGTH = 32;
const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export const loadEnv = (
  env: NodeJS.ProcessEnv = process.env,
): { config: AppConfig; metadata: ConfigMetadata } => {
  const issues: ConfigIssue[] = [];

  const port = readNumber(env.PORT, "PORT", issues, 3000, 1);
  const publicToken = readRequired(env.PUBLIC_TOKEN, "PUBLIC_TOKEN", issues);
  const icalUrl = readRequired(env.ICAL_URL, "ICAL_URL", issues);
  const icalUsername = readRequired(env.ICAL_USERNAME, "ICAL_USERNAME", issues);
  const icalPassword = readRequired(env.ICAL_PASSWORD, "ICAL_PASSWORD", issues);
  const cacheTtlSeconds = readNumber(
    env.CACHE_TTL_SECONDS,
    "CACHE_TTL_SECONDS",
    issues,
    DEFAULT_CACHE_TTL_SECONDS,
    1,
  );
  const requestTimeoutMs = readNumber(
    env.REQUEST_TIMEOUT_MS,
    "REQUEST_TIMEOUT_MS",
    issues,
    DEFAULT_REQUEST_TIMEOUT_MS,
    100,
  );
  const maxIcalBytes = readNumber(
    env.MAX_ICAL_BYTES,
    "MAX_ICAL_BYTES",
    issues,
    DEFAULT_MAX_ICAL_BYTES,
    1024,
  );
  const logLevel = (env.LOG_LEVEL ?? "info").toLowerCase();

  if (publicToken && publicToken.length < MIN_PUBLIC_TOKEN_LENGTH) {
    issues.push({
      key: "PUBLIC_TOKEN",
      code: "too_short",
      message: `PUBLIC_TOKEN must be at least ${MIN_PUBLIC_TOKEN_LENGTH} characters`,
    });
  }

  if (publicToken && !PUBLIC_TOKEN_PATTERN.test(publicToken)) {
    issues.push({
      key: "PUBLIC_TOKEN",
      code: "invalid_token_format",
      message: "PUBLIC_TOKEN must contain only URL-safe characters: A-Z, a-z, 0-9, _ and -",
    });
  }

  const sanitizedIcalEndpoint = sanitizeUrlForLogs(icalUrl, issues);

  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  return {
    config: {
      port,
      publicToken,
      icalUrl,
      icalUsername,
      icalPassword,
      cacheTtlSeconds,
      requestTimeoutMs,
      maxIcalBytes,
      logLevel,
    },
    metadata: {
      sanitizedIcalEndpoint,
    },
  };
};

const readRequired = (
  value: string | undefined,
  key: string,
  issues: ConfigIssue[],
): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    issues.push({
      key,
      code: "missing",
      message: `${key} is required`,
    });
    return "";
  }

  return trimmed;
};

const readNumber = (
  value: string | undefined,
  key: string,
  issues: ConfigIssue[],
  defaultValue: number,
  minValue: number,
): number => {
  if (!value || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < minValue) {
    issues.push({
      key,
      code: "invalid_number",
      message: `${key} must be an integer >= ${minValue}`,
    });
    return defaultValue;
  }

  return parsed;
};

const sanitizeUrlForLogs = (
  urlValue: string,
  issues: ConfigIssue[],
): string => {
  try {
    const parsed = new URL(urlValue);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    issues.push({
      key: "ICAL_URL",
      code: "invalid_url",
      message: "ICAL_URL must be a valid absolute URL",
    });
    return "";
  }
};
