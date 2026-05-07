import type { Logger } from "../observability/logger";

export class InvalidCalendarError extends Error {
  public readonly reason: "empty" | "too_large" | "malformed";

  constructor(reason: "empty" | "too_large" | "malformed", message: string) {
    super(message);
    this.name = "InvalidCalendarError";
    this.reason = reason;
  }
}

export interface ValidateCalendarInput {
  calendarText: string;
  maxBytes: number;
  logger: Logger;
  source: string;
  requestId?: string;
}

export const validateCalendar = ({
  calendarText,
  maxBytes,
  logger,
  source,
  requestId,
}: ValidateCalendarInput): string => {
  const sizeBytes = Buffer.byteLength(calendarText, "utf8");
  const trimmed = calendarText.trim();

  if (!trimmed) {
    logger.warn("calendar validation failed", {
      requestId,
      source,
      reason: "empty",
      sizeBytes,
    });
    throw new InvalidCalendarError("empty", "Calendar body is empty");
  }

  if (sizeBytes > maxBytes) {
    logger.warn("calendar validation failed", {
      requestId,
      source,
      reason: "too_large",
      sizeBytes,
      maxBytes,
    });
    throw new InvalidCalendarError("too_large", "Calendar body exceeds configured limit");
  }

  if (!trimmed.includes("BEGIN:VCALENDAR") || !trimmed.includes("END:VCALENDAR")) {
    logger.warn("calendar validation failed", {
      requestId,
      source,
      reason: "malformed",
      sizeBytes,
    });
    throw new InvalidCalendarError("malformed", "Calendar body is not a valid VCALENDAR payload");
  }

  return calendarText;
};
