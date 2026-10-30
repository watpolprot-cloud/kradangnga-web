// การ์ดผู้สนับสนุน (ข้อมูลใน data/sponsors.js) ใช้ทั้งหน้าแรก (#sponsors) และหน้า sponsors.html
(function () {
  const list = KD.sponsors || [], sec = document.getElementById("sponsors") || document.getElementById("sponsors-page");
  if (!list.length) return;
  sec.hidden = false;
  const box = document.getElementById("sponsor-list");
  box.innerHTML = list.map((s, k) => {
    const q = encodeURIComponent(s.geo || s.map || s.name);
    const nav = s.geo ? `https://www.google.com/maps/dir/?api=1&destination=${s.geo}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
    const row = (label, val) => val ? `<li><b>${label}</b><span>${esc(val)}</span></li>` : "";
    const hasMap = s.map || s.geo;
    const side = hasMap ? `<div class="sp-map"><iframe title="แผนที่${esc(s.name)}" src="https://www.google.com/maps?q=${q}&z=17&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`
      : s.story ? `<button type="button" class="sp-story" data-k="${k}"><img src="assets/img/sponsors/${esc(s.story.img)}" alt="${esc(s.story.title)}" loading="lazy"><span><b>${esc(s.story.title)}</b>${esc(s.story.text || "")}</span></button>` : "";
    return `
    <article class="sponsor reveal"${s.id ? ` id="sp-${esc(s.id)}"` : ""}>
      <div class="sp-top">
        <div class="sponsor-logo"${s.logoBg ? ` style="background:${esc(s.logoBg)}"` : ""}><img src="assets/img/sponsors/${esc(s.logo)}" alt="โลโก้${esc(s.name)}" loading="lazy"${s.logoBg ? ` style="object-fit:contain"` : ""}></div>
        <div class="sponsor-body">
          <div class="sp-kind">${esc(s.kind || "ผู้สนับสนุน")}</div>
          <h3>${esc(s.name)}</h3>
          ${s.amount ? `<div class="sp-amount">ร่วมสนับสนุน <b>${esc(s.amount)}</b></div>` : ""}
          ${s.by ? `<p class="sp-by">${esc(s.by)}</p>` : ""}
          ${s.note ? `<p>${esc(s.note)}</p>` : ""}
          ${s.slogan ? `<p class="sp-slogan">“${esc(s.slogan)}”</p>` : ""}
          <div class="sp-actions">
            ${s.tel ? `<a class="btn btn-gold" href="tel:${esc(s.tel.replace(/-/g, ""))}">${esc(s.telLabel || "โทรสั่ง")} ${esc(s.tel)}</a>` : ""}
            ${s.line ? `<a class="btn btn-lineapp" href="https://line.me/R/ti/p/${esc(s.line)}" target="_blank" rel="noopener">แอด LINE ${esc(s.line)}</a>` : ""}
            ${hasMap ? `<a class="btn btn-green" href="${nav}" target="_blank" rel="noopener">นำทางไปร้าน</a>` : ""}
            ${s.facebook ? `<a class="btn btn-outline" href="${esc(s.facebook)}" target="_blank" rel="noopener">เพจ Facebook</a>` : ""}
            ${s.delivery ? `<a class="btn btn-outline" href="${esc(s.delivery)}" target="_blank" rel="noopener">สั่งเดลิเวอรี LINE MAN</a>` : ""}
          </div>
        </div>
      </div>
      ${s.photos && s.photos.length ? `<div class="sp-photos">${s.photos.map((p, i) => `<button type="button" data-k="${k}" data-i="${i}"><img src="assets/img/sponsors/${esc(p.src)}" alt="${esc(p.cap || s.name)}" loading="lazy"><span>${esc(p.cap || "")}</span></button>`).join("")}</div>` : ""}
      ${s.menuTable ? `<div class="sp-menuwrap">
        <div>
          <h4>เมนูและราคา</h4>
          <div class="sp-mtable">${s.menuTable.map(g => `<div class="sp-mgroup"><h5>${esc(g.title)}</h5><ul>${g.items.map(it => `<li><span>${esc(it[0])}</span><i></i><b>${esc(it[1])}</b></li>`).join("")}</ul></div>`).join("")}</div>
          ${s.menuNote ? `<p class="sp-mnote">${esc(s.menuNote)}</p>` : ""}
          ${s.menu && s.menu.length ? `<h4>เมนูเด่นอื่น ๆ</h4><div class="sp-menu">${s.menu.map(m => `<span>${esc(m)}</span>`).join("")}</div>` : ""}
        </div>
        ${s.menuImage ? `<button type="button" class="sp-menuimg" data-k="${k}"><img src="assets/img/sponsors/${esc(s.menuImage)}" alt="ใบเมนู${esc(s.name)}" loading="lazy"><span>กดดูใบเมนูขนาดใหญ่</span></button>` : ""}
      </div>` : ""}
      ${s.highlights || s.poster ? `<div class="sp-menuwrap">
        <div>
          <h4>จุดเด่นของ${esc(s.name.replace(/\s*\(.*\)$/, ""))}</h4>
          <div class="sp-hl">${(s.highlights || []).map(h => `<div><b>${esc(h.t)}</b><span>${esc(h.d)}</span></div>`).join("")}</div>
        </div>
        ${s.poster ? `<button type="button" class="sp-menuimg sp-poster" data-k="${k}"><img src="assets/img/sponsors/${esc(s.poster)}" alt="${esc(s.posterCap || s.name)}" loading="lazy"><span>กดดูภาพขนาดใหญ่</span></button>` : ""}
      </div>` : ""}
      <div class="sp-info${side ? "" : " one"}">
        <div>
          <h4>${esc(s.infoTitle || "ข้อมูลร้านและช่องทางสั่ง")}</h4>
          <ul class="sp-list">
            ${row("บริการ", s.service)}${row("เวลาเปิด", s.hours)}${row("ราคา", s.price)}${(s.facts || []).map(f => row(f[0], f[1])).join("")}${row("ที่อยู่", s.address)}${row(s.telLabel || "โทรสั่ง", s.tel)}
          </ul>
          <div class="sp-thanks">
            <img src="assets/img/sponsors/${esc(s.thanksImage || s.logo)}" alt="" loading="lazy">
            <div>
              <b>จากใจคณะสีกระดังงา (สีเขียว)</b>
              <p>${esc(s.thanksText || `ขอบพระคุณ${s.name}ที่ร่วมเป็นกำลังใจให้นักเรียนสีเขียว ฝากครู นักเรียน และผู้ปกครองแวะไปอุดหนุนกันนะครับ`)}</p>
              <small>ครูไชยพงศ์ ปานมีศรี หัวหน้าคณะสีกระดังงา (สีเขียว)</small>
            </div>
          </div>
        </div>
        ${side}
      </div>
    </article>`;
  }).join("");
  box.querySelectorAll(".sp-photos button").forEach(b => b.onclick = () => {
    const s = list[+b.dataset.k];
    openLightbox(s.photos.map(p => ({ src: "assets/img/sponsors/" + p.src, cap: p.cap })), +b.dataset.i);
  });
  box.querySelectorAll(".sp-menuimg").forEach(b => b.onclick = () => {
    const s = list[+b.dataset.k];
    openLightbox([b.classList.contains("sp-poster") ? { src: "assets/img/sponsors/" + s.poster, cap: s.posterCap || s.name }
      : { src: "assets/img/sponsors/" + s.menuImage, cap: "ใบเมนู" + s.name }], 0);
  });
  box.querySelectorAll(".sp-story").forEach(b => b.onclick = () => {
    const s = list[+b.dataset.k];
    openLightbox([{ src: "assets/img/sponsors/" + s.story.img, cap: s.story.title + " · " + (s.story.text || "") }], 0);
  });
  // ลิงก์ตรงถึงการ์ด เช่น sponsors.html#sp-neo-water (การ์ดสร้างด้วย JS เบราว์เซอร์จึงเลื่อนเองไม่ได้)
  const target = location.hash.startsWith("#sp-") && document.getElementById(location.hash.slice(1));
  if (target) setTimeout(() => target.scrollIntoView(), 300);
  else if (location.hash === "#sponsors" && sec.id === "sponsors") setTimeout(() => sec.scrollIntoView(), 300);
})();
