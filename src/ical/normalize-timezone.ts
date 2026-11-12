const LEGACY_MOSCOW = "Moscow, St.Petersburg, Volgograd";
const MOSCOW = "Europe/Moscow";

// Only merge the timezone definitions when they describe identical rules.
export const normalizeMoscowTimezone = (calendar: string): string => {
  const zones = [...calendar.matchAll(/^BEGIN:VTIMEZONE\r?\n[\s\S]*?^END:VTIMEZONE(?:\r?\n|$)/gm)];
  const legacy = zones.filter((zone) => /^TZID:Moscow, St\.Petersburg, Volgograd\r?$/m.test(zone[0]));
  const standard = zones.filter((zone) => /^TZID:Europe\/Moscow\r?$/m.test(zone[0]));
  if (legacy.length !== 1 || standard.length !== 1) return calendar;

  const legacyZone = legacy[0][0];
  const standardZone = standard[0][0];
  if (legacyZone.replace(`TZID:${LEGACY_MOSCOW}`, `TZID:${MOSCOW}`) !== standardZone) {
    return calendar;
  }

  // Unfold only changed content lines, leaving unrelated text and event data untouched.
  return calendar.replace(legacyZone, "").replace(
    /^[^\r\n]+(?:\r?\n[ \t][^\r\n]*)*/gm,
    (line) => {
      const unfolded = line.replace(/\r?\n[ \t]/g, "");
      const colon = unfolded.indexOf(":");
      if (colon < 0) return line;
      const header = unfolded.slice(0, colon);
      const updated = header.replace(/;TZID="Moscow, St\.Petersburg, Volgograd"(?=;|$)/gi, `;TZID=${MOSCOW}`);
      return updated === header ? line : updated + unfolded.slice(colon);
    },
  );
};
