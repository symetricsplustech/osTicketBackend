import dns from "dns";
import net from "net";
import { BadRequestError } from "../errors";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part)))
    return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalised = address.toLowerCase();
  if (normalised === "::1" || normalised === "::") return true;
  if (normalised.startsWith("fe80")) return true;
  if (normalised.startsWith("fc") || normalised.startsWith("fd")) return true;
  if (normalised.startsWith("ff")) return true;
  if (normalised.startsWith("::ffff:")) {
    const mapped = normalised.replace("::ffff:", "");
    if (net.isIPv4(mapped)) return isPrivateIpv4(mapped);
  }
  return false;
}

export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) return isPrivateIpv4(address);
  if (net.isIPv6(address)) return isPrivateIpv6(address);
  return true;
}

export interface SafeUrlResult {
  url: URL;
  resolvedAddresses: string[];
}

export async function assertSafeOutboundUrl(
  rawUrl: string,
  options?: { allowHttp?: boolean },
): Promise<SafeUrlResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestError(
      "The destination URL is not a valid absolute URL.",
    );
  }

  const allowHttp = options?.allowHttp ?? false;
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new BadRequestError("Only HTTPS destinations are allowed.");
  }
  if (url.username || url.password) {
    throw new BadRequestError("URLs containing credentials are not allowed.");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new BadRequestError("The destination host is not allowed.");
  }

  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new BadRequestError(
        "The destination IP address is in a private or blocked range.",
      );
    }
    return { url, resolvedAddresses: [hostname] };
  }

  const addresses = await new Promise<string[]>((resolve, reject) => {
    dns.lookup(hostname, { all: true, verbatim: true }, (error, records) => {
      if (error)
        reject(
          new BadRequestError("The destination host could not be resolved."),
        );
      else resolve(records.map((record) => record.address));
    });
  });

  if (addresses.length === 0) {
    throw new BadRequestError("The destination host could not be resolved.");
  }
  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new BadRequestError(
        "The destination host resolves to a private or blocked IP range.",
      );
    }
  }

  return { url, resolvedAddresses: addresses };
}
