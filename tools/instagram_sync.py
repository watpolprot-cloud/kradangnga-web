#!/usr/bin/env python3
"""ดึงโพสต์จาก Instagram @green.prot มาไว้ในเว็บคณะสี

GitHub Actions (.github/workflows/instagram-sync.yml) รันไฟล์นี้ทุก 2 ชั่วโมงช่วง 06.00–22.00 น. แล้วบันทึกผลขึ้นเว็บเอง
วิธีหลักคือหน้า embed ของบัญชี (เปิดได้โดยไม่ต้องล็อกอิน ได้โพสต์ล่าสุด 6 โพสต์) โพสต์ที่เคยดึงได้จะเก็บสะสมไว้เรื่อย ๆ
โพสต์เก่าที่อยากให้ขึ้นเว็บด้วย ใส่รหัสโพสต์ไว้ใน posts ของ data/instagram.js แล้วบอทจะไปดึงมาให้
- รายการโพสต์ คำบรรยาย และข้อมูลบัญชี -> data/instagram-feed.js (ไฟล์นี้สร้างอัตโนมัติ ห้ามแก้ด้วยมือ)
- ภาพของโพสต์ -> assets/img/instagram/<รหัสโพสต์>.jpg (ภาพแรก) และ <รหัสโพสต์>-2.jpg, -3.jpg ... (โพสต์หลายภาพ)
ถ้าจะเขียนชื่อเรื่อง ปักหมุดประกาศด่วน หรือซ่อนโพสต์ ให้แก้ data/instagram.js

ถ้าดึงจาก Instagram ไม่สำเร็จ จะคงข้อมูลเดิมไว้ ไม่ลบโพสต์ที่เคยขึ้นเว็บ
โพสต์ที่ใส่ hide: true หรือมีคำใน hideWords ของ data/instagram.js จะไม่ถูกดึงขึ้นเว็บเลย (ไม่เก็บภาพด้วย)
ต้องใช้: pip install curl_cffi pillow
"""
import datetime
import html
import io
import json
import os
import re
import shutil
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACCOUNT = "green.prot"
PROFILE_URL = f"https://www.instagram.com/{ACCOUNT}/"
FEED = ROOT / "data" / "instagram-feed.js"
CURATED = ROOT / "data" / "instagram.js"
IMG_DIR = ROOT / "assets" / "img" / "instagram"
MAX_POSTS = 150          # เก็บโพสต์ล่าสุดไม่เกินเท่านี้
MAX_IMAGES = 10          # ภาพต่อโพสต์
IMG_WIDTH = 960
APP_ID = "936619743392459"
TIMELINE_HASH = "69cba40317214236af40e7efa697781d"
TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")
DEBUG = os.environ.get("IG_DEBUG") == "1"   # เก็บหน้าที่ Instagram ตอบกลับไว้ดูสาเหตุเวลาดึงไม่ได้
DEBUG_DIR = ROOT / "data" / "instagram-debug"
MOBILE_UA = ("Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; "
             "exynos2100; en_US; 458229237)")
API_HEADERS = {"X-IG-App-ID": APP_ID, "X-ASBD-ID": "129477", "X-Requested-With": "XMLHttpRequest",
               "Referer": PROFILE_URL, "Accept": "*/*", "Accept-Language": "th-TH,th;q=0.9,en;q=0.8"}
HEADER = ("/* สร้างอัตโนมัติโดย tools/instagram_sync.py (GitHub Actions ดึงจาก Instagram ทุก 2 ชั่วโมง)\n"
          "   ห้ามแก้ไฟล์นี้ด้วยมือ ถ้าจะเขียนชื่อเรื่อง ปักหมุดประกาศด่วน หรือซ่อนโพสต์ ให้แก้ data/instagram.js */\n")

summary = []   # สรุปผลแต่ละวิธี แสดงในหน้าผลการรันของ GitHub Actions


def log(msg):
    print(msg, flush=True)
    summary.append(msg)


def warn(msg):
    print(f"::warning::{msg}", flush=True)
    summary.append(f"คำเตือน: {msg}")


def dump(name, st, body):
    if not DEBUG:
        return
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    text = body.decode("utf-8", "replace") if isinstance(body, bytes) else str(body)
    (DEBUG_DIR / f"{name}.txt").write_text(f"HTTP {st}\n{text[:400000]}", "utf-8")


# ---------- HTTP ----------
class Http:
    def __init__(self):
        try:
            from curl_cffi import requests as creq
            self.s = creq.Session(impersonate="chrome")
        except ImportError:
            self.s = None

    def get(self, url, headers=None):
        headers = headers or {}
        if self.s is not None:
            r = self.s.get(url, headers=headers, timeout=30)
            return r.status_code, r.content
        req = urllib.request.Request(url, headers={"User-Agent": UA, **headers})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.status, resp.read()
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read()


def load_old():
    try:
        txt = FEED.read_text("utf-8")
        start = txt.index("{", txt.index("KD.instagramFeed"))
        return json.loads(txt[start:txt.rindex("}") + 1])
    except (OSError, ValueError):
        return {}


def load_rules():
    # อ่านโพสต์ที่ซ่อน และคำที่ทำให้โพสต์ไม่ขึ้นเว็บ จาก data/instagram.js
    try:
        txt = CURATED.read_text("utf-8")
    except OSError:
        return set(), [], []
    hide = set(re.findall(r'"([A-Za-z0-9_-]{5,20})"\s*:\s*\{[^{}]*?\bhide\s*:\s*true', txt))
    m = re.search(r'hideWords\s*:\s*\[([^\]]*)\]', txt)
    words = [w.lower() for w in re.findall(r'"([^"]+)"', m.group(1))] if m else []
    m = re.search(r'\bposts\s*:\s*\{', txt)
    listed = re.findall(r'"([A-Za-z0-9_-]{8,40})"\s*:\s*\{', txt[m.end():]) if m else []
    return hide, words, [c for c in listed if c not in hide]


def to_int(x):
    try:
        return int(x)
    except (TypeError, ValueError):
        return None


def th_date(ts):
    return datetime.datetime.fromtimestamp(ts, TZ_TH).strftime("%Y-%m-%d") if ts else ""


# ---------- แปลงข้อมูลโพสต์ (รองรับทั้งรูปแบบ graph และ api v1 ของ Instagram) ----------
def from_graph(n):
    sc = n.get("shortcode") or n.get("code")
    if not sc:
        return None
    caps = ((n.get("edge_media_to_caption") or {}).get("edges") or [])
    caption = caps[0]["node"].get("text", "") if caps else ""
    kids = [e.get("node") or {} for e in ((n.get("edge_sidecar_to_children") or {}).get("edges") or [])]
    imgs = [k.get("display_url") for k in kids if k.get("display_url")] or [n.get("display_url") or n.get("thumbnail_src")]
    likes = (n.get("edge_liked_by") or n.get("edge_media_preview_like") or {}).get("count")
    return {
        "id": sc,
        "caption": caption,
        "ts": to_int(n.get("taken_at_timestamp")),
        "kind": "carousel" if kids or n.get("__typename") == "GraphSidecar" else ("video" if n.get("is_video") else "image"),
        "reel": n.get("product_type") == "clips",
        "alt": n.get("accessibility_caption") or "",
        "imageUrls": [u for u in imgs if u][:MAX_IMAGES],
        "likes": to_int(likes),
        "comments": to_int((n.get("edge_media_to_comment") or {}).get("count")),
        "pinned": bool(n.get("pinned_for_users")),
    }


def from_v1(it):
    sc = it.get("code")
    if not sc:
        return None

    def best(m):
        c = ((m.get("image_versions2") or {}).get("candidates") or [])
        return c[0].get("url") if c else ""
    kids = it.get("carousel_media") or []
    imgs = [best(k) for k in kids] or [best(it)]
    mt = it.get("media_type")
    return {
        "id": sc,
        "caption": (it.get("caption") or {}).get("text") or "",
        "ts": to_int(it.get("taken_at")),
        "kind": "carousel" if mt == 8 else ("video" if mt == 2 else "image"),
        "reel": it.get("product_type") == "clips",
        "alt": it.get("accessibility_caption") or "",
        "imageUrls": [u for u in imgs if u][:MAX_IMAGES],
        "likes": to_int(it.get("like_count")),
        "comments": to_int(it.get("comment_count")),
        "pinned": bool(it.get("timeline_pinned_user_ids")),
    }


def parse_user(user):
    media = user.get("edge_owner_to_timeline_media") or {}
    posts = [p for p in (from_graph(e.get("node") or {}) for e in media.get("edges") or []) if p]
    page = media.get("page_info") or {}
    profile = {
        "name": user.get("full_name") or "",
        "bio": user.get("biography") or "",
        "avatarUrl": user.get("profile_pic_url_hd") or user.get("profile_pic_url") or "",
        "followers": to_int((user.get("edge_followed_by") or {}).get("count")),
        "following": to_int((user.get("edge_follow") or {}).get("count")),
        "posts": to_int(media.get("count")),
    }
    return profile, posts, user.get("id"), page.get("end_cursor") if page.get("has_next_page") else None


# ---------- วิธีดึง ----------
def fetch_web_profile(http, host):
    headers = dict(API_HEADERS)
    if host.startswith("i."):
        headers["User-Agent"] = MOBILE_UA
    st, body = http.get(f"https://{host}/api/v1/users/web_profile_info/?username={ACCOUNT}", headers)
    user = (json.loads(body).get("data") or {}).get("user") if st == 200 else None
    if not user:
        dump("web_profile_info-" + host.split(".")[0], st, body)
        raise RuntimeError(f"HTTP {st} {body[:60].decode('utf-8', 'replace')!r}")
    return parse_user(user)


def fetch_more(http, user_id, cursor, need):
    # หน้าถัดไปของโพสต์ (ใช้ตอนเริ่มเก็บครั้งแรก เพื่อเอาโพสต์เก่าทั้งหมดมาด้วย)
    posts = []
    while cursor and len(posts) < need:
        var = json.dumps({"id": user_id, "first": 50, "after": cursor}, separators=(",", ":"))
        st, body = http.get("https://www.instagram.com/graphql/query/?query_hash=" + TIMELINE_HASH
                            + "&variables=" + urllib.parse.quote(var), API_HEADERS)
        if st != 200:
            raise RuntimeError(f"HTTP {st}")
        media = ((json.loads(body).get("data") or {}).get("user") or {}).get("edge_owner_to_timeline_media") or {}
        got = [p for p in (from_graph(e.get("node") or {}) for e in media.get("edges") or []) if p]
        if not got:
            break
        posts += got
        page = media.get("page_info") or {}
        cursor = page.get("end_cursor") if page.get("has_next_page") else None
    return posts


def embed_context(body):
    # หน้า embed เก็บข้อมูลโพสต์ไว้ใน contextJSON (เป็น JSON ซ้อนอยู่ในสตริง)
    m = re.search(rb'"contextJSON":"((?:\\.|[^"\\])*)"', body)
    if not m:
        return None
    try:
        ctx = json.loads(json.loads(b'"' + m.group(1) + b'"'))
    except ValueError:
        return None
    return ctx.get("context") or ctx


def find_media(obj, code):
    if isinstance(obj, dict):
        if (obj.get("shortcode") or obj.get("code")) == code and ("display_url" in obj or "edge_media_to_caption" in obj):
            return obj
        obj = list(obj.values())
    if isinstance(obj, list):
        for v in obj:
            hit = find_media(v, code)
            if hit:
                return hit
    return None


def fetch_post_embed(http, code):
    # หน้า embed ของโพสต์เดี่ยว เปิดได้โดยไม่ต้องล็อกอิน มีคำบรรยายและภาพทุกภาพของโพสต์
    st, body = http.get(f"https://www.instagram.com/p/{code}/embed/captioned/", {"Referer": "https://watpolprot-cloud.github.io/"})
    if DEBUG and not (DEBUG_DIR / "post-embed.txt").exists():
        dump("post-embed", st, body)
    if st != 200:
        raise RuntimeError(f"HTTP {st}")
    media = find_media(embed_context(body), code)
    p = from_graph(media) if media else None
    if p:
        return p
    text = body.decode("utf-8", "replace")
    cap = re.search(r'<div class="Caption">(.*?)<div class="CaptionComments">', text, re.S)
    caption = ""
    if cap:
        inner = re.sub(r'<a class="CaptionUsername".*?</a>', "", cap.group(1), flags=re.S)
        caption = html.unescape(re.sub(r"<[^>]+>", "", inner.replace("<br />", "\n").replace("<br/>", "\n"))).strip()
    img = re.search(r'<img class="EmbeddedMediaImage"[^>]*src="([^"]+)"', text)
    ts = re.search(r'datetime="([0-9T:\-\.Z+]+)"', text)
    if not img and not caption:
        raise RuntimeError("หน้า embed ไม่มีข้อมูลโพสต์")
    when = None
    if ts:
        try:
            when = int(datetime.datetime.fromisoformat(ts.group(1).replace("Z", "+00:00")).timestamp())
        except ValueError:
            pass
    return {"id": code, "caption": caption, "ts": when, "kind": "image", "reel": False, "alt": "",
            "imageUrls": [html.unescape(img.group(1))] if img else []}


def fetch_profile_embed(http):
    # หน้า embed ของบัญชี: ชื่อบัญชี ยอดผู้ติดตาม จำนวนโพสต์ และโพสต์ล่าสุด 6 โพสต์
    st, body = http.get(f"https://www.instagram.com/{ACCOUNT}/embed/", {"Referer": "https://watpolprot-cloud.github.io/"})
    dump("profile-embed", st, body)
    if st != 200:
        raise RuntimeError(f"HTTP {st}")
    ctx = embed_context(body)
    if not ctx or ctx.get("graphql_media") is None:
        raise RuntimeError(f"ไม่พบข้อมูลโพสต์ในหน้า embed ({len(body)} ไบต์)")
    profile = {
        "name": ctx.get("full_name") or "",
        "bio": None,
        "avatarUrl": ctx.get("profile_pic_url") or "",
        "followers": to_int(ctx.get("followers_count")),
        "following": None,
        "posts": to_int(ctx.get("posts_count")),
    }
    posts = [p for p in (from_graph(g.get("shortcode_media") or g) for g in ctx["graphql_media"]) if p]
    return profile, posts, ctx.get("owner_id")


def probe(http, code, owner_id):
    # โหมดตรวจสาเหตุ: ลองเปิดหน้าอื่น ๆ แล้วเก็บผลไว้ดู (ไม่ใช้ข้อมูลจริง)
    tries = []
    if owner_id:
        var = json.dumps({"id": str(owner_id), "first": 12}, separators=(",", ":"))
        tries.append(("graphql", "https://www.instagram.com/graphql/query/?query_hash=" + TIMELINE_HASH
                      + "&variables=" + urllib.parse.quote(var), API_HEADERS))
    if code:
        tries.append(("post-embed", f"https://www.instagram.com/p/{code}/embed/captioned/", {"Referer": "https://watpolprot-cloud.github.io/"}))
    for name, url, headers in tries:
        try:
            st, body = http.get(url, headers)
            dump("probe-" + name, st, body)
            log(f"ตรวจ {name}: HTTP {st} {len(body)} ไบต์")
        except Exception as exc:
            log(f"ตรวจ {name}: {exc}")


# ---------- ภาพ ----------
def save_image(http, url, dest):
    from PIL import Image
    if not url:
        return False
    try:
        st, body = http.get(url, {"Referer": "https://www.instagram.com/"})
        if st != 200 or not body:
            return False
        im = Image.open(io.BytesIO(body)).convert("RGB")
        if im.width > IMG_WIDTH:
            im = im.resize((IMG_WIDTH, round(im.height * IMG_WIDTH / im.width)), Image.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "JPEG", quality=82, optimize=True, progressive=True)
        return True
    except Exception as exc:  # ภาพเดียวพังไม่ควรทำให้ทั้งรอบล้ม
        warn(f"บันทึกภาพ {dest.name} ไม่สำเร็จ: {exc}")
        return False


def image_size(path):
    from PIL import Image
    try:
        with Image.open(path) as im:
            return im.size
    except OSError:
        return None, None


def write_feed(feed):
    FEED.write_text(HEADER + "window.KD = window.KD || {};\nKD.instagramFeed = "
                    + json.dumps(feed, ensure_ascii=False, indent=1) + ";\n", "utf-8")


def write_summary():
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write("### ดึงโพสต์ Instagram @" + ACCOUNT + "\n\n" + "\n".join("- " + s for s in summary) + "\n")


def main():
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    if not DEBUG and DEBUG_DIR.exists():
        shutil.rmtree(DEBUG_DIR)
    old = load_old()
    old_posts = {p["id"]: p for p in old.get("posts") or []}
    hide, words, listed = load_rules()
    http = Http()
    errors = []
    profile, found, via, owner_id, page_complete = None, {}, [], None, False

    # 1) หน้า embed ของบัญชี (วิธีหลัก)
    try:
        profile, posts, owner_id = fetch_profile_embed(http)
        found.update((p["id"], p) for p in posts)
        via.append("embed")
        log(f"embed: ได้ {len(posts)} โพสต์ บัญชีมี {profile['posts']} โพสต์ ผู้ติดตาม {profile['followers']}")
    except Exception as exc:
        errors.append(f"embed: {exc}")
    window = list(found.values())   # โพสต์ล่าสุดที่เรียงต่อกัน ใช้ตรวจว่าโพสต์ไหนถูกลบ

    # 2) ถ้ายังเก็บโพสต์ไม่ครบ ลอง API ของหน้าเว็บ (มักถูกจำกัดเมื่อเรียกจากเซิร์ฟเวอร์ แต่ถ้าได้จะได้โพสต์เก่าด้วย)
    total = (profile or {}).get("posts") or 0
    if not found or len(set(old_posts) | set(found)) < min(total, MAX_POSTS):
        for host in ("www.instagram.com", "i.instagram.com"):
            try:
                prof2, posts, user_id, cursor = fetch_web_profile(http, host)
                profile = dict(prof2, followers=prof2["followers"] or (profile or {}).get("followers"))
                total = profile.get("posts") or total
                if cursor and len(old_posts) < min(total, MAX_POSTS):
                    try:
                        more = fetch_more(http, user_id, cursor, MAX_POSTS - len(posts))
                        posts += more
                        log(f"ดึงโพสต์เก่าเพิ่มอีก {len(more)} โพสต์")
                    except Exception as exc:
                        errors.append(f"โพสต์เก่า: {exc}")
                found.update((p["id"], p) for p in posts)
                window = posts
                page_complete = bool(total) and len(posts) >= total
                via.append("web_profile_info")
                log(f"web_profile_info@{host}: ได้ {len(posts)} โพสต์")
                break
            except Exception as exc:
                errors.append(f"web_profile_info@{host}: {exc}")

    # 3) โพสต์เก่าที่ใส่รหัสไว้ใน data/instagram.js และโพสต์หลายภาพที่ยังได้ภาพไม่ครบ เปิด embed ของโพสต์นั้น
    todo = [c for c in listed if c not in found and c not in old_posts][:15]
    todo += [p["id"] for p in found.values() if p["kind"] == "carousel" and len(p.get("imageUrls") or []) < 2
             and len((old_posts.get(p["id"]) or {}).get("images") or []) < 2][:6]
    for code in todo:
        try:
            got = fetch_post_embed(http, code)
            if code in found:
                prev = found[code]
                if len(got.get("imageUrls") or []) > len(prev.get("imageUrls") or []):
                    prev["imageUrls"] = got["imageUrls"]
            else:
                found[code] = got
            log(f"embed โพสต์ {code}: ได้ {len(got.get('imageUrls') or [])} ภาพ")
        except Exception as exc:
            errors.append(f"embed โพสต์ {code}: {exc}")
    for e in errors:
        warn(e)
    if DEBUG:
        probe(http, next(iter(found), None), owner_id)

    if not found:
        log("ดึงโพสต์ไม่สำเร็จ")
        if old_posts or old.get("error"):
            return
        write_feed({"account": ACCOUNT, "profile": None, "posts": [], "updated": "",
                    "error": " | ".join(errors)[:600]})
        return

    # โพสต์ที่หายไปจากช่วงโพสต์ล่าสุดที่ดึงได้ = บัญชีลบแล้ว ส่วนโพสต์เก่ากว่านั้นคงไว้ (ไม่นับโพสต์ปักหมุด)
    span = [p.get("ts") or 0 for p in window if not p.get("pinned")]
    oldest_ts = min(span) if len(span) >= 3 else None
    newest = dict(found)
    for pid, prev in old_posts.items():
        if pid in newest:
            continue
        if page_complete or (oldest_ts and (prev.get("ts") or 0) >= oldest_ts):
            log(f"โพสต์ {pid} ไม่อยู่ในบัญชีแล้ว")
            continue
        newest[pid] = dict(prev, imageUrls=[])

    posts = [p for p in newest.values() if p["id"] not in hide
             and not any(w in (p.get("caption") or "").lower() for w in words)]
    log(f"เหลือ {len(posts)} โพสต์หลังตัดโพสต์ที่ซ่อนไว้")
    today = datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d")
    same_day = (old.get("profile") or {}).get("day") == today
    for p in posts:
        prev = old_posts.get(p["id"]) or {}
        for k in ("caption", "ts", "alt", "likes", "comments"):
            if p.get(k) in (None, "") and prev.get(k) not in (None, ""):
                p[k] = prev[k]
        # ยอดถูกใจอัปเดตวันละครั้ง จะได้ไม่บันทึกขึ้นเว็บทุกรอบ
        if same_day and prev.get("likes") is not None:
            p["likes"], p["comments"] = prev.get("likes"), prev.get("comments")
    posts.sort(key=lambda p: p.get("ts") or 0, reverse=True)
    posts = posts[:MAX_POSTS]

    out = []
    for p in posts:
        prev = old_posts.get(p["id"]) or {}
        urls = p.get("imageUrls") or []
        n = max(len(urls), len(prev.get("images") or []))
        images = []
        for i in range(n):
            dest = IMG_DIR / (f"{p['id']}.jpg" if i == 0 else f"{p['id']}-{i + 1}.jpg")
            if not dest.exists() and i < len(urls):
                save_image(http, urls[i], dest)
            if dest.exists():
                images.append(f"assets/img/instagram/{dest.name}")
        cw, ch = image_size(ROOT / images[0]) if images else (None, None)
        reel = bool(p.get("reel") or prev.get("reel"))
        out.append({
            "id": p["id"],
            "url": f"https://www.instagram.com/{'reel' if reel else 'p'}/{p['id']}/",
            "kind": p.get("kind") or prev.get("kind") or "image",
            "reel": reel,
            "caption": p.get("caption") or "",
            "date": th_date(p.get("ts")),
            "ts": p.get("ts"),
            "images": images,
            "cw": cw,
            "ch": ch,
            "alt": p.get("alt") or "",
            "likes": p.get("likes"),
            "comments": p.get("comments"),
        })

    # ลบภาพของโพสต์ที่ไม่อยู่ในรายการแล้ว
    keep = {Path(i).name for p in out for i in p["images"]} | {"avatar.jpg"}
    for f in IMG_DIR.glob("*.jpg"):
        if f.name not in keep:
            f.unlink()

    prof = old.get("profile")
    if profile:
        o = old.get("profile") or {}
        avatar = IMG_DIR / "avatar.jpg"
        if not avatar.exists():
            save_image(http, profile.get("avatarUrl"), avatar)
        prof = {k: profile[k] if profile.get(k) is not None else o.get(k) for k in ("name", "bio", "followers", "following", "posts")}
        prof["avatar"] = "assets/img/instagram/avatar.jpg" if avatar.exists() else ""
        prof["day"] = today
        # ยอดผู้ติดตามอัปเดตวันละครั้ง
        if o.get("day") == today and o.get("posts") == prof["posts"]:
            prof["followers"], prof["following"] = o.get("followers"), o.get("following")

    feed = {"account": ACCOUNT, "profile": prof, "posts": out, "via": "+".join(via)}
    if all(old.get(k) == feed[k] for k in ("account", "profile", "posts")) and not old.get("error"):
        log("ข้อมูลเหมือนเดิม ไม่ต้องอัปเดต")
        return
    feed["updated"] = datetime.datetime.now(TZ_TH).isoformat(timespec="minutes")
    write_feed(feed)
    log(f"อัปเดต data/instagram-feed.js แล้ว ({len(out)} โพสต์)")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        warn(f"ดึงโพสต์ Instagram ไม่สำเร็จ: {exc}")
    write_summary()
    sys.exit(0)
