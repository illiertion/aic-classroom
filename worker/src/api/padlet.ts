import { Hono } from "hono";
import type { AppEnv } from "../types";
import { assertSameOrigin, clientKey, requireTeacher, throttle } from "../lib/auth";
import { ApiError, badRequest } from "../lib/errors";
import { safeJson } from "../lib/db";
import type { PadletResolved } from "../../../shared/protocol";

const padlet = new Hono<AppEnv>();

const KEY_RE = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_PAGE_CHARS = 2_000_000;

/** Permalink ids are alphanumeric and, in practice, contain a digit. */
function isPermalinkKey(value: string | undefined): value is string {
  return Boolean(value && KEY_RE.test(value) && /\d/.test(value));
}

function normalizeInput(input: string): URL {
  let value = input.trim();
  const iframe = value.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframe?.[1]) value = iframe[1];
  if (!value) throw badRequest("Padlet 주소나 embed 코드를 붙여 넣어 주세요.");
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw badRequest("Padlet 주소 형식이 올바르지 않습니다.");
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "padlet.com") {
    throw badRequest("padlet.com 주소만 가져올 수 있습니다.");
  }
  url.protocol = "https:";
  url.hostname = "padlet.com";
  url.hash = "";
  return url;
}

function keyFromUrl(value: string | URL): string | null {
  let url: URL;
  try {
    url = typeof value === "string" ? new URL(value, "https://padlet.com") : value;
  } catch {
    return null;
  }
  const embed = url.pathname.match(/\/embed\/([A-Za-z0-9_-]+)/i);
  if (embed?.[1] && KEY_RE.test(embed[1])) return embed[1];

  const permalink = url.pathname.match(/\/padlets\/[^/]*-([A-Za-z0-9_-]+)\/?$/i);
  if (isPermalinkKey(permalink?.[1])) return permalink[1];

  // Custom Padlet URLs keep the unique id at the end of the last path segment:
  // /teacher/my-board-dsrl7hmiyqp8vk99
  const trailing = url.pathname.match(/-([A-Za-z0-9]{10,64})\/?$/);
  if (isPermalinkKey(trailing?.[1])) return trailing[1];
  return null;
}

function keyFromHtml(html: string): string | null {
  const ogUrl = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1];
  const fromOg = ogUrl ? keyFromUrl(ogUrl) : null;
  if (fromOg) return fromOg;

  const embed = html.match(/padlet\.com\/embed\/([A-Za-z0-9_-]{6,64})/i)?.[1];
  if (embed && KEY_RE.test(embed)) return embed;

  const permalink = html.match(/padlet\.com\/padlets\/[^"'\s<]*-([A-Za-z0-9_-]{6,64})/i)?.[1];
  if (isPermalinkKey(permalink)) return permalink;

  const jsonKey = html.match(/["'](?:padlet_?id|padletId|key)["']\s*:\s*["']([A-Za-z0-9_-]{6,64})["']/i)?.[1];
  return jsonKey && KEY_RE.test(jsonKey) ? jsonKey : null;
}

function titleFromHtml(html: string): string | null {
  const raw =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    null;
  if (!raw) return null;
  const decoded = raw
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim()
    .slice(0, 160);
  return decoded || null;
}

/**
 * Resolve a public Padlet board URL / embed code to the embeddable URL. We only
 * fetch padlet.com (never arbitrary user URLs), and the board itself is still
 * rendered by Padlet inside the iframe, not copied into AIC storage.
 */
padlet.post("/resolve", async (c) => {
  assertSameOrigin(c);
  await requireTeacher(c);
  throttle(clientKey(c, "padlet-resolve"), 30, 60_000);

  const body = await safeJson<{ url?: unknown }>(c);
  if (!body || typeof body.url !== "string") {
    throw badRequest("Padlet 주소를 입력해 주세요.");
  }
  const source = normalizeInput(body.url);
  const immediateKey = keyFromUrl(source);
  if (immediateKey) {
    const resolved: PadletResolved = {
      sourceUrl: source.toString(),
      embedUrl: `https://padlet.com/embed/${immediateKey}`,
      title: null,
    };
    return c.json({ padlet: resolved });
  }

  let response: Response;
  try {
    response = await fetch(source.toString(), {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "AIC-Padlet-Resolver/1.0",
      },
    });
  } catch {
    throw new ApiError(502, "padlet_unreachable", "Padlet에 연결하지 못했습니다.");
  }
  if (!response.ok) {
    throw new ApiError(
      502,
      "padlet_unreachable",
      `Padlet이 응답하지 않았습니다. (${response.status})`,
    );
  }
  const finalHost = new URL(response.url).hostname.toLowerCase().replace(/^www\./, "");
  if (finalHost !== "padlet.com") {
    throw badRequest("Padlet 주소만 가져올 수 있습니다.");
  }
  const html = (await response.text()).slice(0, MAX_PAGE_CHARS);
  const key = keyFromUrl(response.url) ?? keyFromHtml(html);
  if (!key) {
    throw badRequest(
      "공개 Padlet의 embed 주소를 찾지 못했습니다. Padlet의 공유 → Embed에서 복사한 주소를 붙여 넣어 주세요.",
      "padlet_not_public",
    );
  }
  const resolved: PadletResolved = {
    sourceUrl: response.url || source.toString(),
    embedUrl: `https://padlet.com/embed/${key}`,
    title: titleFromHtml(html),
  };
  return c.json({ padlet: resolved });
});

export default padlet;