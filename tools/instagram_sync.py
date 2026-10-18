#!/usr/bin/env python3
"""ดึงโพสต์จาก Instagram @green.prot มาไว้ในเว็บคณะสี

GitHub Actions (.github/workflows/instagram-sync.yml) รันไฟล์นี้ทุก 2 ชั่วโมงช่วง 06.00–22.00 น. แล้วบันทึกผลขึ้นเว็บเอง
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

    def cookie(self, name):
        try:
            return self.s.cookies.get(name) if self.s is not None else None
        except Exception:
            return None


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
        return set(), []
    hide = set(re.findall(r'"([A-Za-z0-9_-]{5,20})"\s*:\s*\{[^{}]*?\bhide\s*:\s*true', txt))
    m = re.search(r'hideWords\s*:\s*\[([^\]]*)\]', txt)
    words = [w.lower() for w in re.findall(r'"([^"]+)"', m.group(1))] if m else []
    return hide, words


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
    return {
        "id": sc,
        "caption": caption,
        "ts": to_int(n.get("taken_at_timestamp")),
        "kind": "carousel" if kids else ("video" if n.get("is_video") else "image"),
        "reel": n.get("product_type") == "clips",
        "alt": n.get("accessibility_caption") or "",
        "imageUrls": [u for u in imgs if u][:MAX_IMAGES],
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
def fetch_web_profile(http, host, warm=False):
    headers = dict(API_HEADERS)
    if host.startswith("i."):
        headers["User-Agent"] = MOBILE_UA
    tag = host.split(".")[0] + ("-warm" if warm else "")
    if warm:
        # เปิดหน้าบัญชีก่อนเพื่อรับคุกกี้ แล้วค่อยขอข้อมูล
        st, body = http.get(PROFILE_URL, {"Accept": "text/html,application/xhtml+xml", "Accept-Language": "th-TH,th;q=0.9,en;q=0.8"})
        dump("profile-page", st, body)
        token = http.cookie("csrftoken")
        if token:
            headers["X-CSRFToken"] = token
    st, body = http.get(f"https://{host}/api/v1/users/web_profile_info/?username={ACCOUNT}", headers)
    if st != 200:
        dump(f"web_profile_info-{tag}", st, body)
        raise RuntimeError(f"HTTP {st} {body[:80]!r}")
    user = (json.loads(body).get("data") or {}).get("user")
    if not user:
        dump(f"web_profile_info-{tag}", st, body)
        raise RuntimeError("ไม่พบข้อมูลบัญชีในผลลัพธ์")
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


def fetch_post_embed(http, code):
    # หน้า embed ของโพสต์เดี่ยว เปิดได้โดยไม่ต้องล็อกอิน มีคำบรรยายและภาพ
    st, body = http.get(f"https://www.instagram.com/p/{code}/embed/captioned/", {"Referer": "https://watpolprot-cloud.github.io/"})
    if DEBUG and not (DEBUG_DIR / "post-embed.txt").exists():
        dump("post-embed", st, body)
    if st != 200:
        raise RuntimeError(f"HTTP {st}")
    text = body.decode("utf-8", "replace")
    m = re.search(r'"contextJSON":"((?:\\.|[^"\\])*)"', text)
    if m:
        try:
            ctx = json.loads(json.loads('"' + m.group(1) + '"'))
            media = ((ctx.get("gql_data") or {}).get("shortcode_media")) or ctx.get("media")
            p = from_graph(media or {}) if media else None
            if p:
                return p
        except ValueError:
            pass
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


def fetch_profile_embed(http, known):
    # สำรอง: หน้า embed ของบัญชี มีลิงก์โพสต์ล่าสุด แล้วเปิด embed ของแต่ละโพสต์ที่ยังไม่มี
    st, body = http.get(f"https://www.instagram.com/{ACCOUNT}/embed/", {"Referer": "https://watpolprot-cloud.github.io/"})
    dump("profile-embed", st, body)
    if st != 200:
        raise RuntimeError(f"HTTP {st}")
    # ลิงก์โพสต์อาจอยู่ใน JSON ที่ใส่ \/ แทน / หรืออยู่ในช่อง shortcode
    found = re.findall(rb'\\?/(?:p|reel|tv)\\?/([A-Za-z0-9_-]{10,14})(?![A-Za-z0-9_-])', body)
    found += re.findall(rb'"(?:shortcode|code)"\s*:\s*"([A-Za-z0-9_-]{10,14})"', body)
    codes = list(dict.fromkeys(c.decode() for c in found))
    if not codes:
        raise RuntimeError(f"ไม่พบลิงก์โพสต์ในหน้า embed ({len(body)} ไบต์)")
    posts = []
    for code in codes[:12]:
        if code in known:
            posts.append(dict(known[code], imageUrls=[]))
            continue
        try:
            posts.append(fetch_post_embed(http, code))
        except Exception as exc:
            warn(f"embed โพสต์ {code}: {exc}")
    return posts


def probe(http):
    # โหมดตรวจสาเหตุ: ลองเปิดหน้าอื่น ๆ ของบัญชีแล้วเก็บผลไว้ดู (ไม่ใช้ข้อมูลจริง)
    tries = [
        ("a1", PROFILE_URL + "?__a=1&__d=dis", API_HEADERS),
        ("page-fbhit", PROFILE_URL, {"User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"}),
        ("page-googlebot", PROFILE_URL, {"User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"}),
    ]
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
    http = Http()
    errors = []

    profile, found, via, page_complete = None, [], "", False
    for host, warm in (("www.instagram.com", False), ("i.instagram.com", False), ("www.instagram.com", True)):
        try:
            profile, found, user_id, cursor = fetch_web_profile(http, host, warm)
            via = "web_profile_info@" + host + ("+cookie" if warm else "")
            log(f"{via}: ได้ {len(found)} โพสต์ บัญชีมี {profile['posts']} โพสต์ ผู้ติดตาม {profile['followers']}")
            # ครั้งแรก (หรือยังเก็บไม่ครบ) ดึงหน้าถัดไปด้วย เพื่อเอาโพสต์เก่ามาทั้งหมด
            total = profile.get("posts") or 0
            if cursor and len(old_posts) < min(total, MAX_POSTS):
                try:
                    more = fetch_more(http, user_id, cursor, MAX_POSTS - len(found))
                    found += more
                    log(f"ดึงโพสต์เก่าเพิ่มอีก {len(more)} โพสต์")
                except Exception as exc:
                    errors.append(f"โพสต์เก่า: {exc}")
            page_complete = bool(total) and len(found) >= total
            break
        except Exception as exc:
            errors.append(f"web_profile_info@{host}{'+cookie' if warm else ''}: {exc}")
    if not found:
        try:
            found = fetch_profile_embed(http, old_posts)
            via = "embed"
            log(f"embed: ได้ {len(found)} โพสต์")
        except Exception as exc:
            errors.append(f"embed: {exc}")
    for e in errors:
        warn(e)
    if DEBUG:
        probe(http)

    if not found:
        log("ดึงโพสต์ไม่สำเร็จ")
        if old_posts or old.get("error"):
            return
        write_feed({"account": ACCOUNT, "profile": None, "posts": [], "updated": "",
                    "error": " | ".join(errors)[:600]})
        return

    # โพสต์ที่หายไปจากช่วงเวลาที่ดึงได้ = บัญชีลบแล้ว ส่วนโพสต์เก่ากว่านั้นคงไว้
    newest = {p["id"]: p for p in found}
    oldest_ts = min((p.get("ts") or 0) for p in found)
    for pid, prev in old_posts.items():
        if pid in newest:
            continue
        if page_complete or (prev.get("ts") or 0) >= oldest_ts > 0:
            log(f"โพสต์ {pid} ไม่อยู่ในบัญชีแล้ว")
            continue
        newest[pid] = dict(prev, imageUrls=[])

    hide, words = load_rules()
    posts = [p for p in newest.values() if p["id"] not in hide
             and not any(w in (p.get("caption") or "").lower() for w in words)]
    log(f"เหลือ {len(posts)} โพสต์หลังตัดโพสต์ที่ซ่อนไว้")
    for p in posts:
        prev = old_posts.get(p["id"]) or {}
        for k in ("caption", "ts", "alt"):
            if not p.get(k) and prev.get(k):
                p[k] = prev[k]
    posts.sort(key=lambda p: p.get("ts") or 0, reverse=True)
    posts = posts[:MAX_POSTS]

    IMG_DIR.mkdir(parents=True, exist_ok=True)
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
        kind = p.get("kind") or prev.get("kind") or "image"
        out.append({
            "id": p["id"],
            "url": f"https://www.instagram.com/{'reel' if p.get('reel') else 'p'}/{p['id']}/",
            "kind": kind,
            "reel": bool(p.get("reel")),
            "caption": p.get("caption") or "",
            "date": th_date(p.get("ts")),
            "ts": p.get("ts"),
            "images": images,
            "cw": cw,
            "ch": ch,
            "alt": p.get("alt") or "",
        })

    # ลบภาพของโพสต์ที่ไม่อยู่ในรายการแล้ว
    keep = {Path(i).name for p in out for i in p["images"]} | {"avatar.jpg"}
    for f in IMG_DIR.glob("*.jpg"):
        if f.name not in keep:
            f.unlink()

    today = datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d")
    prof = old.get("profile")
    if profile:
        avatar = IMG_DIR / "avatar.jpg"
        if not avatar.exists():
            save_image(http, profile.get("avatarUrl"), avatar)
        prof = {k: profile[k] for k in ("name", "bio", "followers", "following", "posts")}
        prof["avatar"] = "assets/img/instagram/avatar.jpg" if avatar.exists() else ""
        prof["day"] = today
        # ยอดผู้ติดตามอัปเดตวันละครั้ง จะได้ไม่บันทึกขึ้นเว็บทุกรอบ
        o = old.get("profile") or {}
        if o.get("day") == today and o.get("posts") == prof["posts"]:
            prof["followers"], prof["following"] = o.get("followers"), o.get("following")

    feed = {"account": ACCOUNT, "profile": prof, "posts": out, "via": via}
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
