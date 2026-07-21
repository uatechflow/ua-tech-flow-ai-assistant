import promptAnalyzeVacancy from "./prompts/1_analyze_vacancy.txt";
import promptAdaptResumeForVacancy from "./prompts/2_adapt_resume_for_vacancy.txt";
import promptGenerateClFromJson from "./prompts/2_generate_cl_from_json.txt";
import promptAtsAnalysis from "./prompts/3_ats_analysis.txt";
import promptExtractKeywordsForSearch from "./prompts/4_extract_keywords_for_search.txt";
import promptSuggestJobTitles from "./prompts/5_suggest_job_titles.txt";
import promptMasterCh from "./prompts/master_prompt_ch.txt";
import promptMasterEu from "./prompts/master_prompt_eu.txt";
import promptMasterUs from "./prompts/master_prompt_us.txt";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const ADZUNA_API_URL_BASE = "https://api.adzuna.com/v1/api/jobs";

const PROMPTS = Object.freeze({
  "1_analyze_vacancy.txt": promptAnalyzeVacancy,
  "2_adapt_resume_for_vacancy.txt": promptAdaptResumeForVacancy,
  "2_generate_cl_from_json.txt": promptGenerateClFromJson,
  "3_ats_analysis.txt": promptAtsAnalysis,
  "4_extract_keywords_for_search.txt": promptExtractKeywordsForSearch,
  "5_suggest_job_titles.txt": promptSuggestJobTitles,
  "master_prompt_ch.txt": promptMasterCh,
  "master_prompt_eu.txt": promptMasterEu,
  "master_prompt_us.txt": promptMasterUs,
});

const COUNTRY_PROMPT = Object.freeze({
  ch: "master_prompt_ch.txt",
  eu: "master_prompt_eu.txt",
  us: "master_prompt_us.txt",
});

const COUNTRY_MAP = Object.freeze({
  Switzerland: "ch",
  Germany: "de",
  Poland: "pl",
  Italy: "it",
  France: "fr",
  US: "us",
  USA: "us",
  "United States": "us",
  GB: "gb",
  "United Kingdom": "gb",
});

const LANGUAGE_MAP = Object.freeze({
  uk: "Ukrainian",
  en: "English",
  de: "German",
});

const ACTION_ALIASES = Object.freeze({
  adapt_resume: "adapt_resume",
  "adapt-resume": "adapt_resume",

  analyze_vacancy: "analyze_vacancy",

  adapt_resume_for_vacancy: "adapt_resume_for_vacancy",
  adapt_for_vacancy: "adapt_resume_for_vacancy",

  generate_cover_letter: "generate_cover_letter",
  "cover-letter-only": "generate_cover_letter",

  ats_analysis: "ats_analysis",
  "ats-check": "ats_analysis",

  suggest_job_titles: "suggest_job_titles",
  "find-vacancies": "suggest_job_titles",

  search_jobs: "search_jobs",
  "search-jobs": "search_jobs",

  extract_keywords_for_search: "extract_keywords_for_search",

  search_courses: "search_courses",
  "search-courses": "search_courses",
  "search-education": "search_courses",

  // Legacy combined action kept for backward compatibility with current UI.
  "adapt-for-vacancy": "adapt_for_vacancy_bundle",
  adapt_for_vacancy_bundle: "adapt_for_vacancy_bundle",
});

function nowIso() {
  return new Date().toISOString();
}

function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function log(level, event, meta = {}) {
  const entry = JSON.stringify({
    ts: nowIso(),
    level,
    event,
    ...meta,
  });
  if (level === "error") {
    console.error(entry);
    return;
  }
  console.log(entry);
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",

      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",

      ...extraHeaders,
    },
  });
}

function successPayload(data = {}) {
  return {
    success: true,
    status: "success",
    ...data,
  };
}

function errorPayload(message) {
  return {
    success: false,
    error: String(message || "Unexpected error"),
  };
}

function getEnvInt(env, key, fallbackMs) {
  const value = Number.parseInt(env[key] || "", 10);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallbackMs;
}

function getRequiredSecret(env, key) {
  const value = env[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required secret: ${key}`);
  }
  return value.trim();
}

function normalizeAction(value) {
  if (typeof value !== "string") {
    return null;
  }
  const key = value.trim();
  return ACTION_ALIASES[key] || null;
}

function normalizeLanguage(value) {
  if (typeof value !== "string") {
    return "en";
  }
  return LANGUAGE_MAP[value] ? value : "en";
}

function normalizeCountry(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (COUNTRY_PROMPT[normalized]) {
    return normalized;
  }
  if (normalized === "switzerland") return "ch";
  if (normalized === "european union") return "eu";
  if (normalized === "united states") return "us";
  return null;
}

function asNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Field "${fieldName}" must be a non-empty string`);
  }
  return value.trim();
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseJsonObject(rawText, sourceName) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`${sourceName}: invalid JSON payload`);
  }
  if (!isObject(parsed)) {
    throw new Error(`${sourceName}: root element must be a JSON object`);
  }
  return parsed;
}

function cleanAiResponse(text) {
  let result = String(text || "");
  const patterns = [
    /---ADAPTED RESUME---/gi,
    /---АДАПТОВАНЕ РЕЗЮМЕ---/gi,
    /---COVER LETTER---/gi,
    /---СУПРОВІДНИЙ ЛИСТ---/gi,
    /---SPLIT_HERE---/gi,
    /```json/gi,
    /```/g,
    /^\s*(Особисті дані|Особисті данні|Personal Data|Personal Information|Persönliche Daten|Persönliche Informationen)\s*:?\s*$/gim,
    /^Примітка:.*?$/gim,
    /^Note:.*?$/gim,
    /^Hinweis:.*?$/gim,
    /Based on the provided text,? no .*?\./gi,
    /This section is omitted\./gi,
    /No data available\./gi,
  ];

  for (const pattern of patterns) {
    result = result.replace(pattern, "");
  }

  const hallucinationPatterns = [
    /\[Your[^\]]*\]/gi,
    /\(example[^)]*\)/gi,
    /placeholder/gi,
    /insert your/gi,
    /sample /gi,
    /\[insert/gi,
  ];
  for (const pattern of hallucinationPatterns) {
    result = result.replace(pattern, "");
  }

  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  result = result.replace(/\*\*(.*?)\*\*/g, "$1");
  result = result.replace(/\*(.*?)\*/g, "$1");
  result = result.replace(/^\s*#+\s*/gm, "");
  result = result.replace(/^\s*[-*]\s+/gm, "");
  result = result.replace(/^\s*\d+[.)]\s+/gm, "");
  result = result.replace(/\n{3,}/g, "\n\n");
  return result.trim();
}

function getPrompt(filename) {
  const prompt = PROMPTS[filename];
  if (!prompt) {
    throw new Error(`Prompt not found: ${filename}`);
  }
  return prompt;
}

function deriveErrorStatusCode(message) {
  const msg = String(message || "").toLowerCase();
  if (
    msg.includes('field "') ||
    msg.includes("unsupported action") ||
    msg.includes("invalid json") ||
    msg.includes("must be") ||
    msg.includes("root element")
  ) {
    return 400;
  }
  return 500;
}

function validateSuggestedTitles(payload) {
  const suggestedTitles = payload?.suggested_titles;
  if (!Array.isArray(suggestedTitles)) {
    throw new Error("suggested_titles must be an array");
  }
  return suggestedTitles
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 10);
}

function validateSearchKeywords(payload) {
  const title = typeof payload?.search_job_title === "string" ? payload.search_job_title.trim() : "";
  const keywords = Array.isArray(payload?.search_keywords)
    ? payload.search_keywords
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .slice(0, 10)
    : [];
  return {
    search_job_title: title,
    search_keywords: keywords,
  };
}

const SUPPORTED_LOCALES = new Set(["uk", "en", "de"]);
const CONTENT_TYPES = new Set(["news", "event"]);
const PUBLIC_CONTENT_PAGE_SIZE = 9;
const ADMIN_CONTENT_PAGE_SIZE = 30;

function getDb(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB is not configured");
  }
  return env.DB;
}

function normalizeLocale(value) {
  return SUPPORTED_LOCALES.has(value) ? value : "uk";
}

function normalizeContentType(value) {
  return CONTENT_TYPES.has(value) ? value : null;
}

function toInt(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function slugify(value) {
  const base = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return base || `item-${Date.now()}`;
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const parts = cookie.split(";").map((part) => part.trim());
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function timingSafeEqualString(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes) {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(String(value || ""));
  return bytesToHex(await crypto.subtle.digest("SHA-256", data));
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function hashPassword(password, salt, iterations = 120000) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(salt),
      iterations,
    },
    key,
    256
  );
  return bytesToHex(bits);
}

function sessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 7, secure = true) {
  return [
    `ja_admin_session=${token}`,
    "Path=/",
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}

function clearSessionCookie(secure = true) {
  return [
    "ja_admin_session=",
    "Path=/",
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}

async function requireAdmin(request, env) {
  const token = getCookie(request, "ja_admin_session");
  if (!token) throw new Error("Unauthorized");
  const tokenHash = await sha256Hex(token);
  const row = await getDb(env)
    .prepare(
      `SELECT s.id, s.user_id, u.email
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now')
       LIMIT 1`
    )
    .bind(tokenHash)
    .first();
  if (!row) throw new Error("Unauthorized");
  return row;
}

async function loginAdmin(request, env) {
  const body = await request.json();
  const email = String(body.email || env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    return jsonResponse(errorPayload("Email and password are required"), 400);
  }

  const db = getDb(env);
  let user = await db.prepare("SELECT * FROM admin_users WHERE email = ? LIMIT 1").bind(email).first();

  if (!user) {
    const setupEmail = String(env.ADMIN_EMAIL || "admin@uatechflow.org").trim().toLowerCase();
    const setupPassword = String(env.ADMIN_SETUP_PASSWORD || "").trim();
    if (email !== setupEmail || !setupPassword || password !== setupPassword) {
      return jsonResponse(errorPayload("Invalid credentials"), 401);
    }
    const salt = randomToken(16);
    const passwordHash = await hashPassword(password, salt);
    await db
      .prepare("INSERT INTO admin_users (email, password_hash, password_salt, password_iterations) VALUES (?, ?, ?, ?)")
      .bind(email, passwordHash, salt, 120000)
      .run();
    user = await db.prepare("SELECT * FROM admin_users WHERE email = ? LIMIT 1").bind(email).first();
  }

  const candidateHash = await hashPassword(password, user.password_salt, user.password_iterations);
  if (!timingSafeEqualString(candidateHash, user.password_hash)) {
    return jsonResponse(errorPayload("Invalid credentials"), 401);
  }

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  await db
    .prepare(
      `INSERT INTO admin_sessions (user_id, token_hash, expires_at, user_agent)
       VALUES (?, ?, datetime('now', '+7 days'), ?)`
    )
    .bind(user.id, tokenHash, request.headers.get("User-Agent") || "")
    .run();

  const secureCookie = String(env.ADMIN_COOKIE_SECURE || "true").toLowerCase() !== "false";
  return jsonResponse(successPayload({ email: user.email }), 200, { "set-cookie": sessionCookie(token, 60 * 60 * 24 * 7, secureCookie) });
}

async function logoutAdmin(request, env) {
  const token = getCookie(request, "ja_admin_session");
  if (token && env.DB) {
    await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
  }
  const secureCookie = String(env.ADMIN_COOKIE_SECURE || "true").toLowerCase() !== "false";
  return jsonResponse(successPayload(), 200, { "set-cookie": clearSessionCookie(secureCookie) });
}

async function getAdminMe(request, env) {
  const admin = await requireAdmin(request, env);
  return jsonResponse(successPayload({ email: admin.email }), 200);
}

function mapContentRow(row) {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    status: row.status,
    featured: Boolean(row.featured),
    category_id: row.category_id,
    category_slug: row.category_slug || null,
    category_title: row.category_title || null,
    image_key: row.image_key || null,
    image_url: row.image_url || null,
    published_at: row.published_at || null,
    event_date: row.event_date || null,
    event_location: row.event_location || null,
    event_link: row.event_link || null,
    locale: row.locale || null,
    title: row.title || "",
    excerpt: row.excerpt || "",
    body: row.body || "",
    tags: row.tags ? row.tags.split(",").filter(Boolean) : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listPublicContent(request, env, type) {
  const url = new URL(request.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const page = toInt(url.searchParams.get("page"), 1);
  const pageSize = Math.min(toInt(url.searchParams.get("pageSize"), PUBLIC_CONTENT_PAGE_SIZE), 30);
  const offset = (page - 1) * pageSize;
  const q = String(url.searchParams.get("q") || "").trim();
  const category = String(url.searchParams.get("category") || "").trim();
  const tag = String(url.searchParams.get("tag") || "").trim();
  const featured = url.searchParams.get("featured");
  const upcoming = url.searchParams.get("upcoming");
  const includeAllTypes = type === "all";

  const where = ["i.status = 'published'", "l.locale = ?"];
  const binds = [locale];
  if (!includeAllTypes) {
    where.unshift("i.type = ?");
    binds.unshift(type);
  }
  if (q) {
    where.push("(l.title LIKE ? OR l.excerpt LIKE ? OR l.body LIKE ?)");
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (category) {
    where.push("c.slug = ?");
    binds.push(category);
  }
  if (featured === "1" || featured === "true") {
    where.push("i.featured = 1");
  }
  if ((type === "event" || includeAllTypes) && (upcoming === "1" || upcoming === "true")) {
    where.push("(i.event_date IS NULL OR date(i.event_date) >= date('now'))");
  }
  if (tag) {
    where.push(
      `EXISTS (
        SELECT 1 FROM content_item_tags cit
        JOIN tags t ON t.id = cit.tag_id
        WHERE cit.content_item_id = i.id AND t.slug = ?
      )`
    );
    binds.push(tag);
  }

  const whereSql = where.join(" AND ");
  const orderSql =
    type === "event"
      ? "ORDER BY CASE WHEN i.event_date IS NULL THEN 1 ELSE 0 END, i.event_date ASC, COALESCE(i.published_at, i.created_at) DESC"
      : "ORDER BY COALESCE(i.event_date, i.published_at, i.created_at) DESC";
  const countRow = await getDb(env)
    .prepare(
      `SELECT COUNT(*) AS total
       FROM content_items i
       JOIN content_item_locales l ON l.content_item_id = i.id
       LEFT JOIN categories c ON c.id = i.category_id
       WHERE ${whereSql}`
    )
    .bind(...binds)
    .first();

  const rows = await getDb(env)
    .prepare(
      `SELECT i.*, l.locale, l.title, l.excerpt, l.body, c.slug AS category_slug,
              CASE ? WHEN 'en' THEN c.title_en WHEN 'de' THEN c.title_de ELSE c.title_uk END AS category_title,
              GROUP_CONCAT(t.slug) AS tags
       FROM content_items i
       JOIN content_item_locales l ON l.content_item_id = i.id
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN content_item_tags cit ON cit.content_item_id = i.id
       LEFT JOIN tags t ON t.id = cit.tag_id
       WHERE ${whereSql}
       GROUP BY i.id, l.id
       ${orderSql}
       LIMIT ? OFFSET ?`
    )
    .bind(locale, ...binds, pageSize, offset)
    .all();

  return jsonResponse(
    successPayload({
      items: (rows.results || []).map(mapContentRow),
      meta: {
        page,
        pageSize,
        total: countRow?.total || 0,
      },
    }),
    200
  );
}

async function getPublicContentDetail(request, env, type, slug) {
  const url = new URL(request.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const includeAllTypes = type === "all";
  const typeSql = includeAllTypes ? "" : "AND i.type = ?";
  const binds = includeAllTypes ? [locale, slug, locale] : [locale, slug, locale, type];
  const row = await getDb(env)
    .prepare(
      `SELECT i.*, l.locale, l.title, l.excerpt, l.body, c.slug AS category_slug,
              CASE ? WHEN 'en' THEN c.title_en WHEN 'de' THEN c.title_de ELSE c.title_uk END AS category_title,
              GROUP_CONCAT(t.slug) AS tags
       FROM content_items i
       JOIN content_item_locales l ON l.content_item_id = i.id
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN content_item_tags cit ON cit.content_item_id = i.id
       LEFT JOIN tags t ON t.id = cit.tag_id
       WHERE i.slug = ? AND i.status = 'published' AND l.locale = ? ${typeSql}
       GROUP BY i.id, l.id
       LIMIT 1`
    )
    .bind(...binds)
    .first();
  if (!row) return jsonResponse(errorPayload("Not found"), 404);
  return jsonResponse(successPayload({ item: mapContentRow(row) }), 200);
}

async function listMeta(env, type = "shared", locale = "uk") {
  const includeAllTypes = type === "all";
  const categories = await getDb(env)
    .prepare(
      `SELECT id, slug, type,
              CASE ? WHEN 'en' THEN title_en WHEN 'de' THEN title_de ELSE title_uk END AS title
       FROM categories
       WHERE ${includeAllTypes ? "type IN ('news', 'event', 'shared')" : "type IN (?, 'shared')"}
       ORDER BY title`
    )
    .bind(...(includeAllTypes ? [locale] : [locale, type]))
    .all();
  const tags = await getDb(env)
    .prepare(
      `SELECT id, slug,
              CASE ? WHEN 'en' THEN title_en WHEN 'de' THEN title_de ELSE title_uk END AS title
       FROM tags
       ORDER BY title`
    )
    .bind(locale)
    .all();
  return { categories: categories.results || [], tags: tags.results || [] };
}

async function getPublicMeta(request, env) {
  const url = new URL(request.url);
  const requestedType = url.searchParams.get("type");
  const type = requestedType === "all" ? "all" : normalizeContentType(requestedType) || "news";
  const locale = normalizeLocale(url.searchParams.get("locale"));
  return jsonResponse(successPayload(await listMeta(env, type, locale)), 200);
}

function normalizeContentPayload(payload, fallbackType = "news") {
  const type = normalizeContentType(payload.type) || fallbackType;
  const locales = isObject(payload.locales) ? payload.locales : {};
  const normalizedLocales = {};
  for (const locale of SUPPORTED_LOCALES) {
    const item = isObject(locales[locale]) ? locales[locale] : {};
    const title = String(item.title || "").trim();
    const body = String(item.body || "").trim();
    const excerpt = String(item.excerpt || "").trim();
    if (title || body || excerpt) {
      normalizedLocales[locale] = {
        title: title || "Untitled",
        excerpt,
        body,
        seo_title: String(item.seo_title || title || "").trim(),
        seo_description: String(item.seo_description || excerpt || "").trim(),
      };
    }
  }
  if (!Object.keys(normalizedLocales).length) {
    throw new Error("At least one localized content block is required");
  }
  const primaryTitle = normalizedLocales.uk?.title || normalizedLocales.en?.title || normalizedLocales.de?.title;
  return {
    type,
    slug: slugify(payload.slug || primaryTitle),
    status: ["draft", "published", "unpublished"].includes(payload.status) ? payload.status : "draft",
    featured: payload.featured ? 1 : 0,
    category_id: payload.category_id ? Number(payload.category_id) : null,
    image_key: String(payload.image_key || "").trim() || null,
    image_url: String(payload.image_url || "").trim() || null,
    published_at: String(payload.published_at || "").trim() || null,
    event_date: String(payload.event_date || "").trim() || null,
    event_location: String(payload.event_location || "").trim() || null,
    event_link: String(payload.event_link || "").trim() || null,
    locales: normalizedLocales,
    tag_ids: Array.isArray(payload.tag_ids) ? payload.tag_ids.map((id) => Number(id)).filter(Boolean) : [],
  };
}

async function listAdminContent(request, env) {
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const type = normalizeContentType(url.searchParams.get("type")) || "news";
  const page = toInt(url.searchParams.get("page"), 1);
  const pageSize = Math.min(toInt(url.searchParams.get("pageSize"), ADMIN_CONTENT_PAGE_SIZE), 100);
  const offset = (page - 1) * pageSize;
  const rows = await getDb(env)
    .prepare(
      `SELECT i.*, c.slug AS category_slug,
              (SELECT title FROM content_item_locales WHERE content_item_id = i.id ORDER BY locale = 'uk' DESC LIMIT 1) AS title,
              (SELECT excerpt FROM content_item_locales WHERE content_item_id = i.id ORDER BY locale = 'uk' DESC LIMIT 1) AS excerpt
       FROM content_items i
       LEFT JOIN categories c ON c.id = i.category_id
       WHERE i.type = ?
       ORDER BY i.updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(type, pageSize, offset)
    .all();
  const countRow = await getDb(env)
    .prepare("SELECT COUNT(*) AS total FROM content_items WHERE type = ?")
    .bind(type)
    .first();
  return jsonResponse(successPayload({ items: rows.results || [], meta: { page, pageSize, total: countRow?.total || 0 } }), 200);
}

async function getAdminContent(request, env, id) {
  await requireAdmin(request, env);
  const db = getDb(env);
  const item = await db.prepare("SELECT * FROM content_items WHERE id = ?").bind(id).first();
  if (!item) return jsonResponse(errorPayload("Not found"), 404);
  const locales = await db.prepare("SELECT * FROM content_item_locales WHERE content_item_id = ?").bind(id).all();
  const tags = await db.prepare("SELECT tag_id FROM content_item_tags WHERE content_item_id = ?").bind(id).all();
  return jsonResponse(
    successPayload({
      item: {
        ...item,
        featured: Boolean(item.featured),
        locales: Object.fromEntries((locales.results || []).map((row) => [row.locale, row])),
        tag_ids: (tags.results || []).map((row) => row.tag_id),
      },
    }),
    200
  );
}

async function saveContentLocales(db, itemId, locales) {
  for (const [locale, item] of Object.entries(locales)) {
    await db
      .prepare(
        `INSERT INTO content_item_locales
         (content_item_id, locale, title, excerpt, body, seo_title, seo_description, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(content_item_id, locale) DO UPDATE SET
           title = excluded.title,
           excerpt = excluded.excerpt,
           body = excluded.body,
           seo_title = excluded.seo_title,
           seo_description = excluded.seo_description,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(itemId, locale, item.title, item.excerpt, item.body, item.seo_title, item.seo_description)
      .run();
  }
}

async function saveContentTags(db, itemId, tagIds) {
  await db.prepare("DELETE FROM content_item_tags WHERE content_item_id = ?").bind(itemId).run();
  for (const tagId of tagIds) {
    await db.prepare("INSERT OR IGNORE INTO content_item_tags (content_item_id, tag_id) VALUES (?, ?)").bind(itemId, tagId).run();
  }
}

async function createAdminContent(request, env) {
  await requireAdmin(request, env);
  const payload = normalizeContentPayload(await request.json());
  const db = getDb(env);
  const result = await db
    .prepare(
      `INSERT INTO content_items
       (type, slug, status, featured, category_id, image_key, image_url, published_at, event_date, event_location, event_link, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .bind(
      payload.type,
      payload.slug,
      payload.status,
      payload.featured,
      payload.category_id,
      payload.image_key,
      payload.image_url,
      payload.published_at,
      payload.event_date,
      payload.event_location,
      payload.event_link
    )
    .run();
  const itemId = result.meta.last_row_id;
  await saveContentLocales(db, itemId, payload.locales);
  await saveContentTags(db, itemId, payload.tag_ids);
  return jsonResponse(successPayload({ id: itemId }), 201);
}

async function updateAdminContent(request, env, id) {
  await requireAdmin(request, env);
  const payload = normalizeContentPayload(await request.json());
  const db = getDb(env);
  await db
    .prepare(
      `UPDATE content_items SET
         type = ?, slug = ?, status = ?, featured = ?, category_id = ?, image_key = ?, image_url = ?,
         published_at = ?, event_date = ?, event_location = ?, event_link = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      payload.type,
      payload.slug,
      payload.status,
      payload.featured,
      payload.category_id,
      payload.image_key,
      payload.image_url,
      payload.published_at,
      payload.event_date,
      payload.event_location,
      payload.event_link,
      id
    )
    .run();
  await saveContentLocales(db, id, payload.locales);
  await saveContentTags(db, id, payload.tag_ids);
  return jsonResponse(successPayload({ id }), 200);
}

async function deleteAdminContent(request, env, id) {
  await requireAdmin(request, env);
  await getDb(env).prepare("DELETE FROM content_items WHERE id = ?").bind(id).run();
  return jsonResponse(successPayload(), 200);
}

async function setContentStatus(request, env, id, status) {
  await requireAdmin(request, env);
  const publishedAtSql = status === "published" ? "COALESCE(published_at, CURRENT_TIMESTAMP)" : "published_at";
  await getDb(env)
    .prepare(`UPDATE content_items SET status = ?, published_at = ${publishedAtSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(status, id)
    .run();
  return jsonResponse(successPayload(), 200);
}

async function uploadAdminImage(request, env) {
  await requireAdmin(request, env);
  if (!env.MEDIA) {
    return jsonResponse(errorPayload("R2 binding MEDIA is not configured"), 500);
  }
  const form = await request.formData();
  const file = form.get("image");
  const type = normalizeContentType(form.get("type")) || "news";
  if (!file || typeof file.arrayBuffer !== "function") {
    return jsonResponse(errorPayload("Image file is required"), 400);
  }
  const originalName = String(file.name || "image").replace(/[^\w.-]+/g, "-");
  const key = `content/${type}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${originalName}`;
  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });
  return jsonResponse(successPayload({ image_key: key, image_url: `/media/${key}` }), 201);
}

async function serveMedia(request, env, key) {
  if (!env.MEDIA) return jsonResponse(errorPayload("R2 binding MEDIA is not configured"), 500);
  const object = await env.MEDIA.get(key);
  if (!object) return jsonResponse(errorPayload("Not found"), 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

async function listAiSettings(request, env) {
  await requireAdmin(request, env);
  const providers = await getDb(env).prepare("SELECT * FROM ai_providers ORDER BY display_name").all();
  const settings = await getDb(env).prepare("SELECT * FROM ai_settings ORDER BY tool_key").all();
  const prompts = await getDb(env).prepare("SELECT * FROM prompt_templates ORDER BY tool_key, version DESC").all();
  return jsonResponse(successPayload({ providers: providers.results || [], settings: settings.results || [], prompts: prompts.results || [] }), 200);
}

async function saveAiSetting(request, env) {
  await requireAdmin(request, env);
  const body = await request.json();
  const toolKey = asNonEmptyString(body.tool_key, "tool_key");
  const providerKey = asNonEmptyString(body.provider_key, "provider_key");
  await getDb(env)
    .prepare(
      `INSERT INTO ai_settings (tool_key, provider_key, model, temperature, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(tool_key) DO UPDATE SET
         provider_key = excluded.provider_key,
         model = excluded.model,
         temperature = excluded.temperature,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(toolKey, providerKey, body.model || null, body.temperature ?? null)
    .run();
  return jsonResponse(successPayload(), 200);
}

async function savePromptTemplate(request, env) {
  await requireAdmin(request, env);
  const body = await request.json();
  const status = ["draft", "active", "inactive", "archived"].includes(body.status) ? body.status : "draft";
  const id = body.id ? Number(body.id) : null;
  if (status === "active") {
    await getDb(env)
      .prepare(
        `UPDATE prompt_templates SET status = 'archived'
         WHERE tool_key = ? AND COALESCE(provider_key, '') = COALESCE(?, '') AND COALESCE(locale, '') = COALESCE(?, '') AND status = 'active'`
      )
      .bind(body.tool_key, body.provider_key || null, body.locale || null)
      .run();
  }
  if (id) {
    await getDb(env)
      .prepare(
        `UPDATE prompt_templates SET tool_key = ?, provider_key = ?, locale = ?, name = ?, content = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(body.tool_key, body.provider_key || null, body.locale || null, body.name, body.content, status, id)
      .run();
    return jsonResponse(successPayload({ id }), 200);
  }
  const versionRow = await getDb(env)
    .prepare("SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM prompt_templates WHERE tool_key = ?")
    .bind(body.tool_key)
    .first();
  const result = await getDb(env)
    .prepare(
      `INSERT INTO prompt_templates (tool_key, provider_key, locale, name, version, content, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(body.tool_key, body.provider_key || null, body.locale || null, body.name, versionRow?.next_version || 1, body.content, status)
    .run();
  return jsonResponse(successPayload({ id: result.meta.last_row_id }), 201);
}

async function callDeepseekApi({
  env,
  requestId,
  systemPrompt,
  userContent,
  targetLanguage = "en",
  isJsonOutput = false,
  model = "deepseek-chat",
  temperature = 0.7,
}) {
  const deepseekApiKey = getRequiredSecret(env, "DEEPSEEK_API_KEY");
  const timeoutMs = getEnvInt(env, "DEEPSEEK_TIMEOUT_MS", 45000);
  const languageName = LANGUAGE_MAP[targetLanguage] || "English";

  const priorityInstruction = isJsonOutput
    ? "CRITICAL INSTRUCTION: The final output MUST be a valid JSON object and nothing else. This is the most important rule."
    : `CRITICAL INSTRUCTION: The final output MUST be written exclusively in the ${languageName} language. This is the most important rule.`;
  const noExplanatoryCommentsInstruction = isJsonOutput
    ? ""
    : " Never output explanatory comments like 'Based on the provided text...' or 'This section is omitted'. If a section has no data, omit the entire section silently.";
  const antiHallucinationInstruction = isJsonOutput
    ? ""
    : " STRICT ANTI-HALLUCINATION: Use ONLY information explicitly present in the user's input. NEVER add any skills, tools, certificates, job titles, dates, names, or numbers that are not directly stated in the source resume. If a piece of information is missing, omit that section entirely. Do not create placeholder text or examples.";

  const payload = {
    model,
    messages: [
      {
        role: "system",
        content: `${priorityInstruction}${noExplanatoryCommentsInstruction}${antiHallucinationInstruction}\n\n${systemPrompt}`,
      },
      { role: "user", content: userContent },
    ],
    temperature,
  };

  if (isJsonOutput) {
    payload.response_format = { type: "json_object" };
  }

  log("info", "deepseek.request.start", {
    request_id: requestId,
    target_language: targetLanguage,
    json_output: isJsonOutput,
  });

  const response = await fetchWithTimeout(
    DEEPSEEK_API_URL,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${deepseekApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    timeoutMs
  );

  if (!response.ok) {
    const body = (await response.text()).slice(0, 400);
    throw new Error(`DeepSeek API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const generatedText = data?.choices?.[0]?.message?.content;
  if (typeof generatedText !== "string" || generatedText.trim() === "") {
    throw new Error("DeepSeek API returned empty content");
  }

  log("info", "deepseek.request.done", { request_id: requestId });
  return isJsonOutput ? generatedText : cleanAiResponse(generatedText);
}

async function getAiRuntimeSettings(env, toolKey) {
  const fallback = {
    provider_key: env.AI_DEFAULT_PROVIDER || "deepseek",
    model: "deepseek-chat",
    temperature: 0.7,
  };
  if (!env.DB) return fallback;
  try {
    const row = await env.DB
      .prepare(
        `SELECT s.provider_key, COALESCE(s.model, p.default_model) AS model, s.temperature, p.enabled
         FROM ai_settings s
         JOIN ai_providers p ON p.provider_key = s.provider_key
         WHERE s.tool_key = ?
         LIMIT 1`
      )
      .bind(toolKey)
      .first();
    if (!row || !row.enabled) return fallback;
    return {
      provider_key: row.provider_key || fallback.provider_key,
      model: row.model || fallback.model,
      temperature: row.temperature ?? fallback.temperature,
    };
  } catch (error) {
    log("error", "ai.settings.fallback", { tool_key: toolKey, message: error.message });
    return fallback;
  }
}

async function getRuntimePrompt(env, toolKey, providerKey, locale, bundledPrompt) {
  if (!env.DB) return bundledPrompt;
  try {
    const row = await env.DB
      .prepare(
        `SELECT content FROM prompt_templates
         WHERE tool_key = ?
           AND status = 'active'
           AND (provider_key = ? OR provider_key IS NULL)
           AND (locale = ? OR locale IS NULL)
         ORDER BY provider_key IS NOT NULL DESC, locale IS NOT NULL DESC, version DESC
         LIMIT 1`
      )
      .bind(toolKey, providerKey, locale)
      .first();
    return row?.content || bundledPrompt;
  } catch (error) {
    log("error", "ai.prompt.fallback", { tool_key: toolKey, message: error.message });
    return bundledPrompt;
  }
}

function buildAiSystemContent(systemPrompt, targetLanguage, isJsonOutput) {
  const languageName = LANGUAGE_MAP[targetLanguage] || "English";
  const priorityInstruction = isJsonOutput
    ? "CRITICAL INSTRUCTION: The final output MUST be a valid JSON object and nothing else."
    : `CRITICAL INSTRUCTION: The final output MUST be written exclusively in the ${languageName} language.`;
  const antiHallucinationInstruction = isJsonOutput
    ? ""
    : " Use ONLY information explicitly present in the user's input. Do not invent facts, dates, names, skills or numbers.";
  return `${priorityInstruction}${antiHallucinationInstruction}\n\n${systemPrompt}`;
}

async function callOpenAiApi({ env, requestId, settings, systemPrompt, userContent, targetLanguage, isJsonOutput }) {
  const apiKey = getRequiredSecret(env, "OPENAI_API_KEY");
  const payload = {
    model: settings.model || "gpt-4.1-mini",
    messages: [
      { role: "system", content: buildAiSystemContent(systemPrompt, targetLanguage, isJsonOutput) },
      { role: "user", content: userContent || "" },
    ],
    temperature: settings.temperature ?? 0.7,
  };
  if (isJsonOutput) {
    payload.response_format = { type: "json_object" };
  }
  log("info", "openai.request.start", { request_id: requestId, model: payload.model });
  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    getEnvInt(env, "DEEPSEEK_TIMEOUT_MS", 45000)
  );
  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("OpenAI API returned empty content");
  log("info", "openai.request.done", { request_id: requestId });
  return isJsonOutput ? text : cleanAiResponse(text);
}

async function callGeminiApi({ env, requestId, settings, systemPrompt, userContent, targetLanguage, isJsonOutput }) {
  const apiKey = getRequiredSecret(env, "GEMINI_API_KEY");
  const model = settings.model || "gemini-1.5-flash";
  const payload = {
    systemInstruction: { parts: [{ text: buildAiSystemContent(systemPrompt, targetLanguage, isJsonOutput) }] },
    contents: [{ role: "user", parts: [{ text: userContent || "" }] }],
    generationConfig: {
      temperature: settings.temperature ?? 0.7,
      ...(isJsonOutput ? { responseMimeType: "application/json" } : {}),
    },
  };
  log("info", "gemini.request.start", { request_id: requestId, model });
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    getEnvInt(env, "DEEPSEEK_TIMEOUT_MS", 45000)
  );
  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
  if (typeof text !== "string" || !text.trim()) throw new Error("Gemini API returned empty content");
  log("info", "gemini.request.done", { request_id: requestId });
  return isJsonOutput ? text : cleanAiResponse(text);
}

async function callClaudeApi({ env, requestId, settings, systemPrompt, userContent, targetLanguage, isJsonOutput }) {
  const apiKey = getRequiredSecret(env, "CLAUDE_API_KEY");
  const payload = {
    model: settings.model || "claude-3-5-sonnet-latest",
    max_tokens: 4000,
    temperature: settings.temperature ?? 0.7,
    system: buildAiSystemContent(systemPrompt, targetLanguage, isJsonOutput),
    messages: [{ role: "user", content: userContent || "" }],
  };
  log("info", "claude.request.start", { request_id: requestId, model: payload.model });
  const response = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    getEnvInt(env, "DEEPSEEK_TIMEOUT_MS", 45000)
  );
  if (!response.ok) {
    throw new Error(`Claude API error ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }
  const data = await response.json();
  const text = data?.content?.map((part) => part.text || "").join("");
  if (typeof text !== "string" || !text.trim()) throw new Error("Claude API returned empty content");
  log("info", "claude.request.done", { request_id: requestId });
  return isJsonOutput ? text : cleanAiResponse(text);
}

async function callAiProvider({
  env,
  requestId,
  toolKey,
  systemPrompt,
  userContent,
  targetLanguage = "en",
  isJsonOutput = false,
}) {
  const settings = await getAiRuntimeSettings(env, toolKey);
  const runtimePrompt = await getRuntimePrompt(env, toolKey, settings.provider_key, targetLanguage, systemPrompt);

  if (settings.provider_key === "openai") {
    return callOpenAiApi({ env, requestId, settings, systemPrompt: runtimePrompt, userContent, targetLanguage, isJsonOutput });
  }
  if (settings.provider_key === "gemini") {
    return callGeminiApi({ env, requestId, settings, systemPrompt: runtimePrompt, userContent, targetLanguage, isJsonOutput });
  }
  if (settings.provider_key === "claude") {
    return callClaudeApi({ env, requestId, settings, systemPrompt: runtimePrompt, userContent, targetLanguage, isJsonOutput });
  }
  return callDeepseekApi({
    env,
    requestId,
    systemPrompt: runtimePrompt,
    userContent,
    targetLanguage,
    isJsonOutput,
    model: settings.model || "deepseek-chat",
    temperature: settings.temperature ?? 0.7,
  });
}

async function analyzeVacancy({ env, requestId, vacancyText, targetLanguage }) {
  const prompt = getPrompt("1_analyze_vacancy.txt");
  const raw = await callAiProvider({
    env,
    requestId,
    toolKey: "vacancy_analysis",
    systemPrompt: prompt,
    userContent: vacancyText,
    targetLanguage,
    isJsonOutput: true,
  });
  return parseJsonObject(raw, "vacancy_analysis");
}

async function adaptResumeForVacancy({ env, requestId, resumeText, vacancyAnalysis, targetLanguage }) {
  const adaptPrompt = getPrompt("2_adapt_resume_for_vacancy.txt");
  const content = [
    `CANDIDATE'S RESUME:\n${resumeText}`,
    `VACANCY ANALYSIS (JSON):\n${JSON.stringify(vacancyAnalysis, null, 2)}`,
  ].join("\n\n");

  return callAiProvider({
    env,
    requestId,
    toolKey: "resume_improvement",
    systemPrompt: adaptPrompt,
    userContent: content,
    targetLanguage,
    isJsonOutput: false,
  });
}

async function generateCoverLetter({ env, requestId, resumeText, vacancyAnalysis, targetLanguage }) {
  const prompt = getPrompt("2_generate_cl_from_json.txt");
  const content = [
    `CANDIDATE'S RESUME:\n${resumeText}`,
    `VACANCY ANALYSIS (JSON):\n${JSON.stringify(vacancyAnalysis, null, 2)}`,
  ].join("\n\n");

  return callAiProvider({
    env,
    requestId,
    toolKey: "cover_letter",
    systemPrompt: prompt,
    userContent: content,
    targetLanguage,
    isJsonOutput: false,
  });
}

async function searchAdzuna({ env, requestId, selectedTitle, countryCode }) {
  const adzunaAppId = getRequiredSecret(env, "ADZUNA_APP_ID");
  const adzunaAppKey = getRequiredSecret(env, "ADZUNA_APP_KEY");
  const timeoutMs = getEnvInt(env, "ADZUNA_TIMEOUT_MS", 20000);

  // Якщо countryCode не передано або недійсний – використовуємо "us"
  const validCountry = countryCode && COUNTRY_MAP[countryCode.toUpperCase()] ? countryCode : "us";

  const params = new URLSearchParams({
    app_id: adzunaAppId,
    app_key: adzunaAppKey,
    results_per_page: "20",
    what_or: selectedTitle,
    "content-type": "application/json",
  });

  const url = `${ADZUNA_API_URL_BASE}/${validCountry}/search/1?${params.toString()}`;

  log("info", "adzuna.request.start", {
    request_id: requestId,
    country_code: validCountry,
    selected_title: selectedTitle,
  });

  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: { accept: "application/json" },
    },
    timeoutMs
  );

  if (!response.ok) {
    const body = (await response.text()).slice(0, 400);
    throw new Error(`Adzuna API error ${response.status}: ${body}`);
  }

  const adzunaJson = await response.json();
  const adzunaJobsRaw = Array.isArray(adzunaJson?.results) ? adzunaJson.results : [];

  const adzunaJobs = adzunaJobsRaw.map((job) => ({
    title: job?.title || null,
    company: job?.company?.display_name || null,
    location: job?.location?.display_name || null,
    url: job?.redirect_url || null,
    description: job?.description || null,
  }));

  log("info", "adzuna.request.done", {
    request_id: requestId,
    results_count: adzunaJobs.length,
  });

  return adzunaJobs;
}

function buildExternalLinks(selectedTitle, selectedCountryName) {
  const encodedTitle = encodeURIComponent(selectedTitle);
  const encodedCountry = encodeURIComponent(selectedCountryName);

  const links = {
    indeed_url: `https://ch.indeed.com/jobs?q=${encodedTitle}&l=${encodedCountry}`,
    linkedin_url: `https://www.linkedin.com/jobs/search/?keywords=${encodedTitle}&location=${encodedCountry}&sortBy=DD`,
  };

  if (selectedCountryName === "Switzerland") {
    links.jobsch_url = `https://www.jobs.ch/en/jobs/?term=${encodedTitle}`;
  }

  return links;
}

async function processAction(env, requestId, body) {
  if (!isObject(body)) {
    throw new Error("Request body must be a JSON object");
  }

  const normalizedAction = normalizeAction(body.action);
  if (!normalizedAction) {
    throw new Error('Field "action" is required or unsupported');
  }

  const resumeText = typeof body.resumeText === "string" ? body.resumeText : "";
  const targetLanguage = normalizeLanguage(body.language);

  if (normalizedAction === "analyze_vacancy") {
    const vacancyText = asNonEmptyString(body.vacancyText, "vacancyText");
    const vacancyAnalysis = await analyzeVacancy({ env, requestId, vacancyText, targetLanguage });
    return successPayload({ vacancy_analysis: vacancyAnalysis });
  }

  if (normalizedAction === "adapt_resume") {
    const country = normalizeCountry(body.country || body.country_format);
    if (!country) {
      throw new Error('Field "country" must be one of: ch, eu, us');
    }

    const promptFilename = COUNTRY_PROMPT[country];
    const systemPrompt = getPrompt(promptFilename).replace("{{user_resume_text}}", resumeText);

    const adaptedResume = await callAiProvider({
      env,
      requestId,
      toolKey: "resume_generation",
      systemPrompt,
      userContent: "",
      targetLanguage,
      isJsonOutput: false,
    });

    return successPayload({ resume: adaptedResume });
  }

  if (normalizedAction === "adapt_resume_for_vacancy") {
    const vacancyAnalysis = isObject(body.vacancyAnalysis)
      ? body.vacancyAnalysis
      : await analyzeVacancy({
          env,
          requestId,
          vacancyText: asNonEmptyString(body.vacancyText, "vacancyText"),
          targetLanguage,
        });

    const adaptedResume = await adaptResumeForVacancy({
      env,
      requestId,
      resumeText,
      vacancyAnalysis,
      targetLanguage,
    });

    return successPayload({
      resume: adaptedResume,
      vacancy_analysis: vacancyAnalysis,
    });
  }

  if (normalizedAction === "generate_cover_letter") {
    const vacancyAnalysis = isObject(body.vacancyAnalysis)
      ? body.vacancyAnalysis
      : await analyzeVacancy({
          env,
          requestId,
          vacancyText: asNonEmptyString(body.vacancyText, "vacancyText"),
          targetLanguage,
        });

    const coverLetter = await generateCoverLetter({
      env,
      requestId,
      resumeText,
      vacancyAnalysis,
      targetLanguage,
    });

    return successPayload({
      cover_letter: coverLetter,
      vacancy_analysis: vacancyAnalysis,
    });
  }

  if (normalizedAction === "adapt_for_vacancy_bundle") {
    const vacancyText = asNonEmptyString(body.vacancyText, "vacancyText");
    const vacancyAnalysis = await analyzeVacancy({ env, requestId, vacancyText, targetLanguage });

    const adaptedResume = await adaptResumeForVacancy({
      env,
      requestId,
      resumeText,
      vacancyAnalysis,
      targetLanguage,
    });

    const coverLetter = await generateCoverLetter({
      env,
      requestId,
      resumeText: adaptedResume,
      vacancyAnalysis,
      targetLanguage,
    });

    return successPayload({
      resume: adaptedResume,
      cover_letter: coverLetter,
      vacancy_analysis: vacancyAnalysis,
    });
  }

  if (normalizedAction === "ats_analysis") {
    const vacancyText = asNonEmptyString(body.vacancyText, "vacancyText");
    const prompt = getPrompt("3_ats_analysis.txt");
    const content = `[CANDIDATE'S RESUME]:\n${resumeText}\n\n[JOB VACANCY]:\n${vacancyText}`;

    const atsReport = await callAiProvider({
      env,
      requestId,
      toolKey: "ats_analysis",
      systemPrompt: prompt,
      userContent: content,
      targetLanguage,
      isJsonOutput: false,
    });

    return successPayload({ ats_report: atsReport });
  }

  if (normalizedAction === "suggest_job_titles") {
    const prompt = getPrompt("5_suggest_job_titles.txt");
    const raw = await callAiProvider({
      env,
      requestId,
      toolKey: "job_titles",
      systemPrompt: prompt,
      userContent: resumeText,
      targetLanguage: "en",
      isJsonOutput: true,
    });
    const parsed = parseJsonObject(raw, "suggested_titles");
    const suggestedTitles = validateSuggestedTitles(parsed);
    return successPayload({ suggested_titles: suggestedTitles });
  }

  if (normalizedAction === "extract_keywords_for_search") {
    const prompt = getPrompt("4_extract_keywords_for_search.txt");
    const userContent = body.title || resumeText || "";
    const raw = await callAiProvider({
      env,
      requestId,
      toolKey: "search_keywords",
      systemPrompt: prompt,
      userContent: userContent,
      targetLanguage: "en",
      isJsonOutput: true,
    });
    const parsed = parseJsonObject(raw, "extract_keywords_for_search");
    const extracted = validateSearchKeywords(parsed);
    return successPayload(extracted);
  }

  if (normalizedAction === "search_jobs") {
    const selectedTitle = asNonEmptyString(body.title, "title");
    let selectedCountryName = body.country;
    if (typeof selectedCountryName !== "string" || selectedCountryName.trim() === "") {
      selectedCountryName = "us"; // Default global search
    } else {
      selectedCountryName = selectedCountryName.trim();
    }
    // Convert to country code using the map, fallback to "us"
    const countryCode = COUNTRY_MAP[selectedCountryName.toUpperCase()] || COUNTRY_MAP["US"] || "us";

    const adzunaJobs = await searchAdzuna({
      env,
      requestId,
      selectedTitle,
      countryCode,
    });

    return successPayload({
      adzuna_jobs: adzunaJobs,
      external_links: buildExternalLinks(selectedTitle, selectedCountryName),
    });
  }

  if (normalizedAction === "search_courses") {
    const query = asNonEmptyString(body.title, "title");
    const educationApiUrl = "https://edu.uatechflow.org/api/opportunities?type=course&type=lehre";

    const response = await fetch(educationApiUrl);
    if (!response.ok) {
      throw new Error(`Education API failed with status ${response.status}`);
    }
    const data = await response.json();
    let courses = Array.isArray(data.items) ? data.items : [];

    // Фільтруємо за запитом
    if (query) {
      const lowerQuery = query.toLowerCase();
      courses = courses.filter(item => {
        const title = (item.title_de || item.title_uk || "").toLowerCase();
        const desc = (item.description_de || item.description_uk || "").toLowerCase();
        const provider = (item.provider_de || item.provider_uk || "").toLowerCase();
        return title.includes(lowerQuery) || desc.includes(lowerQuery) || provider.includes(lowerQuery);
      });
    }

    // Форматуємо
    const formattedCourses = courses.map(item => ({
      title: item.title_de || item.title_uk || "Untitled",
      description: item.description_de || item.description_uk || "",
      url: item.website || `https://edu.uatechflow.org/opportunities/${item.id}`,
      provider: item.provider_de || item.provider_uk || "",
      location: item.location || "",
      type: item.type || "",
    }));

    // Зовнішні посилання
    const encodedQuery = encodeURIComponent(query);
    const externalLinks = {
      coursera: `https://www.coursera.org/search?query=${encodedQuery}`,
      linkedin_learning: `https://www.linkedin.com/learning/search?keywords=${encodedQuery}`,
      google: `https://www.google.com/search?q=${encodedQuery}+online+course`,
    };

    return successPayload({
      courses: formattedCourses,
      external_links: externalLinks,
    });
  }

  throw new Error(`Unsupported action: ${String(body.action)}`);
}

function rewriteAssetRequestIfNeeded(request, url) {
  const rewrites = {
    "/cv-import": "/cv-import.html",
    "/cv-editor": "/cv-editor.html",
    "/news": "/news.html",
    "/events": "/events.html",
    "/admin": "/admin.html",
  };

  let rewrittenPath = rewrites[url.pathname];
  if (!rewrittenPath && url.pathname.startsWith("/news/")) {
    rewrittenPath = "/news";
  }
  if (!rewrittenPath && url.pathname.startsWith("/events/")) {
    rewrittenPath = "/news";
  }
  const detailSlug =
    url.pathname.startsWith("/news/") || url.pathname.startsWith("/events/")
      ? url.pathname.split("/").filter(Boolean)[1]
      : "";
  if (detailSlug) {
    url.searchParams.set("slug", detailSlug);
  }
  if (!rewrittenPath) {
    return request;
  }

  const rewrittenUrl = new URL(request.url);
  rewrittenUrl.pathname = rewrittenPath;
  if (detailSlug) {
    rewrittenUrl.searchParams.set("slug", detailSlug);
  }
  return new Request(rewrittenUrl.toString(), request);
}

async function handleApiRequest(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  try {
    if (path.startsWith("/media/") && method === "GET") {
      return await serveMedia(request, env, decodeURIComponent(path.slice("/media/".length)));
    }

    if (path === "/api/admin/login" && method === "POST") return await loginAdmin(request, env);
    if (path === "/api/admin/logout" && method === "POST") return await logoutAdmin(request, env);
    if (path === "/api/admin/me" && method === "GET") return await getAdminMe(request, env);
    if (path === "/api/admin/meta" && method === "GET") {
      await requireAdmin(request, env);
      const locale = normalizeLocale(url.searchParams.get("locale"));
      const type = normalizeContentType(url.searchParams.get("type")) || "news";
      return jsonResponse(successPayload(await listMeta(env, type, locale)), 200);
    }

    if (path === "/api/meta" && method === "GET") return await getPublicMeta(request, env);
    if (path === "/api/news" && method === "GET") return await listPublicContent(request, env, "all");
    if (path === "/api/events" && method === "GET") return await listPublicContent(request, env, "event");

    const publicNewsMatch = path.match(/^\/api\/news\/([^/]+)$/);
    if (publicNewsMatch && method === "GET") {
      return await getPublicContentDetail(request, env, "all", decodeURIComponent(publicNewsMatch[1]));
    }
    const publicEventMatch = path.match(/^\/api\/events\/([^/]+)$/);
    if (publicEventMatch && method === "GET") {
      return await getPublicContentDetail(request, env, "event", decodeURIComponent(publicEventMatch[1]));
    }

    if (path === "/api/admin/content" && method === "GET") return await listAdminContent(request, env);
    if (path === "/api/admin/content" && method === "POST") return await createAdminContent(request, env);
    const adminContentMatch = path.match(/^\/api\/admin\/content\/(\d+)(?:\/(publish|unpublish))?$/);
    if (adminContentMatch) {
      const id = Number(adminContentMatch[1]);
      const action = adminContentMatch[2];
      if (action === "publish" && method === "POST") return await setContentStatus(request, env, id, "published");
      if (action === "unpublish" && method === "POST") return await setContentStatus(request, env, id, "unpublished");
      if (!action && method === "GET") return await getAdminContent(request, env, id);
      if (!action && method === "PUT") return await updateAdminContent(request, env, id);
      if (!action && method === "DELETE") return await deleteAdminContent(request, env, id);
    }

    if (path === "/api/admin/uploads/image" && method === "POST") return await uploadAdminImage(request, env);
    if (path === "/api/admin/ai" && method === "GET") return await listAiSettings(request, env);
    if (path === "/api/admin/ai/settings" && method === "PUT") return await saveAiSetting(request, env);
    if (path === "/api/admin/prompts" && (method === "POST" || method === "PUT")) return await savePromptTemplate(request, env);

    return jsonResponse(errorPayload("Not found"), 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Unauthorized" ? 401 : deriveErrorStatusCode(message);
    return jsonResponse(errorPayload(message), status);
  }
}

export default {
  async fetch(request, env) {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const requestId = createRequestId();
    const url = new URL(request.url);
    const startedAt = Date.now();

    if (url.pathname === "/healthz") {
      return jsonResponse(successPayload({ status: "ok", time: nowIso() }), 200);
    }

    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/")) {
      return handleApiRequest(request, env, url);
    }

    if (url.pathname === "/process" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse(errorPayload("Invalid JSON body"), 400);
      }

      try {
        const payload = await processAction(env, requestId, body);
        log("info", "request.success", {
          request_id: requestId,
          action: body?.action || null,
          duration_ms: Date.now() - startedAt,
        });
        return jsonResponse(payload, 200);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        const statusCode = deriveErrorStatusCode(message);

        log("error", "request.error", {
          request_id: requestId,
          path: url.pathname,
          method: request.method,
          message,
          duration_ms: Date.now() - startedAt,
        });

        return jsonResponse(errorPayload(message), statusCode);
      }
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const assetRequest = rewriteAssetRequestIfNeeded(request, url);
      return env.ASSETS.fetch(assetRequest);
    }

    return jsonResponse(errorPayload("Method Not Allowed"), 405, {
      allow: "GET, HEAD, POST, PUT, DELETE",
    });
  },
};