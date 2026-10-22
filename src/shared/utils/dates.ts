import type { Request } from "express";

export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function userAgent(req: Request): string {
  return String(req.headers["user-agent"] ?? "unknown").slice(0, 512);
}

export function dateRangeFromQuery(
  query: Record<string, unknown>,
  defaults: { days: number } = { days: 30 },
): { from: Date; to: Date } {
  const to = query.to ? new Date(String(query.to)) : new Date();
  const from = query.from
    ? new Date(String(query.from))
    : new Date(to.getTime() - defaults.days * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error(
      'Invalid date range. Use ISO 8601 dates for "from" and "to".',
    );
  }
  return { from, to };
}

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function bucketKey(
  date: Date,
  interval: "day" | "week" | "month",
): string {
  const iso = date.toISOString();
  if (interval === "month") return iso.slice(0, 7);
  if (interval === "week") {
    const day = startOfUtcDay(date);
    const weekday = day.getUTCDay();
    const diff = (weekday + 6) % 7;
    day.setUTCDate(day.getUTCDate() - diff);
    return day.toISOString().slice(0, 10);
  }
  return iso.slice(0, 10);
}

export function pickInterval(from: Date, to: Date): "day" | "week" | "month" {
  const days = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / 86_400_000),
  );
  if (days <= 45) return "day";
  if (days <= 200) return "week";
  return "month";
}
