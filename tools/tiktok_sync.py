#!/usr/bin/env python3
"""ดึงรายการคลิปจาก TikTok @kradangnga.prot มาไว้ในเว็บคณะสี

GitHub Actions (.github/workflows/tiktok-sync.yml) รันไฟล์นี้วันละ 2 ครั้ง แล้วบันทึกผลขึ้นเว็บเอง
- รายการคลิป ยอดดู และข้อมูลช่อง -> data/tiktok-feed.js (ไฟล์นี้สร้างอัตโนมัติ ห้ามแก้ด้วยมือ)
- ภาพปกคลิป -> assets/img/tiktok/<เลขคลิป>.jpg และรูปโปรไฟล์ -> assets/img/tiktok/avatar.jpg
ถ้าจะตั้งหมวดหรือเขียนชื่อเรื่อง/คำอธิบายคลิปเพิ่ม ให้แก้ data/tiktok.js

ถ้าดึงจาก TikTok ไม่สำเร็จ จะคงข้อมูลเดิมไว้ ไม่ลบคลิปที่เคยขึ้นเว็บ
ต้องใช้: pip install "yt-dlp[default,curl-cffi]" pillow
"""
import datetime
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACCOUNT = "kradangnga.prot"
PROFILE_URL = f"https://www.tiktok.com/@{ACCOUNT}"
FEED = ROOT / "data" / "tiktok-feed.js"
IMG_DIR = ROOT / "assets" / "img" / "tiktok"
MAX_CLIPS = 60
COVER_WIDTH = 480
TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
HEADER = ("/* สร้างอัตโนมัติโดย tools/tiktok_sync.py (GitHub Actions ดึงจาก TikTok วันละ 2 ครั้ง)\n"
          "   ห้ามแก้ไฟล์นี้ด้วยมือ ถ้าจะตั้งหมวดหรือเขียนคำอธิบายคลิปเพิ่ม ให้แก้ data/tiktok.js */\n")


def log(msg):
    print(msg, flush=True)


def warn(msg):
    # ขึ้นเป็นคำเตือนในหน้าผลการรันของ GitHub Actions
    print(f"::warning::{msg}", flush=True)


def http_get(url, referer=None):
    headers = {"Referer": referer} if referer else {}
    try:
        from curl_cffi import requests as creq
        r = creq.get(url, impersonate="chrome", headers=headers, timeout=30)
        return r.status_code, r.content
    except ImportError:
        req = urllib.request.Request(url, headers={"User-Agent": UA, **headers})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read()


def load_old():
    try:
        txt = FEED.read_text("utf-8")
        start = txt.index("{", txt.index("KD.tiktokFeed"))
        return json.loads(txt[start:txt.rindex("}") + 1])
    except (OSError, ValueError):
        return {}


def to_int(x):
    try:
        return int(x)
    except (TypeError, ValueError):
        return None


def th_date(ts):
    return datetime.datetime.fromtimestamp(ts, TZ_TH).strftime("%Y-%m-%d") if ts else ""


def script_json(html, script_id):
    m = re.search(rb'<script[^>]+id="' + script_id.encode() + rb'"[^>]*>(.*?)</script>', html, re.S)
    return json.loads(m.group(1)) if m else None


# ---------- ข้อมูลช่อง ----------
def fetch_profile():
    status, body = http_get(PROFILE_URL)
    data = script_json(body, "__UNIVERSAL_DATA_FOR_REHYDRATION__")
    info = (((data or {}).get("__DEFAULT_SCOPE__") or {}).get("webapp.user-detail") or {}).get("userInfo") or {}
    user = info.get("user") or {}
    stats = info.get("statsV2") or info.get("stats") or {}
    if not user:
        raise RuntimeError(f"ไม่พบข้อมูลช่องในหน้าโปรไฟล์ (HTTP {status})")
    return {
        "name": user.get("nickname") or "",
        "bio": user.get("signature") or "",
        "avatarUrl": user.get("avatarLarger") or user.get("avatarMedium") or "",
        "followers": to_int(stats.get("followerCount")),
        "likes": to_int(stats.get("heartCount") or stats.get("heart")),
        "videos": to_int(stats.get("videoCount")),
    }


# ---------- รายการคลิป ----------
def fetch_with_ytdlp():
    import yt_dlp
    opts = {"quiet": True, "no_warnings": True, "skip_download": True,
            "extract_flat": "in_playlist", "playlistend": MAX_CLIPS}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(PROFILE_URL, download=False)
    clips = []
    for e in info.get("entries") or []:
        if not e or not e.get("id"):
            continue
        thumbs = {t.get("id"): t.get("url") for t in e.get("thumbnails") or [] if t.get("url")}
        clips.append({
            "id": str(e["id"]),
            "desc": e.get("description") or e.get("title") or "",
            "ts": to_int(e.get("timestamp")),
            "dur": to_int(e.get("duration")),
            "views": to_int(e.get("view_count")),
            "likes": to_int(e.get("like_count")),
            "comments": to_int(e.get("comment_count")),
            "shares": to_int(e.get("repost_count")),
            "music": e.get("track") or "",
            "coverUrl": thumbs.get("cover") or thumbs.get("originCover") or thumbs.get("thumbnail") or "",
        })
    return clips


def fetch_with_embed():
    # สำรอง: หน้า embed ของช่อง มีรายการคลิปล่าสุดพร้อมภาพปก
    status, body = http_get(f"https://www.tiktok.com/embed/@{ACCOUNT}")
    data = script_json(body, "__FRONTITY_CONNECT_STATE__") or {}
    page = ((data.get("source") or {}).get("data") or {}).get(f"/embed/@{ACCOUNT}") or {}
    clips = []
    for v in page.get("videoList") or []:
        vid = str(v.get("id") or "")
        if not vid:
            continue
        clips.append({
            "id": vid,
            "desc": v.get("desc") or v.get("description") or v.get("title") or "",
            "ts": to_int(v.get("createTime")),
            "dur": to_int(v.get("duration")),
            "views": to_int(v.get("playCount")),
            "likes": to_int(v.get("diggCount")),
            "comments": to_int(v.get("commentCount")),
            "shares": to_int(v.get("shareCount")),
            "music": "",
            "coverUrl": v.get("coverUrl") or v.get("cover") or v.get("originCover") or "",
        })
    if not clips:
        raise RuntimeError(f"หน้า embed ไม่มีรายการคลิป (HTTP {status})")
    return clips


# ---------- ภาพ ----------
def save_image(url, dest, width):
    from PIL import Image
    if not url:
        return False
    try:
        status, body = http_get(url, referer="https://www.tiktok.com/")
        if status != 200 or not body:
            return False
        im = Image.open(io.BytesIO(body)).convert("RGB")
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "JPEG", quality=82, optimize=True, progressive=True)
        return True
    except Exception as exc:  # ภาพเดียวพังไม่ควรทำให้ทั้งรอบล้ม
        warn(f"บันทึกภาพ {dest.name} ไม่สำเร็จ: {exc}")
        return False


def write_feed(feed):
    FEED.write_text(HEADER + "window.KD = window.KD || {};\nKD.tiktokFeed = "
                    + json.dumps(feed, ensure_ascii=False, indent=1) + ";\n", "utf-8")


def main():
    old = load_old()
    old_clips = {c["id"]: c for c in old.get("videos") or []}
    errors = []

    profile = None
    try:
        profile = fetch_profile()
        log(f"ช่อง: {profile['name']} ผู้ติดตาม {profile['followers']} คลิป {profile['videos']}")
    except Exception as exc:
        errors.append(f"ข้อมูลช่อง: {exc}")

    clips = []
    for name, fn in (("yt-dlp", fetch_with_ytdlp), ("embed", fetch_with_embed)):
        try:
            clips = fn()
            log(f"ดึงคลิปด้วย {name} ได้ {len(clips)} คลิป")
            if clips:
                break
        except Exception as exc:
            errors.append(f"{name}: {exc}")

    for e in errors:
        warn(e)

    if not clips:
        if old_clips:
            log("ดึงคลิปไม่สำเร็จ คงข้อมูลเดิมไว้")
            return
        if old.get("error"):
            return
        # ยังไม่เคยดึงสำเร็จ: บันทึกสาเหตุไว้ให้ตรวจ
        write_feed({"account": ACCOUNT, "profile": None, "videos": [], "updated": "",
                    "error": " | ".join(errors)[:600]})
        return

    # คลิปเดิมที่วิธีสำรองให้ข้อมูลไม่ครบ ใช้ค่าเดิมเติม
    for c in clips:
        prev = old_clips.get(c["id"]) or {}
        for k in ("desc", "ts", "dur", "music"):
            if not c.get(k) and prev.get(k):
                c[k] = prev[k]
    clips.sort(key=lambda c: c.get("ts") or 0, reverse=True)
    clips = clips[:MAX_CLIPS]

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    videos = []
    for c in clips:
        cover = IMG_DIR / f"{c['id']}.jpg"
        if not cover.exists():
            save_image(c.get("coverUrl"), cover, COVER_WIDTH)
        videos.append({
            "id": c["id"],
            "url": f"{PROFILE_URL}/video/{c['id']}",
            "desc": c.get("desc") or "",
            "date": th_date(c.get("ts")),
            "ts": c.get("ts"),
            "dur": c.get("dur"),
            "views": c.get("views"),
            "likes": c.get("likes"),
            "comments": c.get("comments"),
            "shares": c.get("shares"),
            "music": c.get("music") or "",
            "cover": f"assets/img/tiktok/{c['id']}.jpg" if cover.exists() else "",
        })

    # ลบภาพปกของคลิปที่ไม่อยู่ในรายการแล้ว (เช่น ช่องลบคลิป)
    keep = {f"{v['id']}.jpg" for v in videos} | {"avatar.jpg"}
    for f in IMG_DIR.glob("*.jpg"):
        if f.name not in keep:
            f.unlink()

    prof = None
    if profile:
        avatar = IMG_DIR / "avatar.jpg"
        if not avatar.exists():
            save_image(profile.get("avatarUrl"), avatar, 300)
        prof = {k: profile[k] for k in ("name", "bio", "followers", "likes", "videos")}
        prof["avatar"] = "assets/img/tiktok/avatar.jpg" if avatar.exists() else ""
    elif old.get("profile"):
        prof = old["profile"]

    feed = {"account": ACCOUNT, "profile": prof, "videos": videos}
    if all(old.get(k) == feed[k] for k in feed) and not old.get("error"):
        log("ข้อมูลเหมือนเดิม ไม่ต้องอัปเดต")
        return
    feed["updated"] = datetime.datetime.now(TZ_TH).isoformat(timespec="minutes")
    write_feed(feed)
    log(f"อัปเดต data/tiktok-feed.js แล้ว ({len(videos)} คลิป)")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        warn(f"ดึงคลิป TikTok ไม่สำเร็จ: {exc}")
        sys.exit(0)
