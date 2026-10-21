import { fetch, ProxyAgent } from "undici";
import { config } from "../config.js";

export class SourceFetchError extends Error {
  constructor(url, statusCode, cloudflareBlock, message) {
    super(message);
    this.name = "SourceFetchError";
    this.url = url;
    this.statusCode = statusCode;
    this.cloudflareBlock = cloudflareBlock;
  }
}

function dispatcher() {
  if (config.scraper.httpProxy) {
    return new ProxyAgent(config.scraper.httpProxy);
  }
  return undefined;
}

export function browserHeaders(url, userAgent, extraHeaders = {}) {
  const headers = {
    Accept: extraHeaders.Accept || "text/html,application/xhtml+xml,application/xml,*/*",
    "Accept-Language": "az-AZ,az;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "max-age=0",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Sec-CH-UA": '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": '"Windows"',
  };
  if (userAgent) {
    headers["User-Agent"] = userAgent;
  }
  try {
    const parsed = new URL(url);
    headers.Referer = extraHeaders.Referer || `${parsed.origin}/`;
  } catch {
    // keep request without referer
  }
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value != null && value !== "") {
      headers[key] = value;
    }
  }
  return headers;
}

export function isCloudflareChallengeBody(body) {
  const lower = String(body || "").toLowerCase();
  return (
    lower.includes("cf-wrapper") ||
    lower.includes("cloudflare ray id") ||
    lower.includes("attention required! | cloudflare") ||
    lower.includes("sorry, you have been blocked")
  );
}

function toFetchException(url, status, body) {
  const cloudflare = status === 403 || status === 429 || isCloudflareChallengeBody(body);
  const hint = cloudflare
    ? " Cloudflare server IP-ni bloklayır — SCRAPER_FLARESOLVERR_URL və ya SCRAPER_HTTP_PROXY istifadə edin."
    : "";
  return new SourceFetchError(
    url,
    status,
    cloudflare,
    `HTTP ${status} for ${url}${hint}`,
  );
}

function isRetryableNetwork(err) {
  const code = err?.cause?.code || err?.code || "";
  const name = err?.name || "";
  return (
    name === "TimeoutError" ||
    name === "AbortError" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_SOCKET"
  );
}

async function directFetchOnce(url, extraHeaders = {}) {
  const response = await fetch(url, {
    method: "GET",
    headers: browserHeaders(url, config.scraper.userAgent, extraHeaders),
    dispatcher: dispatcher(),
    signal: AbortSignal.timeout(90_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw toFetchException(url, response.status, body);
  }
  if (isCloudflareChallengeBody(body)) {
    throw new SourceFetchError(url, response.status, true, "Cloudflare challenge səhifəsi qayıtdı");
  }
  return body;
}

async function directFetch(url, extraHeaders = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await directFetchOnce(url, extraHeaders);
    } catch (err) {
      lastError = err;
      if (err instanceof SourceFetchError && err.cloudflareBlock) {
        throw err;
      }
      if (!isRetryableNetwork(err) || attempt === 3) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}

async function fetchWithFlareSolverr(targetUrl) {
  const base = config.scraper.flaresolverrUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/v1`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      cmd: "request.get",
      url: targetUrl,
      maxTimeout: 60_000,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    throw new Error(`FlareSolverr HTTP ${response.status}`);
  }
  const root = await response.json();
  if (String(root.status || "").toLowerCase() !== "ok") {
    throw new Error(`FlareSolverr: ${root.message || "unknown error"}`);
  }
  const httpStatus = root.solution?.status ?? 0;
  const html = root.solution?.response || "";
  if (httpStatus < 200 || httpStatus >= 300 || !html) {
    throw new Error(`FlareSolverr returned HTTP ${httpStatus} for ${targetUrl}`);
  }
  console.log(`FlareSolverr uğurlu: url=${targetUrl} status=${httpStatus}`);
  return html;
}

async function fetchWithBypass(url, original) {
  const flaresolverrUrl = config.scraper.flaresolverrUrl;
  if (flaresolverrUrl) {
    try {
      return await fetchWithFlareSolverr(url);
    } catch (flareEx) {
      console.error(`FlareSolverr uğursuz: url=${url}`, flareEx);
    }
  } else {
    console.warn(
      "SCRAPER_FLARESOLVERR_URL təyin edilməyib. Datacenter IP-dən bina.az/tap.az bloklana bilər.",
    );
  }
  throw original;
}

export async function fetchJson(url, extraHeaders = {}) {
  const htmlOrJson = await fetchHtml(url, extraHeaders);
  try {
    return JSON.parse(htmlOrJson);
  } catch {
    throw new Error(`JSON parse xətası: ${url}`);
  }
}

export async function fetchHtml(url, extraHeaders = {}) {
  try {
    return await directFetch(url, extraHeaders);
  } catch (err) {
    if (err instanceof SourceFetchError && err.cloudflareBlock) {
      console.warn(`Cloudflare blokladı (${err.statusCode}): ${url}`);
      return fetchWithBypass(url, err);
    }
    throw err;
  }
}
