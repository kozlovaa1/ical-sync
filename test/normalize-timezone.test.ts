import { describe, expect, it } from "vitest";
import { normalizeMoscowTimezone } from "../src/ical/normalize-timezone";

const zone = (id: string, offset = "+0300") => [
  "BEGIN:VTIMEZONE",
  `TZID:${id}`,
  "BEGIN:STANDARD",
  "DTSTART:19700101T000001",
  `TZOFFSETTO:${offset}`,
  `TZOFFSETFROM:${offset}`,
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n") + "\r\n";

const legacy = "Moscow, St.Petersburg, Volgograd";
const modern = "Europe/Moscow";

describe("Moscow timezone compatibility", () => {
  it("merges equivalent timezone definitions and updates recurrence references without shifting times", () => {
    const input = `BEGIN:VCALENDAR\r\n${zone(modern)}${zone(legacy)}BEGIN:VEVENT\r\n` +
      `DTSTART;TZID="${legacy}":20261112T150000\r\n` +
      `DTEND;TZID="${legacy}":20261112T160000\r\n` +
      `RECURRENCE-ID;TZID="${legacy}":20261112T150000\r\n` +
      `EXDATE;TZID="${legacy}":20261119T150000\r\n` +
      `RRULE:FREQ=WEEKLY\r\nSUMMARY:${legacy}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    const result = normalizeMoscowTimezone(input);
    expect(result).toBe(`BEGIN:VCALENDAR\r\n${zone(modern)}BEGIN:VEVENT\r\n` +
      `DTSTART;TZID=${modern}:20261112T150000\r\n` +
      `DTEND;TZID=${modern}:20261112T160000\r\n` +
      `RECURRENCE-ID;TZID=${modern}:20261112T150000\r\n` +
      `EXDATE;TZID=${modern}:20261119T150000\r\n` +
      `RRULE:FREQ=WEEKLY\r\nSUMMARY:${legacy}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`);
  });

  it("handles folded parameters", () => {
    const input = `${zone(modern)}${zone(legacy)}DTSTART;TZID="Moscow, St.\r\n Petersburg, Volgograd":20261112T150000\r\n`;
    expect(normalizeMoscowTimezone(input)).toContain("DTSTART;TZID=Europe/Moscow:20261112T150000");
  });

  it("leaves differing or missing definitions unchanged", () => {
    const different = `${zone(modern)}${zone(legacy, "+0400")}`;
    expect(normalizeMoscowTimezone(different)).toBe(different);
    const missing = zone(legacy);
    expect(normalizeMoscowTimezone(missing)).toBe(missing);
  });
});
