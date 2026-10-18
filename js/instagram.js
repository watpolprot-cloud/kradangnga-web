// ตัวช่วยโพสต์ Instagram: รวมโพสต์ที่ดึงอัตโนมัติ (data/instagram-feed.js) กับหมวดและคำอธิบายที่เขียนเอง (data/instagram.js)
// ใช้ในหน้าแรก หน้า instagram.html หน้าข่าวสาร และแถบประกาศด่วนทุกหน้า ต้องโหลดหลัง js/common.js
(function () {
  const C = (window.KD && KD.instagram) || { categories: [], posts: {} };
  const F = (window.KD && KD.instagramFeed) || { posts: [] };
  const account = C.account || F.account || "green.prot";
  const profileUrl = `https://www.instagram.com/${account}/`;
  const cats = C.categories || [];
  const fallbackCat = (cats.find(c => c.fallback) || cats[cats.length - 1] || {}).key;
  const extraOf = id => (C.posts && C.posts[id]) || {};
  const hideWords = (C.hideWords || []).map(w => w.toLowerCase());
  const U = C.urgent || {};
  const urgentWords = (U.words || []).map(w => w.toLowerCase());
  const DAY = 86400000;

  // คำบรรยายใน IG ของคณะสีส่วนใหญ่เป็นอีโมจิกับแฮชแท็ก จึงแยกแฮชแท็กออก และตัดอีโมจิออกตอนทำชื่อเรื่อง
  function splitTags(caption) {
    const tags = caption.match(/#[^\s#]+/g) || [];
    return { text: caption.replace(/#[^\s#]+/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(), tags };
  }
  const noEmoji = s => s.replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]/gu, "").replace(/\s+/g, " ").trim();
  function shortTitle(text) {
    const line = noEmoji((text.split(/\n/).find(l => noEmoji(l)) || ""));
    return line.length > 70 ? line.slice(0, 68).trim() + "…" : line;
  }
  const kindName = p => p.kind === "video" ? "คลิปจาก Instagram" : p.kind === "carousel" ? "อัลบั้มภาพจาก Instagram" : "ภาพจาก Instagram";
  function pickCat(p, extra) {
    if (extra.cat && cats.some(c => c.key === extra.cat)) return extra.cat;
    const hay = (p.caption || "").toLowerCase();
    const hit = cats.find(c => (c.words || []).some(w => hay.includes(w.toLowerCase())));
    return hit ? hit.key : fallbackCat;
  }
  const todayIso = () => {
    const d = new Date(Date.now() + 7 * 3600000);   // วันที่ตามเวลาไทย
    return d.toISOString().slice(0, 10);
  };
  function isUrgent(p, extra) {
    if (extra.urgent === false) return false;
    if (extra.urgent === true) return !extra.until || todayIso() <= extra.until;
    if (!p.ts || Date.now() - p.ts * 1000 > (U.days || 3) * DAY) return false;
    const hay = (p.caption || "").toLowerCase();
    return urgentWords.some(w => hay.includes(w));
  }

  const posts = (F.posts || []).map(p => {
    const extra = extraOf(p.id), parts = splitTags(p.caption || "");
    return Object.assign({}, p, {
      text: parts.text, tags: parts.tags,
      title: extra.title || shortTitle(parts.text) || kindName(p),
      note: extra.note || "", cat: pickCat(p, extra),
      urgent: isUrgent(p, extra),
      hide: !!extra.hide || hideWords.some(w => (p.caption || "").toLowerCase().includes(w))
    });
  }).filter(p => !p.hide && p.images && p.images.length);
  const byId = id => posts.find(p => p.id === id);
  const catOf = key => cats.find(c => c.key === key) || { key, name: "โพสต์" };
  const urgentPosts = posts.filter(p => p.urgent);
  const P = F.profile || null;

  function fmtNum(n) {
    if (n == null) return "";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e4) return (n / 1e3).toFixed(0) + "K";
    return n.toLocaleString("th-TH");
  }
  const dateOf = p => p.date ? thDate(p.date, true) : "";

  // ---------- การ์ดโพสต์ ----------
  const ICON_MULTI = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="14" height="14" rx="3"/><path d="M17 21H6a3 3 0 0 1-3-3V7"/></svg>`;
  const ICON_PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>`;
  const ICON_HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.2-9.4C1.7 7.3 4 4 7.4 4c2 0 3.6 1.1 4.6 2.7C13 5.1 14.6 4 16.6 4 20 4 22.3 7.3 21.2 10.6 19.5 15.4 12 20 12 20z"/></svg>`;
  function thumbHtml(p) {
    const wide = p.cw && p.ch && p.cw > p.ch;
    const img = wide
      ? `<img class="ig-bg" src="${esc(p.images[0])}" alt="" loading="lazy"><img class="ig-fg" src="${esc(p.images[0])}" alt="" loading="lazy">`
      : `<img src="${esc(p.images[0])}" alt="${esc(p.alt || p.title)}" loading="lazy">`;
    return `<span class="ig-thumb${wide ? " fit" : ""}">${img}
      ${p.urgent ? `<span class="ig-urgent-tag">ด่วน</span>` : ""}
      ${p.kind === "video" ? `<span class="ig-kind" title="คลิป">${ICON_PLAY}</span>`
        : p.images.length > 1 || p.kind === "carousel" ? `<span class="ig-kind" title="หลายภาพ">${ICON_MULTI}</span>` : ""}
      ${p.likes ? `<span class="ig-likes">${ICON_HEART}${fmtNum(p.likes)}</span>` : ""}
    </span>`;
  }
  function cardHtml(p) {
    return `<button type="button" class="ig-card reveal" data-ig="${esc(p.id)}" aria-label="ดูโพสต์ ${esc(p.title)}">
      ${thumbHtml(p)}
      <span class="ig-cap"><b>${esc(p.title)}</b><small>${esc(catOf(p.cat).name)}${p.date ? " · " + dateOf(p) : ""}</small></span>
    </button>`;
  }
  function bindCards(root) {
    root.querySelectorAll("[data-ig]").forEach(el => el.addEventListener("click", () => openPost(el.dataset.ig)));
  }

  // ---------- หน้าต่างดูโพสต์ ----------
  let modal = null, cur = null, slide = 0;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "ig-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `<div class="ig-modal-box">
      <button class="lb-btn ig-close" aria-label="ปิด">×</button>
      <div class="ig-media"></div>
      <div class="ig-info"></div>
    </div>`;
    document.body.append(modal);
    modal.querySelector(".ig-close").onclick = closePost;
    modal.addEventListener("click", e => { if (e.target === modal) closePost(); });
    document.addEventListener("keydown", e => {
      if (!modal.classList.contains("open")) return;
      if (e.key === "Escape") closePost();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    });
    return modal;
  }
  // คลิปเล่นผ่านหน้า embed ของ Instagram ส่วนภาพใช้ไฟล์ที่เก็บไว้ในเว็บ
  const embedSrc = p => `https://www.instagram.com/${p.reel ? "reel" : "p"}/${encodeURIComponent(p.id)}/embed/`;
  function mediaHtml(p) {
    if (p.kind === "video") {
      const wide = p.cw && p.ch && p.cw > p.ch;   // คลิปแนวนอนไม่ต้องสูงเต็มจอ
      return `<div class="ig-video${wide ? " wide" : ""}" style="background-image:url('${esc(p.images[0])}')${wide ? `;--ar:${(p.cw / p.ch).toFixed(3)}` : ""}">
        <iframe src="${embedSrc(p)}" title="${esc(p.title)}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    }
    const many = p.images.length > 1;
    return `<div class="ig-slides">${p.images.map((src, i) => `<img src="${esc(src)}" alt="${esc(p.alt || p.title)}"${i === slide ? "" : " hidden"}>`).join("")}
      ${many ? `<button class="lb-btn ig-prev" aria-label="ภาพก่อนหน้า">‹</button><button class="lb-btn ig-next" aria-label="ภาพถัดไป">›</button>
      <div class="ig-dots">${p.images.map((_, i) => `<span${i === slide ? ' class="on"' : ""}></span>`).join("")}</div>` : ""}</div>`;
  }
  function go(step) {
    if (!cur || cur.kind === "video" || cur.images.length < 2) return;
    slide = (slide + step + cur.images.length) % cur.images.length;
    modal.querySelectorAll(".ig-slides img").forEach((im, i) => im.hidden = i !== slide);
    modal.querySelectorAll(".ig-dots span").forEach((d, i) => d.classList.toggle("on", i === slide));
  }
  function infoHtml(p) {
    const stats = [["ถูกใจ", p.likes], ["คอมเมนต์", p.comments]].filter(s => s[1])
      .map(s => `<span><b>${fmtNum(s[1])}</b>${s[0]}</span>`).join("");
    return `<div class="ig-who"><img src="${esc((P && P.avatar) || "assets/img/logo.png")}" alt=""><span><b>@${esc(account)}</b><small>${esc((P && P.name) || "คณะสีกระดังงา")}</small></span></div>
      <div class="ig-tags-row">${p.urgent ? `<span class="tag ig-tag-urgent">ประกาศด่วน</span>` : ""}<span class="tag">${esc(catOf(p.cat).name)}</span></div>
      <h3>${esc(p.title)}</h3>
      ${p.date ? `<div class="tt-date">โพสต์ ${thDate(p.date)}</div>` : ""}
      ${p.note ? `<p class="tt-note">${esc(p.note)}</p>` : ""}
      ${p.text && noEmoji(p.text) && p.text !== p.title ? `<p class="tt-text">${esc(p.text)}</p>` : ""}
      ${p.tags.length ? `<div class="tt-tags">${p.tags.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
      ${stats ? `<div class="tt-stat-row">${stats}</div>` : ""}
      <a class="btn btn-gold" href="${esc(p.url)}" target="_blank" rel="noopener">เปิดใน Instagram</a>`;
  }
  function openPost(id) {
    const p = byId(id);
    if (!p) return;
    const m = ensureModal();
    cur = p; slide = 0;
    m.querySelector(".ig-modal-box").classList.toggle("is-video", p.kind === "video");
    m.querySelector(".ig-media").innerHTML = mediaHtml(p);
    m.querySelector(".ig-info").innerHTML = infoHtml(p);
    const prev = m.querySelector(".ig-prev"), next = m.querySelector(".ig-next");
    if (prev) { prev.onclick = () => go(-1); next.onclick = () => go(1); }
    m.classList.add("open");
    document.body.style.overflow = "hidden";
    m.querySelector(".ig-close").focus();
  }
  function closePost() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.querySelector(".ig-media").innerHTML = "";
    document.body.style.overflow = "";
  }

  // ---------- แถบประกาศด่วน (ใต้เมนูทุกหน้า) ----------
  const DISMISS_KEY = "kd-urgent-closed";
  function readClosed() {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveClosed(list) {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(list.slice(-30))); } catch (e) {}
  }
  function renderUrgentBar(header) {
    const closed = readClosed();
    const list = urgentPosts.filter(p => !closed.includes(p.id)).slice(0, 3);
    if (!list.length || document.querySelector(".urgent-bar")) return;
    const bar = document.createElement("div");
    bar.className = "urgent-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "ประกาศด่วน");
    bar.innerHTML = list.map(p => `<div class="wrap urgent-row" data-id="${esc(p.id)}">
      <span class="urgent-pill"><i></i>ประกาศด่วน</span>
      <img src="${esc(p.images[0])}" alt="">
      <span class="urgent-text"><b>${esc(p.title)}</b><small>จาก Instagram @${esc(account)}${p.date ? " · " + dateOf(p) : ""}</small></span>
      <button type="button" class="urgent-open">ดูประกาศ</button>
      <button type="button" class="urgent-x" aria-label="ปิดประกาศนี้">×</button>
    </div>`).join("");
    (header || document.body.firstChild).after(bar);
    bar.querySelectorAll(".urgent-row").forEach(row => {
      const id = row.dataset.id;
      row.querySelector(".urgent-open").onclick = () => openPost(id);
      row.querySelector("img").onclick = () => openPost(id);
      row.querySelector(".urgent-x").onclick = () => {
        saveClosed(readClosed().concat(id));
        row.remove();
        if (!bar.querySelector(".urgent-row")) bar.remove();
      };
    });
  }

  window.KDI = {
    account, profileUrl, posts, urgentPosts, profile: P, categories: cats, catOf, byId,
    total: (P && P.posts) || posts.length, updated: F.updated || "",
    fmtNum, dateOf, cardHtml, thumbHtml, bindCards, openPost, renderUrgentBar
  };
})();
