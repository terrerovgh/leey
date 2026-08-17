#!/usr/bin/env python3
"""Replace SVG covers/figures on published posts with real free web photos.
No decorative Spanish SVGs. English-only chart only if photo fetch fails hard.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "blog_pipeline"))
import run as pipe  # noqa: E402

POSTS = ROOT / "public/data/blog/posts.json"
ASSETS = ROOT / "public/assets/blog"

JOBS = [
    {
        "date": "2026-08-15",
        "slug": "porche-sur-georgia-primeras-impresiones",
        "topic": "porch-seasonal",
        "queries": [
            "southern front porch house",
            "American porch rocking chair home exterior",
            "Georgia house front porch",
            "brick house porch United States",
            "wooden porch residential home",
        ],
    },
    {
        "date": "2026-08-16",
        "slug": "oferta-sin-prisa-valdosta",
        "topic": "first-offer-nerves",
        "queries": [
            "house for sale yard sign residential",
            "real estate for sale sign front yard",
            "couple touring home interior",
            "suburban home exterior United States",
            "open house residential street",
        ],
    },
    {
        "date": "2026-08-17",
        "slug": "valdosta-hahira-adel-donde-empezar",
        "topic": "hahira-drive",
        "queries": [
            "small town main street Georgia",
            "Valdosta Georgia downtown",
            "residential neighborhood south Georgia",
            "tree lined suburban street USA",
            "American small town houses street",
        ],
    },
]


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def collect_seen_hashes() -> set[str]:
    seen: set[str] = set()
    for p in ASSETS.rglob("*"):
        if p.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        try:
            seen.add(hashlib.sha1(p.read_bytes()).hexdigest())
        except Exception:
            pass
    return seen


def fetch_photos(queries: list[str], topic_id: str, day: str, seen: set[str], n: int = 4) -> list[dict]:
    candidates: list[dict] = []
    for q in queries:
        try:
            candidates.extend(pipe.wikimedia_search(q, limit=6))
        except Exception as e:
            print(f"  wiki fail {q}: {e}")
        try:
            candidates.extend(pipe.openverse_search(q, limit=5))
        except Exception as e:
            print(f"  openverse fail {q}: {e}")
        time.sleep(0.3)
        if len(candidates) >= 24:
            break

    urls = set()
    uniq = []
    for c in candidates:
        u = c.get("url") or ""
        if not u or u in urls:
            continue
        urls.add(u)
        uniq.append(c)

    day_key = day.replace("-", "")
    pub_dir = ASSETS / day_key
    pub_dir.mkdir(parents=True, exist_ok=True)
    work = ROOT / "data/blog/pipeline" / day / "images"
    work.mkdir(parents=True, exist_ok=True)

    saved = []
    for i, c in enumerate(uniq):
        u = c.get("url") or ""
        full = c.get("full") or u
        name = f"{topic_id}-{i+1}.jpg"
        dest_w = work / name
        dest_p = pub_dir / name
        ok = pipe.download_image(u, dest_w, seen_hashes=seen)
        if not ok and full != u:
            ok = pipe.download_image(full, dest_w, seen_hashes=seen)
        if not ok:
            continue
        shutil.copy2(dest_w, dest_p)
        rel = f"/assets/blog/{day_key}/{name}"
        artist = c.get("artist") or "Unknown"
        license_ = c.get("license") or "cc"
        saved.append(
            {
                "src": rel,
                "altEs": f"Foto relacionada · {artist}",
                "altEn": f"Related photo · {artist}",
                "captionEs": f"Foto: {artist} · {license_}",
                "captionEn": f"Photo: {artist} · {license_}",
                "license": license_,
                "artist": artist,
                "source": c.get("source"),
                "page": c.get("page") or "",
            }
        )
        print(f"  saved {rel} ({license_})")
        if len(saved) >= n:
            break
    return saved


def main() -> int:
    data = json.loads(POSTS.read_text(encoding="utf-8"))
    posts = data.get("posts") or []
    by_slug = {p.get("slug"): p for p in posts}
    seen = collect_seen_hashes()
    changed = 0

    for job in JOBS:
        slug = job["slug"]
        post = by_slug.get(slug)
        if not post:
            print(f"MISSING post {slug}")
            continue
        print(f"\n=== {slug} ===")
        # wipe old day folder photos that were duplicates of kitchen set
        day_key = job["date"].replace("-", "")
        day_dir = ASSETS / day_key
        if day_dir.exists():
            for f in day_dir.iterdir():
                if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".svg"):
                    # remove from hash set if present
                    try:
                        h = hashlib.sha1(f.read_bytes()).hexdigest()
                        seen.discard(h)
                    except Exception:
                        pass
                    f.unlink(missing_ok=True)

        photos = fetch_photos(job["queries"], job["topic"], job["date"], seen, n=4)
        if not photos:
            print("  WARN: no photos — leaving post unchanged")
            continue

        cover = photos[0]
        post["cover"] = {
            "src": cover["src"],
            "altEs": cover["altEs"],
            "altEn": cover["altEn"],
        }
        post["figures"] = [
            {
                "src": ph["src"],
                "altEs": ph["altEs"],
                "altEn": ph["altEn"],
                "captionEs": ph["captionEs"],
                "captionEn": ph["captionEn"],
            }
            for ph in photos
        ]
        # ensure body has figure markers for multi photo
        for lang in ("bodyEs", "bodyEn"):
            body = post.get(lang) or ""
            # strip svg figure refs if any leftover text
            if "{{figure:0}}" not in body:
                body = body.rstrip() + "\n\n{{figure:0}}"
            # add more figures if body is long enough and only one marker
            for i in range(1, min(3, len(photos))):
                marker = f"{{{{figure:{i}}}}}"
                if marker not in body and len(body) > 500:
                    # insert before signoff if present
                    if "— Leey" in body:
                        body = body.replace("— Leey", f"{marker}\n\n— Leey", 1)
                    elif "- Leey" in body:
                        body = body.replace("- Leey", f"{marker}\n\n- Leey", 1)
                    else:
                        body = body.rstrip() + f"\n\n{marker}"
            post[lang] = body
        post["updatedAt"] = utc_now()
        changed += 1
        print(f"  updated cover + {len(photos)} figures")

    # delete root decorative SVG assets no longer referenced
    root_svgs = [
        "porch-refresh.svg",
        "offer-steps.svg",
        "valdosta-areas.svg",
        "kitchen-budget.svg",
    ]
    for name in root_svgs:
        p = ASSETS / name
        if p.exists():
            p.unlink()
            print(f"removed {p}")

    # verify no svg left in posts
    for p in posts:
        srcs = [(p.get("cover") or {}).get("src", "")] + [f.get("src", "") for f in (p.get("figures") or [])]
        bad = [s for s in srcs if s.endswith(".svg")]
        if bad:
            print(f"WARN still svg on {p.get('slug')}: {bad}")

    if changed:
        data["posts"] = posts
        data["updatedAt"] = utc_now()
        POSTS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\nWrote posts.json ({changed} posts updated)")
    else:
        print("No changes")
    return 0 if changed else 1


if __name__ == "__main__":
    raise SystemExit(main())
