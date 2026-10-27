// ส่วนที่ใช้ร่วมกันทุกหน้า: เมนู ส่วนท้าย แถบประกาศด่วน แชตบอต ภาพขยาย (lightbox) และตัวช่วยจัดรูปแบบวันที่
(function () {
  const PAGES = [
    ["index.html", "หน้าแรก"],
    ["news.html", "ข่าวสาร"],
    ["gallery.html", "ภาพกิจกรรม"],
    ["tiktok.html", "TikTok"],
    ["instagram.html", "Instagram"],
    ["memories.html", "ความทรงจำ"],
    ["teachers.html", "ทำเนียบครู"],
    ["duty.html", "เวรประจำจุด"],
    ["students.html", "ทำเนียบนักเรียน"],
    ["games.html", "บุนนาคเกมส์ 2569"],
    ["schedule.html", "ตารางแข่ง"],
    ["progress.html", "ความก้าวหน้าฝ่ายงาน"]
  ];
  const here = (location.pathname.split("/").pop() || "index.html");
  const S = (window.KD && KD.site) || {};

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="wrap">
      <a class="brand" href="index.html">
        <img src="assets/img/logo.png" alt="ตราโรงเรียนพรตพิทยพยัต">
        <span class="brand-text"><b>คณะสีกระดังงา</b><small>สีเขียว · ${S.school || "โรงเรียนพรตพิทยพยัต"}</small></span>
      </a>
      <button class="menu-btn" aria-expanded="false" aria-controls="main-nav">เมนู</button>
      <nav class="nav" id="main-nav">
        ${PAGES.map(([h, t]) => `<a href="${h}"${h === here ? ' class="active" aria-current="page"' : ""}>${t}</a>`).join("")}
      </nav>
    </div>`;
  document.body.prepend(header);
  const btn = header.querySelector(".menu-btn"), nav = header.querySelector(".nav");
  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", open);
  });

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="wrap">
      <div class="foot-brand">
        <img src="assets/img/logo.png" alt="">
        <div>
          <h4>คณะสีกระดังงา (สีเขียว)</h4>
          <div>${S.school || ""} · ${S.year || ""}</div>
          <div>ธีมบุนนาคเกมส์ 2569: ${S.theme || ""}</div>
        </div>
      </div>
      <div>
        <h4>เมนู</h4>
        ${PAGES.slice(1).map(([h, t]) => `<div><a href="${h}">${t}</a></div>`).join("")}
      </div>
      <div>
        <h4>ติดตามคณะสี</h4>
        <div>TikTok: <a href="${S.tiktok || "#"}" target="_blank" rel="noopener">${S.tiktokName || ""}</a></div>
        <div>Instagram: <a href="${S.instagram || "#"}" target="_blank" rel="noopener">${S.instagramName || ""}</a></div>
        <div><a href="tiktok.html">ดูคลิป</a> · <a href="instagram.html">ดูโพสต์ IG</a> ในเว็บ</div>
        <div style="margin-top:10px">${(S.motto || []).join("<br>")}</div>
      </div>
      <div class="copy">เว็บไซต์ของครูและนักเรียนคณะสีกระดังงา · ปรับปรุงล่าสุด <span id="last-update">${S.updated || ""}</span></div>
    </div>`;
  document.body.append(footer);
  // วันเวลาที่กด Push ครั้งล่าสุด (บอท GitHub Actions เขียนลง data/last-update.json ทุกครั้งที่ Push)
  fetch("data/last-update.json?t=" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => {
    const m = j && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(j.updated || "");
    if (!m) return;
    footer.querySelector("#last-update").textContent = `${+m[3]} ${TH_MONTHS[m[2] - 1]} ${+m[1] + 543} เวลา ${m[4]}.${m[5]} น.`;
  }).catch(() => {});

  // ---------- ตัวช่วย ----------
  const TH_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const TH_MONTHS_S = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  window.thDate = function (iso, short) {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} ${(short ? TH_MONTHS_S : TH_MONTHS)[m - 1]} ${y + 543}`;
  };
  window.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Lightbox ----------
  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.innerHTML = `<button class="lb-btn lb-close" aria-label="ปิด">×</button>
    <button class="lb-btn lb-prev" aria-label="ภาพก่อนหน้า">‹</button>
    <img alt=""><button class="lb-btn lb-next" aria-label="ภาพถัดไป">›</button><div class="lb-cap"></div>`;
  document.body.append(lb);
  let list = [], idx = 0;
  const img = lb.querySelector("img"), cap = lb.querySelector(".lb-cap");
  function show() { img.src = list[idx].src; cap.textContent = list[idx].cap || `${idx + 1} / ${list.length}`; }
  window.openLightbox = function (items, i) {
    list = items; idx = i || 0; show();
    lb.querySelectorAll(".lb-prev, .lb-next").forEach(b => b.hidden = list.length < 2);  // ภาพเดียวไม่ต้องมีปุ่มเลื่อน
    lb.classList.add("open"); document.body.style.overflow = "hidden";
  };
  function close() { lb.classList.remove("open"); document.body.style.overflow = ""; }
  lb.querySelector(".lb-close").onclick = close;
  lb.querySelector(".lb-prev").onclick = e => { e.stopPropagation(); idx = (idx - 1 + list.length) % list.length; show(); };
  lb.querySelector(".lb-next").onclick = e => { e.stopPropagation(); idx = (idx + 1) % list.length; show(); };
  lb.addEventListener("click", e => { if (e.target === lb) close(); });
  document.addEventListener("keydown", e => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") lb.querySelector(".lb-prev").click();
    if (e.key === "ArrowRight") lb.querySelector(".lb-next").click();
  });

  // ---------- Reveal on scroll ----------
  window.revealAll = function () {
    const els = document.querySelectorAll(".reveal:not(.in)");
    if (!("IntersectionObserver" in window)) { els.forEach(e => e.classList.add("in")); return; }
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: .08 });
    els.forEach(e => io.observe(e));
  };
  document.addEventListener("DOMContentLoaded", () => window.revealAll());

  // ---------- แถบประกาศด่วนจาก Instagram (ทุกหน้า) ----------
  // หน้าไหนยังไม่ได้โหลดข้อมูล Instagram จะโหลดให้เอง แล้วแสดงแถบใต้เมนูถ้ามีโพสต์ด่วน
  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = fail;
      document.head.append(s);
    });
  }
  async function urgentBar() {
    window.KD = window.KD || {};
    try {
      if (!KD.instagram) await loadScript("data/instagram.js");
      if (!KD.instagramFeed) await loadScript("data/instagram-feed.js");
      if (!window.KDI) await loadScript("js/instagram.js");
      KDI.renderUrgentBar(header);
    } catch (e) { /* ไม่มีข้อมูล Instagram ก็ไม่ต้องแสดงแถบ */ }
  }
  document.addEventListener("DOMContentLoaded", urgentBar);

  // ---------- แชตบอตน้องกระดังงา มุมขวาล่าง (ทุกหน้า) ----------
  async function chatbot() {
    window.KD = window.KD || {};
    try {
      if (!KD.chatbot) await loadScript("data/chatbot.js");
      if (!window.KDC) await loadScript("js/chatbot.js");
      KDC.mount();
    } catch (e) { /* โหลดแชตบอตไม่ได้ก็ใช้เว็บได้ตามปกติ */ }
  }
  document.addEventListener("DOMContentLoaded", chatbot);
})();
