import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  CATEGORIES,
  deleteMedia,
  deleteStudioPost,
  emptyPost,
  getStudioPost,
  listMedia,
  listStudioPosts,
  logoutStudio,
  meStudio,
  requestMagicLink,
  saveStudioPost,
  seedStudio,
  type MediaItem,
  type StudioFigure,
  type StudioPost,
  uploadMedia,
  verifyMagicToken,
} from "../lib/studioApi";

const AuthCtx = createContext("");
function useEmail() {
  return useContext(AuthCtx);
}

/** Minimal chrome for /studio — no public header/footer. */
export function StudioApp() {
  return (
    <div className="min-h-screen bg-ivory-50 text-ink-900">
      <Routes>
        <Route path="/" element={<StudioGate />} />
        <Route path="/auth" element={<StudioAuthCallback />} />
        <Route
          path="/posts"
          element={
            <StudioRequireAuth>
              <StudioList />
            </StudioRequireAuth>
          }
        />
        <Route
          path="/posts/new"
          element={
            <StudioRequireAuth>
              <StudioEditor isNew />
            </StudioRequireAuth>
          }
        />
        <Route
          path="/posts/:slug"
          element={
            <StudioRequireAuth>
              <StudioEditor />
            </StudioRequireAuth>
          }
        />
        <Route
          path="/media"
          element={
            <StudioRequireAuth>
              <StudioMedia />
            </StudioRequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/studio" replace />} />
      </Routes>
    </div>
  );
}

function StudioRequireAuth({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "yes" | "no">("loading");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let alive = true;
    meStudio()
      .then((r) => {
        if (!alive) return;
        if (r.authenticated) {
          setEmail(r.email || "");
          setState("yes");
        } else setState("no");
      })
      .catch(() => alive && setState("no"));
    return () => {
      alive = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <Shell>
        <p className="text-ink-500">Comprobando sesión…</p>
      </Shell>
    );
  }
  if (state === "no") return <Navigate to="/studio" replace />;
  return <AuthCtx.Provider value={email}>{children}</AuthCtx.Provider>;
}

function Shell({
  children,
  email,
  title,
}: {
  children: ReactNode;
  email?: string;
  title?: string;
}) {
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-ink-900/10 pb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-clay-600">
            Leey · Blog Studio
          </p>
          <h1 className="mt-1 font-display text-3xl font-light text-ink-900">
            {title || "Editor humano"}
          </h1>
          {email && <p className="mt-1 text-sm text-ink-500">{email}</p>}
        </div>
        {email && (
          <nav className="flex flex-wrap gap-2 text-sm">
            <button type="button" className="btn-studio" onClick={() => nav("/studio/posts")}>
              Posts
            </button>
            <button type="button" className="btn-studio" onClick={() => nav("/studio/posts/new")}>
              Nuevo
            </button>
            <button type="button" className="btn-studio" onClick={() => nav("/studio/media")}>
              Imágenes
            </button>
            <button
              type="button"
              className="btn-studio-ghost"
              onClick={async () => {
                await logoutStudio().catch(() => null);
                nav("/studio");
              }}
            >
              Salir
            </button>
          </nav>
        )}
      </header>
      {children}
    </div>
  );
}

function StudioGate() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [devLink, setDevLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    meStudio()
      .then((r) => {
        if (r.authenticated) nav("/studio/posts", { replace: true });
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [nav]);

  if (checking) {
    return (
      <Shell>
        <p className="text-ink-500">Cargando…</p>
      </Shell>
    );
  }

  return (
    <Shell title="Acceso">
      <div className="mx-auto max-w-md rounded-3xl border border-ink-900/10 bg-surface-elevated p-8">
        <p className="leading-relaxed text-ink-600">
          Escribe tu correo. Si está autorizado, te enviamos un enlace de un solo uso (sin
          contraseña).
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMsg("");
            setDevLink("");
            try {
              const r = await requestMagicLink(email.trim());
              let next = r.message || "Revisa tu correo.";
              if (r.warning) next = `${next} ${r.warning}`;
              setMsg(next);
              if (r.devLink) setDevLink(r.devLink);
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block text-sm">
            <span className="text-ink-500">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field mt-1"
              placeholder="leey@lockandkeyrealty.com"
              autoComplete="email"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-ink-900 px-4 py-3 text-sm font-medium text-ivory-50 disabled:opacity-50"
          >
            {busy ? "Enviando…" : "Enviar enlace"}
          </button>
        </form>
        {msg && <p className="mt-4 text-sm text-ink-600">{msg}</p>}
        {devLink && (
          <p className="mt-3 break-all text-sm">
            <span className="text-clay-700">Enlace de bootstrap: </span>
            <a className="text-clay-700 underline" href={devLink}>
              {devLink}
            </a>
          </p>
        )}
      </div>
    </Shell>
  );
}

function StudioAuthCallback() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [err, setErr] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setErr("Falta token");
      return;
    }
    verifyMagicToken(token)
      .then(() => nav("/studio/posts", { replace: true }))
      .catch((e) => setErr(e instanceof Error ? e.message : "Token inválido"));
  }, [params, nav]);

  return (
    <Shell title="Verificando…">
      {err ? (
        <div>
          <p className="text-clay-700">{err}</p>
          <button type="button" className="btn-studio mt-4" onClick={() => nav("/studio")}>
            Volver
          </button>
        </div>
      ) : (
        <p className="text-ink-500">Entrando…</p>
      )}
    </Shell>
  );
}

function StudioList() {
  const email = useEmail();
  const nav = useNavigate();
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    setBusy(true);
    try {
      const r = await listStudioPosts();
      setPosts(r.posts || []);
      setUpdatedAt(r.updatedAt || "");
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <Shell email={email} title="Posts">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-studio" onClick={() => nav("/studio/posts/new")}>
          + Nuevo post
        </button>
        <button
          type="button"
          className="btn-studio-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await seedStudio(true);
              await reload();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "seed fail");
            } finally {
              setBusy(false);
            }
          }}
        >
          Re-seed desde estático
        </button>
        {updatedAt && (
          <span className="text-xs text-ink-400">
            KV updated {new Date(updatedAt).toLocaleString()}
          </span>
        )}
      </div>
      {err && <p className="mb-4 text-sm text-clay-700">{err}</p>}
      <div className="overflow-hidden rounded-2xl border border-ink-900/10 bg-surface-elevated">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-900/10 bg-ivory-100/80 text-[11px] uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.slug} className="border-b border-ink-900/5 hover:bg-ivory-100/40">
                <td className="whitespace-nowrap px-4 py-3 text-ink-500">{p.date}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink-900">{p.titleEs || p.titleEn || "—"}</div>
                  <div className="text-xs text-ink-400">{p.titleEn}</div>
                </td>
                <td className="px-4 py-3">
                  {p.draft ? (
                    <span className="rounded-full bg-clay-100 px-2 py-0.5 text-xs text-clay-800">
                      draft
                    </span>
                  ) : (
                    <span className="rounded-full bg-pine-100 px-2 py-0.5 text-xs text-pine-800">
                      live
                    </span>
                  )}
                </td>
                <td className="max-w-[12rem] truncate px-4 py-3 font-mono text-xs text-ink-400">
                  {p.slug}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-clay-700 underline-offset-2 hover:underline"
                    onClick={() => nav(`/studio/posts/${encodeURIComponent(p.slug)}`)}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {!posts.length && !busy && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-500">
                  No hay posts en KV. Usa “Re-seed desde estático” o crea uno nuevo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function StudioEditor({ isNew = false }: { isNew?: boolean }) {
  const email = useEmail();
  const { slug: slugParam } = useParams();
  const nav = useNavigate();
  const [post, setPost] = useState<StudioPost | null>(isNew ? emptyPost() : null);
  const [tab, setTab] = useState<"es" | "en" | "meta" | "media">("es");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const originalSlug = slugParam || "";

  useEffect(() => {
    if (isNew) return;
    if (!slugParam) return;
    getStudioPost(slugParam)
      .then((r) => setPost(r.post))
      .catch((e) => setErr(e instanceof Error ? e.message : "load fail"));
  }, [isNew, slugParam]);

  useEffect(() => {
    listMedia()
      .then((r) => setMedia(r.items || []))
      .catch(() => null);
  }, []);

  if (!post) {
    return (
      <Shell email={email} title="Editor">
        {err ? <p className="text-clay-700">{err}</p> : <p className="text-ink-500">Cargando post…</p>}
      </Shell>
    );
  }

  function setField<K extends keyof StudioPost>(key: K, value: StudioPost[K]) {
    setPost((p) => (p ? { ...p, [key]: value } : p));
  }

  function setCover(patch: Partial<StudioFigure>) {
    setPost((p) => (p ? { ...p, cover: { ...p.cover, ...patch } } : p));
  }

  function setFigure(i: number, patch: Partial<StudioFigure>) {
    setPost((p) => {
      if (!p) return p;
      const figures = [...(p.figures || [])];
      figures[i] = { ...(figures[i] || { src: "", altEs: "", altEn: "" }), ...patch };
      return { ...p, figures };
    });
  }

  async function onSave(asDraft?: boolean) {
    if (!post) return;
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const payload: StudioPost = {
        ...post,
        draft: asDraft === undefined ? !!post.draft : asDraft,
        slug: post.slug || slugifyClient(post.titleEn || post.titleEs || `nota-${post.date}`),
      };

      let saved: { post: StudioPost };
      if (isNew) {
        saved = await saveStudioPost(payload, true);
      } else {
        // PUT always against the URL slug so renames stay on the same resource key path
        const res = await fetch(`/api/blog/posts/${encodeURIComponent(originalSlug)}`, {
          method: "PUT",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ post: payload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "save_fail");
        saved = data;
      }
      setPost(saved.post);
      setMsg(payload.draft ? "Guardado como borrador (no público)." : "Publicado en el feed live.");
      if (isNew || (saved.post.slug && saved.post.slug !== originalSlug)) {
        nav(`/studio/posts/${encodeURIComponent(saved.post.slug)}`, { replace: true });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "save fail");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!post?.slug || isNew) return;
    if (!confirm(`¿Borrar ${post.slug}?`)) return;
    setBusy(true);
    try {
      await deleteStudioPost(post.slug);
      nav("/studio/posts");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "delete fail");
      setBusy(false);
    }
  }

  return (
    <Shell email={email} title={isNew ? "Nuevo post" : post.titleEs || post.slug}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["es", "en", "meta", "media"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm ${
              tab === t ? "bg-ink-900 text-ivory-50" : "border border-ink-900/15 text-ink-700"
            }`}
          >
            {t === "es" ? "Español" : t === "en" ? "English" : t === "meta" ? "Meta / SEO" : "Imágenes"}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" disabled={busy} className="btn-studio-ghost" onClick={() => onSave(true)}>
            Guardar draft
          </button>
          <button
            type="button"
            disabled={busy}
            className="btn-studio-primary"
            onClick={() => onSave(false)}
          >
            Publicar live
          </button>
          {!isNew && (
            <button type="button" disabled={busy} className="btn-studio-danger" onClick={onDelete}>
              Borrar
            </button>
          )}
        </div>
      </div>
      {msg && <p className="mb-3 text-sm text-pine-700">{msg}</p>}
      {err && <p className="mb-3 text-sm text-clay-700">{err}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {tab === "es" && (
            <>
              <Field label="Título ES">
                <input
                  className="field"
                  value={post.titleEs}
                  onChange={(e) => setField("titleEs", e.target.value)}
                />
              </Field>
              <Field label="Excerpt ES">
                <textarea
                  className="field min-h-[80px]"
                  value={post.excerptEs}
                  onChange={(e) => setField("excerptEs", e.target.value)}
                />
              </Field>
              <Field label='Cuerpo ES (párrafos con línea en blanco; **subtítulo**; {{figure:0}})'>
                <textarea
                  className="field min-h-[420px] font-mono text-[13px] leading-relaxed"
                  value={post.bodyEs}
                  onChange={(e) => setField("bodyEs", e.target.value)}
                />
              </Field>
            </>
          )}
          {tab === "en" && (
            <>
              <Field label="Title EN">
                <input
                  className="field"
                  value={post.titleEn}
                  onChange={(e) => setField("titleEn", e.target.value)}
                />
              </Field>
              <Field label="Excerpt EN">
                <textarea
                  className="field min-h-[80px]"
                  value={post.excerptEn}
                  onChange={(e) => setField("excerptEn", e.target.value)}
                />
              </Field>
              <Field label="Body EN">
                <textarea
                  className="field min-h-[420px] font-mono text-[13px] leading-relaxed"
                  value={post.bodyEn}
                  onChange={(e) => setField("bodyEn", e.target.value)}
                />
              </Field>
            </>
          )}
          {tab === "meta" && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Slug">
                  <input
                    className="field font-mono text-sm"
                    value={post.slug}
                    onChange={(e) => setField("slug", e.target.value)}
                    disabled={!isNew}
                  />
                </Field>
                <Field label="Fecha">
                  <input
                    type="date"
                    className="field"
                    value={post.date}
                    onChange={(e) => setField("date", e.target.value)}
                  />
                </Field>
                <Field label="Categoría">
                  <select
                    className="field"
                    value={post.category}
                    onChange={(e) => setField("category", e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Min. lectura">
                  <input
                    type="number"
                    min={1}
                    className="field"
                    value={post.readMinutes}
                    onChange={(e) => setField("readMinutes", Number(e.target.value) || 1)}
                  />
                </Field>
              </div>
              <Field label="Tags (coma)">
                <input
                  className="field"
                  value={(post.tags || []).join(", ")}
                  onChange={(e) =>
                    setField(
                      "tags",
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </Field>
              <Field label="Areas (coma, slugs)">
                <input
                  className="field"
                  value={(post.areas || []).join(", ")}
                  onChange={(e) =>
                    setField(
                      "areas",
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </Field>
              <Field label="SEO title ES">
                <input
                  className="field"
                  value={post.seoTitleEs || ""}
                  onChange={(e) => setField("seoTitleEs", e.target.value)}
                />
              </Field>
              <Field label="SEO title EN">
                <input
                  className="field"
                  value={post.seoTitleEn || ""}
                  onChange={(e) => setField("seoTitleEn", e.target.value)}
                />
              </Field>
              <Field label="SEO desc ES">
                <textarea
                  className="field min-h-[70px]"
                  value={post.seoDescriptionEs || ""}
                  onChange={(e) => setField("seoDescriptionEs", e.target.value)}
                />
              </Field>
              <Field label="SEO desc EN">
                <textarea
                  className="field min-h-[70px]"
                  value={post.seoDescriptionEn || ""}
                  onChange={(e) => setField("seoDescriptionEn", e.target.value)}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={!!post.draft}
                  onChange={(e) => setField("draft", e.target.checked)}
                />
                Borrador (oculto del blog público)
              </label>
            </>
          )}
          {tab === "media" && (
            <div className="space-y-6">
              <Field label="Cover src">
                <input
                  className="field font-mono text-sm"
                  value={post.cover?.src || ""}
                  onChange={(e) => setCover({ src: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Cover alt ES">
                  <input
                    className="field"
                    value={post.cover?.altEs || ""}
                    onChange={(e) => setCover({ altEs: e.target.value })}
                  />
                </Field>
                <Field label="Cover alt EN">
                  <input
                    className="field"
                    value={post.cover?.altEn || ""}
                    onChange={(e) => setCover({ altEn: e.target.value })}
                  />
                </Field>
              </div>
              {post.cover?.src && (
                <img src={post.cover.src} alt="" className="max-h-56 rounded-xl object-cover" />
              )}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium">Figures (índice = {"{{figure:n}}"})</h3>
                  <button
                    type="button"
                    className="btn-studio"
                    onClick={() =>
                      setPost((p) =>
                        p
                          ? {
                              ...p,
                              figures: [
                                ...(p.figures || []),
                                { src: "", altEs: "", altEn: "", kind: "photo" },
                              ],
                            }
                          : p,
                      )
                    }
                  >
                    + Figure
                  </button>
                </div>
                {(post.figures || []).map((f, i) => (
                  <div key={i} className="mb-4 rounded-xl border border-ink-900/10 p-3">
                    <div className="mb-2 text-xs text-ink-400">figure:{i}</div>
                    <input
                      className="field mb-2 font-mono text-sm"
                      placeholder="src"
                      value={f.src}
                      onChange={(e) => setFigure(i, { src: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="field"
                        placeholder="alt ES"
                        value={f.altEs}
                        onChange={(e) => setFigure(i, { altEs: e.target.value })}
                      />
                      <input
                        className="field"
                        placeholder="alt EN"
                        value={f.altEn}
                        onChange={(e) => setFigure(i, { altEn: e.target.value })}
                      />
                    </div>
                    {f.src && <img src={f.src} alt="" className="mt-2 max-h-40 rounded-lg object-cover" />}
                    <button
                      type="button"
                      className="mt-2 text-xs text-clay-700"
                      onClick={() =>
                        setPost((p) =>
                          p ? { ...p, figures: (p.figures || []).filter((_, j) => j !== i) } : p,
                        )
                      }
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">Biblioteca (clic = cover)</h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {media.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      className="overflow-hidden rounded-lg border border-ink-900/10"
                      onClick={() => setCover({ src: m.src })}
                      title={m.name}
                    >
                      <img src={m.src} alt="" className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-ink-900/10 bg-surface-elevated p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              Vista previa ES
            </p>
            <h2 className="mt-2 font-display text-2xl font-light">
              {post.titleEs || "Sin título"}
            </h2>
            <p className="mt-2 text-sm text-ink-500">{post.excerptEs}</p>
            {post.cover?.src && (
              <img
                src={post.cover.src}
                alt=""
                className="mt-4 max-h-40 w-full rounded-xl object-cover"
              />
            )}
            <div className="mt-4 max-h-64 space-y-3 overflow-auto text-sm leading-relaxed text-ink-700">
              {String(post.bodyEs || "")
                .split(/\n{2,}/)
                .filter(Boolean)
                .slice(0, 8)
                .map((chunk, i) => (
                  <p key={i} className="whitespace-pre-wrap">
                    {chunk}
                  </p>
                ))}
            </div>
          </div>
          <div className="rounded-2xl border border-ink-900/10 bg-ivory-100/60 p-4 text-xs text-ink-500">
            <p>
              Live feed: <code className="text-ink-700">/data/blog/posts.json</code> sale de KV (sin
              draft).
            </p>
            <p className="mt-2">
              Los agentes Hermes empujan con{" "}
              <code className="text-ink-700">POST /api/blog/agent/upsert</code> + token.
            </p>
            {post.editedBy && <p className="mt-2">Último editor: {post.editedBy}</p>}
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function StudioMedia() {
  const email = useEmail();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const r = await listMedia();
    setItems(r.items || []);
  }

  useEffect(() => {
    reload().catch((e) => setErr(e instanceof Error ? e.message : "fail"));
  }, []);

  return (
    <Shell email={email} title="Imágenes">
      <label className="mb-6 inline-flex cursor-pointer bg-ink-900 px-4 py-3 text-sm text-ivory-50">
        {busy ? "Subiendo…" : "Subir imagen"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            setErr("");
            try {
              await uploadMedia(f);
              await reload();
            } catch (ex) {
              setErr(ex instanceof Error ? ex.message : "upload fail");
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {err && <p className="mb-4 text-sm text-clay-700">{err}</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {items.map((m) => (
          <div
            key={m.key}
            className="overflow-hidden rounded-2xl border border-ink-900/10 bg-surface-elevated"
          >
            <img src={m.src} alt={m.name} className="aspect-[4/3] w-full object-cover" />
            <div className="space-y-1 p-3 text-xs">
              <p className="truncate font-medium text-ink-800">{m.name}</p>
              <p className="break-all font-mono text-[10px] text-ink-400">{m.src}</p>
              <button
                type="button"
                className="text-clay-700"
                onClick={async () => {
                  if (!confirm("¿Borrar?")) return;
                  await deleteMedia(m.key);
                  await reload();
                }}
              >
                Borrar
              </button>
              <button
                type="button"
                className="ml-3 text-ink-600"
                onClick={() => navigator.clipboard.writeText(m.src)}
              >
                Copiar URL
              </button>
            </div>
          </div>
        ))}
      </div>
      {!items.length && <p className="text-ink-500">Aún no hay imágenes en R2.</p>}
    </Shell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-ink-500">{label}</span>
      {children}
    </label>
  );
}

function slugifyClient(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
