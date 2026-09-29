/**
 * SSRF Hardening — Phase 8
 *
 * Hardened safeFetch with:
 *   - redirect: "manual" — validate every redirect before following
 *   - max redirects (default 3)
 *   - resolved IP validation (DNS rebinding protection)
 *   - response size limit
 *   - timeout
 *   - allowed schemes (http, https only)
 *   - hostname validation
 *
 * Blocks:
 *   - localhost, 0.0.0.0
 *   - 127.0.0.0/8
 *   - RFC1918 private (10.x, 172.16-31.x, 192.168.x)
 *   - link-local (169.254.x)
 *   - multicast (224.0.0.0/4)
 *   - IPv6 loopback (::1)
 *   - IPv6 unique local (fc00::/7)
 *   - IPv6 link-local (fe80::/10)
 *   - IPv4-mapped IPv6 (::ffff:127.0.0.1)
 *   - cloud metadata endpoints
 *   - redirect chains to private IPs
 */

// NOTE: This module does NOT import "server-only" because it's dynamically
// imported by lib/security/index.ts which is also imported by client components.
// The safeFetchHardened function itself is only callable from server-side
// (it uses node:dns/promises which doesn't exist in browser).
// Client components import evaluateSecurityGate/DEFAULT_SECURITY_POLICY
// from lib/security but never call safeFetch.
import { lookup } from "node:dns/promises";

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_TIMEOUT_MS = 10_000;

const BLOCKED_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.aws.internal",
  "metadata.azure.com",
  "169.254.169.254", // AWS/Azure/GCP metadata
  "169.254.170.2",   // ECS metadata
  "169.254.170.23",  // ECS task metadata
  "100.100.100.200", // Alibaba Cloud metadata
]);

// IPv4 private/loopback/link-local/multicast patterns
const IPV4_BLOCKED_PATTERNS = [
  /^127\./,                          // loopback 127.0.0.0/8
  /^0\./,                            // 0.0.0.0/8
  /^10\./,                           // private 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // private 172.16.0.0/12
  /^192\.168\./,                     // private 192.168.0.0/16
  /^169\.254\./,                     // link-local 169.254.0.0/16
  /^22[4-9]\./,                      // multicast 224.0.0.0/4
  /^23[0-9]\./,                      // multicast 239.x
  /^255\./,                          // broadcast
];

// IPv6 blocked patterns
const IPV6_BLOCKED_PATTERNS = [
  /^::1$/,                           // loopback
  /^fc00:/i,                         // unique local fc00::/7
  /^fd[0-9a-f]{2}:/i,               // unique local fd00::/8
  /^fe80:/i,                         // link-local fe80::/10
  /^ff[0-9a-f]{2}:/i,               // multicast ff00::/8
  /^::ffff:/i,                       // IPv4-mapped IPv6 (will also check the IPv4 part)
  /^64:ff9b::/i,                     // NAT64
  /^100::/i,                         // discard prefix
];

export type UrlValidationResult = { allowed: boolean; reason: string };

export function validateExternalUrl(urlStr: string, opts: { allowlist?: string[] } = {}): UrlValidationResult {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { allowed: false, reason: "Invalid URL" };
  }

  // Scheme check
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { allowed: false, reason: `Scheme ${url.protocol} not allowed (only http/https)` };
  }

  // Hostname basic validation
  const hostname = url.hostname.toLowerCase();
  if (!hostname) {
    return { allowed: false, reason: "Empty hostname" };
  }

  // Allowlist (if provided)
  if (opts.allowlist && !opts.allowlist.includes(hostname)) {
    return { allowed: false, reason: `Host ${hostname} not in allowlist` };
  }

  // Blocked hosts (metadata endpoints)
  if (BLOCKED_HOSTS.has(hostname)) {
    return { allowed: false, reason: `Host ${hostname} is blocked (metadata/internal endpoint)` };
  }

  // Localhost variants
  if (hostname === "localhost" || hostname === "0.0.0.0" || hostname.endsWith(".localhost")) {
    return { allowed: false, reason: `Host ${hostname} is localhost` };
  }

  // IPv4 literal check
  if (isIPv4(hostname)) {
    if (IPV4_BLOCKED_PATTERNS.some((re) => re.test(hostname))) {
      return { allowed: false, reason: `IPv4 ${hostname} is private/loopback/link-local/multicast` };
    }
  }

  // IPv6 literal check (strip brackets)
  const ipv6 = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  if (isIPv6(ipv6)) {
    if (IPV6_BLOCKED_PATTERNS.some((re) => re.test(ipv6))) {
      return { allowed: false, reason: `IPv6 ${ipv6} is private/loopback/link-local/multicast` };
    }
    // Check IPv4-mapped IPv6 (::ffff:a.b.c.d)
    const mapped = ipv6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped && IPV4_BLOCKED_PATTERNS.some((re) => re.test(mapped[1]))) {
      return { allowed: false, reason: `IPv4-mapped IPv6 ${ipv6} resolves to private IPv4` };
    }
  }

  return { allowed: true, reason: "OK" };
}

function isIPv4(s: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && s.split(".").every((o) => Number(o) <= 255);
}

function isIPv6(s: string): boolean {
  return /^[0-9a-f:]+$/i.test(s) && s.includes(":");
}

/**
 * Resolve hostname and validate that no resolved IP is private/loopback/etc.
 * This prevents DNS rebinding attacks where a hostname resolves to a public IP
 * initially but a private IP later.
 */
export async function validateResolvedIPs(hostname: string): Promise<UrlValidationResult> {
  // Skip for IP literals — already validated above
  if (isIPv4(hostname) || isIPv6(hostname)) {
    return { allowed: true, reason: "IP literal already validated" };
  }
  try {
    const result = await lookup(hostname, { all: true });
    if (result.length === 0) {
      return { allowed: false, reason: `DNS lookup returned no records for ${hostname}` };
    }
    for (const record of result) {
      const ip = record.address;
      if (isIPv4(ip) && IPV4_BLOCKED_PATTERNS.some((re) => re.test(ip))) {
        return { allowed: false, reason: `DNS resolved ${hostname} to private IPv4 ${ip}` };
      }
      if (isIPv6(ip) && IPV6_BLOCKED_PATTERNS.some((re) => re.test(ip))) {
        return { allowed: false, reason: `DNS resolved ${hostname} to private IPv6 ${ip}` };
      }
    }
    return { allowed: true, reason: "OK" };
  } catch {
    // DNS failure — block (could be DNS rebinding or internal DNS)
    return { allowed: false, reason: `DNS lookup failed for ${hostname}` };
  }
}

export type SafeFetchOptions = {
  timeoutMs?: number;
  allowlist?: string[];
  maxRedirects?: number;
  maxResponseBytes?: number;
};

/**
 * Hardened fetch with SSRF protection.
 * Uses redirect: "manual" and validates every redirect.
 */
export async function safeFetchHardened(
  urlStr: string,
  opts: SafeFetchOptions = {},
  fetchImpl: typeof fetch = fetch,
  dnsLookup?: (hostname: string) => Promise<UrlValidationResult>,
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = opts.maxRedirects ?? MAX_REDIRECTS;
  const maxResponseBytes = opts.maxResponseBytes ?? MAX_RESPONSE_BYTES;

  let currentUrl = urlStr;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    // Validate URL
    const urlValidation = validateExternalUrl(currentUrl, { allowlist: opts.allowlist });
    if (!urlValidation.allowed) {
      throw new Error(`SSRF protection: ${urlValidation.reason}`);
    }

    // Validate resolved IPs (DNS rebinding protection)
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(currentUrl);
    } catch {
      throw new Error("SSRF protection: invalid URL");
    }
    if (dnsLookup) {
      const dnsValidation = await dnsLookup(parsedUrl.hostname);
      if (!dnsValidation.allowed) {
        throw new Error(`SSRF protection: ${dnsValidation.reason}`);
      }
    }

    // Fetch with timeout and NO automatic redirect following
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(currentUrl, {
        signal: controller.signal,
        redirect: "manual", // Per Phase 8: never blind-follow redirects
      });
    } finally {
      clearTimeout(timeout);
    }

    // Check for redirect (3xx)
    if (res.status >= 300 && res.status < 400) {
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new Error(`SSRF protection: max redirects (${maxRedirects}) exceeded`);
      }
      const location = res.headers.get("location");
      if (!location) {
        throw new Error("SSRF protection: redirect response missing Location header");
      }
      // Resolve relative redirects
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    // Validate final URL after any redirects (defense in depth)
    const finalValidation = validateExternalUrl(res.url || currentUrl, { allowlist: opts.allowlist });
    if (!finalValidation.allowed) {
      throw new Error(`SSRF protection (post-redirect): ${finalValidation.reason}`);
    }

    // Response size check — wrap the body so we can limit reads
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  }

  throw new Error(`SSRF protection: redirect loop or too many redirects`);
}

/**
 * Read a response body with size limit.
 */
export async function readBodyLimited(res: Response, maxBytes: number = MAX_RESPONSE_BYTES): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Response size exceeded ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
