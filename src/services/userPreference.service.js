/**
 * User preference service.
 *
 * The Phase 00 "System Preferences" screens were falling back to the instance
 * profile, so a user's Date & Time preferences rendered the tenant record.
 * Preferences belong to the signed-in user, and the columns that exist today
 * live in `user_locale_preferences` (locale, timezone) with `users.locale` and
 * `users.timezone` as the older copy.
 *
 * Reads merge both so either source answers, and writes keep
 * `user_locale_preferences` as the row of record while mirroring the values
 * onto the user so existing code that reads users.locale stays correct.
 */

const { getDB } = require("../config/db");
const ApiError = require("../utils/ApiError");

const LOCALES = [
  "en-US", "en-GB", "en-AU", "en-CA", "en-IN", "en-ZA",
  "de-DE", "fr-FR", "es-ES", "it-IT", "pt-BR", "nl-NL", "sv-SE", "pl-PL",
];

const DEFAULTS = { locale: "en-US", timezone: "UTC" };

const isLocale = (value) => LOCALES.includes(value);

const isTimezone = (value) => {
  if (typeof value !== "string" || !value) return false;
  try {
    // Throws for an invalid zone, which is the check we want.
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const requireUser = (userId) => {
  if (!userId) throw new ApiError(401, "A signed-in user is required");
  return userId;
};

const listPreferences = async ({ userId }) => {
  const user = requireUser(userId);
  const db = getDB();
  const [row, profile] = await Promise.all([
    db("user_locale_preferences").where({ user_id: user }).first(),
    db("users").select("locale", "timezone").where({ id: user }).first(),
  ]);
  return {
    userId: user,
    locale: row?.locale || profile?.locale || DEFAULTS.locale,
    timezone: row?.timezone || profile?.timezone || DEFAULTS.timezone,
    source: row ? "user_locale_preferences" : profile ? "users" : "defaults",
  };
};

const updatePreferences = async ({ userId, locale, timezone }) => {
  const user = requireUser(userId);
  const db = getDB();
  const current = await listPreferences({ userId: user });

  const next = { ...current };
  if (locale !== undefined) {
    if (!isLocale(locale)) throw new ApiError(422, `Unsupported locale: ${locale}`);
    next.locale = locale;
  }
  if (timezone !== undefined) {
    if (!isTimezone(timezone)) throw new ApiError(422, `Unsupported time zone: ${timezone}`);
    next.timezone = timezone;
  }

  const changed = next.locale !== current.locale || next.timezone !== current.timezone;
  if (changed) {
    const existing = await db("user_locale_preferences").where({ user_id: user }).first();
    if (existing) {
      await db("user_locale_preferences")
        .where({ id: existing.id })
        .update({ locale: next.locale, timezone: next.timezone, updated_at: db.fn.now() });
    } else {
      await db("user_locale_preferences").insert({
        user_id: user,
        locale: next.locale,
        timezone: next.timezone,
      });
    }
    // Keep users.locale / users.timezone in step for existing readers.
    await db("users")
      .where({ id: user })
      .update({ locale: next.locale, timezone: next.timezone });
  }

  return { ...next, source: "user_locale_preferences", changed };
};

module.exports = {
  listPreferences,
  updatePreferences,
  LOCALES,
  DEFAULTS,
};
