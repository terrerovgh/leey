/**
 * Leey Blog CMS Worker
 * - Magic-link auth (Resend email)
 * - Posts CRUD on KV (source of truth at runtime)
 * - Media upload/serve on R2
 * - Dynamic /data/blog/posts.json for the public site
 * - Agent API for Hermes pipeline handoff
 */

const COOKIE = "leey_blog_session";
const INDEX_KEY = "blog:index";
const DRAFTS_KEY = "blog:drafts";
const MEDIA_INDEX_KEY = "blog:media";
const SEEDED_KEY = "blog:seeded";

/** @typedef {{
 *  BLOG_KV: KVNamespace,
 *  MEDIA: R2Bucket,
 *  ASSETS: Fetcher,
 *  SITE_URL: string,
 *  ALLOWED_EMAILS: string,
 *  FROM_EMAIL: string,
 *  SESSION_TTL_SECONDS: string,
 *  MAGIC_TTL_SECONDS: string,
 *  RESEND_API_KEY?: string,
 *  SESSION_SECRET?: string,
 *  AGENT_TOKEN?: string,
 * }} Env */

export default {
  /** @param {Request} request @param {Env} env */
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Ensure public feed is live even before first CMS edit
      if (path === "/data/blog/posts.json" && request.method === "GET") {
        return await servePostsJson(env, request);
      }

      if (path.startsWith("/media/blog/")) {
        return await serveMedia(env, path.slice("/media/blog/".length));
      }

      if (path.startsWith("/api/blog")) {
        return await handleApi(request, env, url);
      }

      // Everything else: static assets / SPA
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
      return json({ error: "no assets binding" }, 500);
    } catch (err) {
      console.error(err);
      return json(
        { error: "internal_error", message: err instanceof Error ? err.message : String(err) },
        500,
      );
    }
  },
};

/* ───────────────────────── API router ───────────────────────── */

/** @param {Request} request @param {Env} env @param {URL} url */
async function handleApi(request, env, url) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  // CORS preflight (studio is same-origin; keep simple for tooling)
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Public auth endpoints
  if (path === "/api/blog/auth/request" && method === "POST") {
    return authRequest(request, env);
  }
  if (path === "/api/blog/auth/verify" && method === "POST") {
    return authVerify(request, env);
  }
  if (path === "/api/blog/auth/logout" && method === "POST") {
    return authLogout(env);
  }
  if (path === "/api/blog/auth/me" && method === "GET") {
    const session = await getSession(request, env);
    if (!session) return json({ authenticated: false }, 401);
    return json({ authenticated: true, email: session.email });
  }

  // Agent handoff (token, not cookie)
  if (path === "/api/blog/agent/upsert" && method === "POST") {
    return agentUpsert(request, env);
  }
  if (path === "/api/blog/agent/status" && method === "GET") {
    return agentStatus(request, env);
  }

  // Authed studio API
  const session = await getSession(request, env);
  if (!session) return json({ error: "unauthorized" }, 401);

  if (path === "/api/blog/posts" && method === "GET") {
    return listPosts(env, url);
  }
  if (path === "/api/blog/posts" && method === "POST") {
    return createPost(request, env, session);
  }

  const postMatch = path.match(/^\/api\/blog\/posts\/([^/]+)$/);
  if (postMatch) {
    const slug = decodeURIComponent(postMatch[1]);
    if (method === "GET") return getPost(env, slug);
    if (method === "PUT") return updatePost(request, env, session, slug);
    if (method === "DELETE") return deletePost(env, session, slug);
  }

  if (path === "/api/blog/media" && method === "GET") {
    return listMedia(env);
  }
  if (path === "/api/blog/media" && method === "POST") {
    return uploadMedia(request, env, session);
  }
  const mediaMatch = path.match(/^\/api\/blog\/media\/([^/]+)$/);
  if (mediaMatch && method === "DELETE") {
    return deleteMedia(env, decodeURIComponent(mediaMatch[1]));
  }

  if (path === "/api/blog/seed" && method === "POST") {
    return seedFromStatic(env, request);
  }

  return json({ error: "not_found", path }, 404);
}

/* ───────────────────────── Auth (magic link) ───────────────────────── */

function allowlist(env) {
  return String(env.ALLOWED_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** @param {Request} request @param {Env} env */
async function authRequest(request, env) {
  const body = await readJson(request);
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    return json({ error: "invalid_email" }, 400);
  }

  const allowed = allowlist(env);
  // Always respond the same shape to avoid email enumeration
  const generic = {
    ok: true,
    message: "Si el correo está autorizado, recibirás un enlace en unos segundos.",
  };

  if (!allowed.includes(email)) {
    return json(generic);
  }

  // Rate limit: 1 request / 60s per email
  const rlKey = `rl:auth:${email}`;
  const recent = await env.BLOG_KV.get(rlKey);
  if (recent) {
    return json({ ...generic, throttled: true });
  }
  await env.BLOG_KV.put(rlKey, "1", { expirationTtl: 60 });

  const token = randomToken(32);
  const ttl = Number(env.MAGIC_TTL_SECONDS || 900);
  await env.BLOG_KV.put(
    `magic:${token}`,
    JSON.stringify({ email, createdAt: nowIso() }),
    { expirationTtl: ttl },
  );

  const link = `${env.SITE_URL.replace(/\/$/, "")}/studio/auth?token=${encodeURIComponent(token)}`;
  const sent = await sendMagicEmail(env, email, link);

  const out = { ...generic, emailed: sent.ok };
  // Dev/bootstrap: expose link only when Resend is missing (local ops)
  if (!sent.ok && sent.reason === "no_provider") {
    out.devLink = link;
    out.warning =
      "RESEND_API_KEY no configurada. Usa devLink solo en bootstrap; configura Resend para producción.";
  }
  if (!sent.ok && sent.reason !== "no_provider") {
    out.warning = sent.message || "No se pudo enviar el correo.";
    out.devLink = link; // still allow entry so CMS is usable while email is fixed
  }
  return json(out);
}

/** @param {Request} request @param {Env} env */
async function authVerify(request, env) {
  const body = await readJson(request);
  const token = String(body.token || "").trim();
  if (!token) return json({ error: "missing_token" }, 400);

  const raw = await env.BLOG_KV.get(`magic:${token}`);
  if (!raw) return json({ error: "invalid_or_expired_token" }, 400);

  /** @type {{email:string}} */
  const data = JSON.parse(raw);
  await env.BLOG_KV.delete(`magic:${token}`);

  if (!allowlist(env).includes(String(data.email).toLowerCase())) {
    return json({ error: "email_not_allowed" }, 403);
  }

  const sessionId = randomToken(32);
  const ttl = Number(env.SESSION_TTL_SECONDS || 604800);
  await env.BLOG_KV.put(
    `session:${sessionId}`,
    JSON.stringify({ email: data.email, createdAt: nowIso() }),
    { expirationTtl: ttl },
  );

  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "set-cookie": cookieSet(sessionId, ttl),
    ...Object.fromEntries(corsHeaders()),
  });
  return new Response(JSON.stringify({ ok: true, email: data.email }), { status: 200, headers });
}

/** @param {Env} env */
async function authLogout(env) {
  // Client clears cookie; best-effort server revoke would need session id
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "set-cookie": cookieClear(),
    ...Object.fromEntries(corsHeaders()),
  });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

/** @param {Request} request @param {Env} env */
async function getSession(request, env) {
  const cookie = request.headers.get("cookie") || "";
    const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
    const sid = m?.[1];
  if (!sid) {
    // Bearer fallback for agents/tools
    const auth = request.headers.get("authorization") || "";
    if (auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice(7).trim();
      const raw = await env.BLOG_KV.get(`session:${token}`);
      if (raw) return JSON.parse(raw);
    }
    return null;
  }
  const raw = await env.BLOG_KV.get(`session:${sid}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

/** @param {Env} env @param {string} to @param {string} link */
async function sendMagicEmail(env, to, link) {
  const key = env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "no_provider" };

  const html = `
  <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1c1612">
    <p style="font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#a34a1d">Leey Blog Studio</p>
    <h1 style="font-weight:400;font-size:28px;line-height:1.2">Tu enlace de acceso</h1>
    <p style="font-size:16px;line-height:1.6;color:#3a2f27">
      Usa este enlace para editar las notas del blog. Expira en 15 minutos y solo funciona una vez.
    </p>
    <p style="margin:28px 0">
      <a href="${escapeHtml(link)}"
         style="display:inline-block;background:#1c1612;color:#f7f1e8;padding:14px 22px;text-decoration:none;font-size:14px">
        Entrar al Studio
      </a>
    </p>
    <p style="font-size:13px;color:#6b5a4c;word-break:break-all">${escapeHtml(link)}</p>
    <p style="font-size:12px;color:#8a7664">Si no pediste este acceso, ignora este correo.</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL || "Leey Blog Studio <onboarding@resend.dev>",
        to: [to],
        subject: "Tu enlace para editar el blog — Leey Realty",
        html,
        text: `Entra al Blog Studio:\n\n${link}\n\nExpira en 15 minutos.`,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("resend fail", res.status, t);
      return { ok: false, reason: "send_failed", message: t.slice(0, 200) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "send_failed", message: String(e) };
  }
}

/* ───────────────────────── Posts ───────────────────────── */

/** @param {Env} env */
async function loadIndex(env) {
  const raw = await env.BLOG_KV.get(INDEX_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.posts)) return data;
    } catch {}
  }
  // Lazy seed from bundled static asset on first read
  const seeded = await trySeedFromAssets(env);
  if (seeded) return seeded;
  return { version: 1, updatedAt: nowIso(), posts: [] };
}

/** @param {Env} env @param {any} index */
async function saveIndex(env, index) {
  index.version = 1;
  index.updatedAt = nowIso();
  await env.BLOG_KV.put(INDEX_KEY, JSON.stringify(index));
  return index;
}

/** @param {Env} env @param {Request} request */
async function servePostsJson(env, request) {
  const index = await loadIndex(env);
  // Public feed: only non-draft
  const publicIndex = {
    version: 1,
    updatedAt: index.updatedAt,
    posts: (index.posts || []).filter((p) => !p.draft),
  };
  return new Response(JSON.stringify(publicIndex), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30, stale-while-revalidate=60",
      "access-control-allow-origin": "*",
    },
  });
}

/** @param {Env} env @param {URL} url */
async function listPosts(env, url) {
  const index = await loadIndex(env);
  const includeDrafts = url.searchParams.get("drafts") !== "0";
  let posts = index.posts || [];
  if (!includeDrafts) posts = posts.filter((p) => !p.draft);
  posts = posts.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return json({ version: index.version, updatedAt: index.updatedAt, posts });
}

/** @param {Env} env @param {string} slug */
async function getPost(env, slug) {
  const index = await loadIndex(env);
  const post = (index.posts || []).find((p) => p.slug === slug);
  if (!post) return json({ error: "not_found" }, 404);
  return json({ post });
}

/** @param {Request} request @param {Env} env @param {{email:string}} session */
async function createPost(request, env, session) {
  const body = await readJson(request);
  const post = normalizePost(body.post || body, { isNew: true });
  if (!post.slug) return json({ error: "slug_required" }, 400);
  if (!post.titleEs && !post.titleEn) return json({ error: "title_required" }, 400);

  const index = await loadIndex(env);
  if ((index.posts || []).some((p) => p.slug === post.slug)) {
    return json({ error: "slug_exists" }, 409);
  }
  post.updatedAt = nowIso();
  post.editedBy = session.email;
  index.posts = index.posts || [];
  index.posts.push(post);
  await saveIndex(env, index);
  return json({ ok: true, post });
}

/** @param {Request} request @param {Env} env @param {{email:string}} session @param {string} slug */
async function updatePost(request, env, session, slug) {
  const body = await readJson(request);
  const index = await loadIndex(env);
  const i = (index.posts || []).findIndex((p) => p.slug === slug);
  if (i < 0) return json({ error: "not_found" }, 404);

  const incoming = normalizePost({ ...index.posts[i], ...(body.post || body) }, { isNew: false });
  // slug rename
  if (incoming.slug && incoming.slug !== slug) {
    if ((index.posts || []).some((p) => p.slug === incoming.slug)) {
      return json({ error: "slug_exists" }, 409);
    }
  } else {
    incoming.slug = slug;
  }
  incoming.updatedAt = nowIso();
  incoming.editedBy = session.email;
  index.posts[i] = incoming;
  await saveIndex(env, index);
  return json({ ok: true, post: incoming });
}

/** @param {Env} env @param {{email:string}} session @param {string} slug */
async function deletePost(env, session, slug) {
  const index = await loadIndex(env);
  const before = (index.posts || []).length;
  index.posts = (index.posts || []).filter((p) => p.slug !== slug);
  if (index.posts.length === before) return json({ error: "not_found" }, 404);
  await saveIndex(env, index);
  return json({ ok: true, deleted: slug, by: session.email });
}

/* ───────────────────────── Media ───────────────────────── */

/** @param {Env} env @param {string} key */
async function serveMedia(env, key) {
  const clean = key.replace(/^\/+/, "");
  if (!clean || clean.includes("..")) return json({ error: "bad_key" }, 400);
  const obj = await env.MEDIA.get(clean);
  if (!obj) return json({ error: "not_found" }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  if (!headers.has("content-type")) {
    headers.set("content-type", guessContentType(clean));
  }
  return new Response(obj.body, { headers });
}

/** @param {Env} env */
async function listMedia(env) {
  const raw = await env.BLOG_KV.get(MEDIA_INDEX_KEY);
  const items = raw ? JSON.parse(raw) : [];
  return json({ items });
}

/** @param {Request} request @param {Env} env @param {{email:string}} session */
async function uploadMedia(request, env, session) {
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data")) {
    return json({ error: "expected_multipart" }, 400);
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: "file_required" }, 400);

  const max = 8 * 1024 * 1024;
  if (file.size > max) return json({ error: "file_too_large", max }, 413);

  const type = file.type || "application/octet-stream";
  if (!type.startsWith("image/")) return json({ error: "images_only" }, 400);

  const ext = extFromType(type) || "jpg";
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const id = randomToken(8);
  const key = `${day}/${id}.${ext}`;

  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: type },
    customMetadata: { uploadedBy: session.email, originalName: file.name || "" },
  });

  const item = {
    key,
    src: `/media/blog/${key}`,
    contentType: type,
    size: file.size,
    name: file.name || key,
    uploadedAt: nowIso(),
    uploadedBy: session.email,
  };

  const raw = await env.BLOG_KV.get(MEDIA_INDEX_KEY);
  const items = raw ? JSON.parse(raw) : [];
  items.unshift(item);
  await env.BLOG_KV.put(MEDIA_INDEX_KEY, JSON.stringify(items.slice(0, 500)));

  return json({ ok: true, item });
}

/** @param {Env} env @param {string} key */
async function deleteMedia(env, key) {
  const clean = key.replace(/^\/+/, "");
  await env.MEDIA.delete(clean);
  const raw = await env.BLOG_KV.get(MEDIA_INDEX_KEY);
  const items = (raw ? JSON.parse(raw) : []).filter((x) => x.key !== clean);
  await env.BLOG_KV.put(MEDIA_INDEX_KEY, JSON.stringify(items));
  return json({ ok: true });
}

/* ───────────────────────── Agent API ───────────────────────── */

/** @param {Request} request @param {Env} env */
function agentAuthorized(request, env) {
  const token = env.AGENT_TOKEN;
  if (!token) return false;
  const h = request.headers.get("x-agent-token") || "";
  const auth = request.headers.get("authorization") || "";
  if (h && h === token) return true;
  if (auth === `Bearer ${token}`) return true;
  return false;
}

/** @param {Request} request @param {Env} env */
async function agentUpsert(request, env) {
  if (!agentAuthorized(request, env)) return json({ error: "unauthorized" }, 401);
  const body = await readJson(request);
  const post = normalizePost(body.post || body, { isNew: false });
  if (!post.slug) return json({ error: "slug_required" }, 400);

  const index = await loadIndex(env);
  index.posts = index.posts || [];
  const i = index.posts.findIndex((p) => p.slug === post.slug || (post.date && p.date === post.date));
  post.updatedAt = nowIso();
  post.editedBy = "agent:pipeline";
  if (body.replaceByDate && post.date) {
    index.posts = index.posts.filter((p) => p.date !== post.date);
    index.posts.push(post);
  } else if (i >= 0) {
    // keep human draft flag if agent pushes and human marked draft? agent wins on explicit draft field
    index.posts[i] = { ...index.posts[i], ...post };
  } else {
    index.posts.push(post);
  }
  await saveIndex(env, index);
  return json({ ok: true, slug: post.slug, posts: index.posts.length });
}

/** @param {Request} request @param {Env} env */
async function agentStatus(request, env) {
  if (!agentAuthorized(request, env)) return json({ error: "unauthorized" }, 401);
  const index = await loadIndex(env);
  return json({
    ok: true,
    updatedAt: index.updatedAt,
    count: (index.posts || []).length,
    drafts: (index.posts || []).filter((p) => p.draft).length,
    latest: (index.posts || [])
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 5)
      .map((p) => ({ slug: p.slug, date: p.date, draft: !!p.draft, titleEs: p.titleEs })),
  });
}

/* ───────────────────────── Seed ───────────────────────── */

/** @param {Env} env @param {Request} request */
async function seedFromStatic(env, request) {
  const force = (await readJson(request)).force === true;
  if (!force) {
    const existing = await env.BLOG_KV.get(INDEX_KEY);
    if (existing) return json({ ok: true, skipped: true, reason: "already_seeded" });
  }
  const index = await trySeedFromAssets(env);
  if (!index) return json({ error: "seed_source_missing" }, 404);
  return json({ ok: true, posts: index.posts.length, updatedAt: index.updatedAt });
}

/** @param {Env} env */
async function trySeedFromAssets(env) {
  if (!env.ASSETS) return null;
  try {
    const res = await env.ASSETS.fetch(new Request("https://leeyrealty.com/data/blog/posts.json"));
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.posts)) return null;
    const index = {
      version: 1,
      updatedAt: data.updatedAt || nowIso(),
      posts: data.posts.map((p) => normalizePost(p, { isNew: false })),
    };
    await env.BLOG_KV.put(INDEX_KEY, JSON.stringify(index));
    await env.BLOG_KV.put(SEEDED_KEY, nowIso());
    return index;
  } catch (e) {
    console.error("seed fail", e);
    return null;
  }
}

/* ───────────────────────── normalize ───────────────────────── */

function normalizePost(input, { isNew }) {
  const p = input && typeof input === "object" ? input : {};
  let slug = slugify(String(p.slug || ""));
  if (!slug && isNew) {
    const base = slugify(String(p.titleEn || p.titleEs || "nota"));
    slug = base || `nota-${Date.now().toString(36)}`;
  }
  const cover = normalizeFigure(p.cover) || {
    src: "/assets/leey-portrait.jpg",
    altEs: "",
    altEn: "",
    kind: "photo",
  };
  const figures = Array.isArray(p.figures)
    ? p.figures.map(normalizeFigure).filter(Boolean)
    : [];

  const readMinutes = Math.max(1, Number(p.readMinutes) || estimateRead(p.bodyEs || p.bodyEn || ""));

  return {
    slug,
    date: String(p.date || new Date().toISOString().slice(0, 10)),
    updatedAt: p.updatedAt || nowIso(),
    category: p.category || "market",
    readMinutes,
    cover,
    figures,
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    areas: Array.isArray(p.areas) ? p.areas.map(String) : [],
    titleEs: String(p.titleEs || ""),
    titleEn: String(p.titleEn || ""),
    excerptEs: String(p.excerptEs || ""),
    excerptEn: String(p.excerptEn || ""),
    bodyEs: String(p.bodyEs || ""),
    bodyEn: String(p.bodyEn || ""),
    seoTitleEs: p.seoTitleEs ? String(p.seoTitleEs) : undefined,
    seoTitleEn: p.seoTitleEn ? String(p.seoTitleEn) : undefined,
    seoDescriptionEs: p.seoDescriptionEs ? String(p.seoDescriptionEs) : undefined,
    seoDescriptionEn: p.seoDescriptionEn ? String(p.seoDescriptionEn) : undefined,
    draft: p.draft === true,
    editedBy: p.editedBy,
    source: p.source || undefined,
  };
}

function normalizeFigure(f) {
  if (!f || typeof f !== "object") return null;
  if (!f.src) return null;
  return {
    src: String(f.src),
    altEs: String(f.altEs || ""),
    altEn: String(f.altEn || ""),
    captionEs: f.captionEs ? String(f.captionEs) : undefined,
    captionEn: f.captionEn ? String(f.captionEn) : undefined,
    kind: f.kind === "infographic" || f.kind === "chart" ? f.kind : "photo",
  };
}

function estimateRead(body) {
  const words = String(body).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round(words / 180));
}

/* ───────────────────────── helpers ───────────────────────── */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...Object.fromEntries(corsHeaders()),
    },
  });
}

function corsHeaders() {
  return new Headers({
    "access-control-allow-origin": "https://leeyrealty.com",
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-agent-token",
  });
}

function cookieSet(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function cookieClear() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function nowIso() {
  return new Date().toISOString();
}

function randomToken(bytes = 24) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function slugify(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extFromType(type) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/svg+xml") return "svg";
  return null;
}

function guessContentType(key) {
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".gif")) return "image/gif";
  if (key.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}
