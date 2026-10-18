// ตัวช่วยคลิป TikTok: รวมรายการที่ดึงอัตโนมัติ (data/tiktok-feed.js) กับหมวดและคำอธิบายที่เขียนเอง (data/tiktok.js)
// ใช้ในหน้าแรกและหน้า tiktok.html ต้องโหลดหลัง js/common.js
(function () {
  const C = (window.KD && KD.tiktok) || { categories: [], clips: {} };
  const F = (window.KD && KD.tiktokFeed) || { videos: [] };
  const S = (window.KD && KD.site) || {};
  const account = C.account || F.account || "kradangnga.prot";
  const profileUrl = S.tiktok || `https://www.tiktok.com/@${account}`;
  const cats = C.categories || [];
  const fallbackCat = (cats.find(c => c.fallback) || cats[cats.length - 1] || {}).key;
  const extraOf = id => (C.clips && C.clips[id]) || {};
  const hideWords = (C.hideWords || []).map(w => w.toLowerCase());

  function splitTags(desc) {
    const tags = desc.match(/#[^\s#]+/g) || [];
    return { text: desc.replace(/#[^\s#]+/g, " ").replace(/[ \t]+/g, " ").trim(), tags };
  }
  function shortTitle(text) {
    const line = (text.split(/\n/).find(l => l.trim()) || "").trim();
    return line.length > 70 ? line.slice(0, 68).trim() + "…" : line;
  }
  function pickCat(v, extra) {
    if (extra.cat && cats.some(c => c.key === extra.cat)) return extra.cat;
    const hay = (v.desc || "").toLowerCase();
    const hit = cats.find(c => (c.words || []).some(w => hay.includes(w.toLowerCase())));
    return hit ? hit.key : fallbackCat;
  }

  const videos = (F.videos || []).map(v => {
    const extra = extraOf(v.id), parts = splitTags(v.desc || "");
    return Object.assign({}, v, {
      text: parts.text, tags: parts.tags,
      title: extra.title || shortTitle(parts.text) || "คลิปคณะสีกระดังงา",
      note: extra.note || "", cat: pickCat(v, extra),
      hide: !!extra.hide || hideWords.some(w => (v.desc || "").toLowerCase().includes(w))
    });
  }).filter(v => !v.hide);
  const byId = id => videos.find(v => v.id === id);
  const catOf = key => cats.find(c => c.key === key) || { key, name: "คลิป" };
  const featured = byId(C.featured) || videos[0] || null;
  const heroPicks = (C.hero || []).map(byId).filter(v => v && v !== featured);

  function fmtNum(n) {
    if (n == null) return "";
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
    return String(n);
  }
  const fmtDur = s => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "";
  const dateOf = v => v.date ? thDate(v.date, true) : "";

  // ภาพปกที่ไม่ใช่แนวตั้ง (เช่น โพสต์ภาพนิ่ง) แสดงเต็มภาพบนพื้นเบลอ ไม่ตัดขอบ
  const isWide = v => v.cw && v.ch && v.ch / v.cw < 1.5;
  function coverHtml(v, cls) {
    const img = !v.cover ? `<span class="tt-nocover">กระดังงา</span>`
      : isWide(v) ? `<img class="tt-bg" src="${esc(v.cover)}" alt="" loading="lazy"><img class="tt-fg" src="${esc(v.cover)}" alt="" loading="lazy">`
      : `<img src="${esc(v.cover)}" alt="" loading="lazy">`;
    return `<span class="${cls || "tt-cover"}${isWide(v) ? " fit" : ""}">
      ${img}
      <span class="tt-play" aria-hidden="true"></span>
      ${v.dur ? `<span class="tt-dur">${fmtDur(v.dur)}</span>` : ""}
      ${v.views != null ? `<span class="tt-views">ดู ${fmtNum(v.views)} ครั้ง</span>` : ""}
    </span>`;
  }
  function cardHtml(v) {
    return `<button type="button" class="tt-card reveal" data-tt="${esc(v.id)}" aria-label="เล่นคลิป ${esc(v.title)}">
      ${coverHtml(v)}
      <span class="tt-cap"><b>${esc(v.title)}</b><small>${esc(catOf(v.cat).name)}${v.date ? " · " + dateOf(v) : ""}</small></span>
    </button>`;
  }
  function bindCards(root) {
    root.querySelectorAll("[data-tt]").forEach(el => el.addEventListener("click", () => openPlayer(el.dataset.tt)));
  }

  // ---------- หน้าต่างเล่นคลิป ----------
  const playerSrc = id => `https://www.tiktok.com/player/v1/${encodeURIComponent(id)}?autoplay=1&rel=0&music_info=1&description=0`;
  let modal = null;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "tt-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `<div class="tt-modal-box">
      <button class="lb-btn tt-close" aria-label="ปิด">×</button>
      <div class="tt-frame"></div>
      <div class="tt-info"></div>
    </div>`;
    document.body.append(modal);
    modal.querySelector(".tt-close").onclick = closePlayer;
    modal.addEventListener("click", e => { if (e.target === modal) closePlayer(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && modal.classList.contains("open")) closePlayer(); });
    return modal;
  }
  function infoHtml(v) {
    const stats = [["ดู", v.views], ["ถูกใจ", v.likes], ["คอมเมนต์", v.comments], ["แชร์", v.shares]]
      .filter(s => s[1] != null).map(s => `<span><b>${fmtNum(s[1])}</b>${s[0]}</span>`).join("");
    return `<span class="tag">${esc(catOf(v.cat).name)}</span>
      <h3>${esc(v.title)}</h3>
      ${v.date ? `<div class="tt-date">โพสต์ ${thDate(v.date)}</div>` : ""}
      ${v.note ? `<p class="tt-note">${esc(v.note)}</p>` : ""}
      ${v.text && v.text !== v.title ? `<p class="tt-text">${esc(v.text)}</p>` : ""}
      ${v.tags.length ? `<div class="tt-tags">${v.tags.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
      ${stats ? `<div class="tt-stat-row">${stats}</div>` : ""}
      ${v.music ? `<div class="tt-music">เพลง: ${esc(v.music)}</div>` : ""}
      <a class="btn btn-gold" href="${esc(v.url)}" target="_blank" rel="noopener">เปิดใน TikTok</a>`;
  }
  function openPlayer(id) {
    const v = byId(id);
    if (!v) return;
    const m = ensureModal();
    m.querySelector(".tt-frame").style.backgroundImage = v.cover ? `url("${v.cover}")` : "";
    m.querySelector(".tt-frame").innerHTML = `<iframe src="${playerSrc(v.id)}" title="${esc(v.title)}"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    m.querySelector(".tt-info").innerHTML = infoHtml(v);
    m.classList.add("open");
    document.body.style.overflow = "hidden";
    m.querySelector(".tt-close").focus();
  }
  function closePlayer() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.querySelector(".tt-frame").innerHTML = "";
    document.body.style.overflow = "";
  }

  // ---------- หน้าโปรไฟล์ TikTok ฉบับฝัง (TikTok แสดงคลิปล่าสุดให้เอง) ----------
  function embedCreator(el) {
    el.innerHTML = `<blockquote class="tiktok-embed" cite="${esc(profileUrl)}" data-unique-id="${esc(account)}"
      data-embed-type="creator" style="max-width:780px;min-width:288px;margin:0 auto">
      <section><a target="_blank" rel="noopener" href="${esc(profileUrl)}?refer=creator_embed">@${esc(account)}</a></section></blockquote>`;
    const load = () => {
      if (document.querySelector('script[src="https://www.tiktok.com/embed.js"]')) return;
      const s = document.createElement("script");
      s.src = "https://www.tiktok.com/embed.js";
      s.async = true;
      document.body.append(s);
    };
    if (!("IntersectionObserver" in window)) return load();
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: "300px" });
    io.observe(el);
  }

  window.KDT = {
    account, profileUrl, videos, featured, heroPicks, categories: cats, catOf, byId,
    profile: F.profile || null, updated: F.updated || "",
    fmtNum, fmtDur, dateOf, coverHtml, cardHtml, bindCards, infoHtml, openPlayer, playerSrc, embedCreator
  };
})();
