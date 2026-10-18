// ส่วนที่ใช้ร่วมกันทุกหน้า: เมนู ส่วนท้าย ภาพขยาย (lightbox) และตัวช่วยจัดรูปแบบวันที่
(function () {
  const PAGES = [
    ["index.html", "หน้าแรก"],
    ["news.html", "ข่าวสาร"],
    ["gallery.html", "ภาพกิจกรรม"],
    ["tiktok.html", "คลิป TikTok"],
    ["memories.html", "ความทรงจำ"],
    ["teachers.html", "ทำเนียบครู"],
    ["students.html", "ทำเนียบนักเรียน"],
    ["games.html", "บุนนาคเกมส์ 2569"]
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
        <div><a href="tiktok.html">ดูคลิปทั้งหมดในเว็บ</a></div>
        <div style="margin-top:10px">${(S.motto || []).join("<br>")}</div>
      </div>
      <div class="copy">เว็บไซต์ของครูและนักเรียนคณะสีกระดังงา · ปรับปรุงล่าสุด ${S.updated || ""}</div>
    </div>`;
  document.body.append(footer);

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
})();
