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
    return `
    <article class="sponsor reveal">
      <div class="sp-top">
        <div class="sponsor-logo"><img src="assets/img/sponsors/${esc(s.logo)}" alt="โลโก้${esc(s.name)}" loading="lazy"></div>
        <div class="sponsor-body">
          <div class="sp-kind">${esc(s.kind || "ผู้สนับสนุน")}</div>
          <h3>${esc(s.name)}</h3>
          ${s.amount ? `<div class="sp-amount">ร่วมสนับสนุน <b>${esc(s.amount)}</b></div>` : ""}
          ${s.note ? `<p>${esc(s.note)}</p>` : ""}
          ${s.slogan ? `<p class="sp-slogan">“${esc(s.slogan)}”</p>` : ""}
          <div class="sp-actions">
            ${s.tel ? `<a class="btn btn-gold" href="tel:${esc(s.tel.replace(/-/g, ""))}">โทรสั่ง ${esc(s.tel)}</a>` : ""}
            ${s.map || s.geo ? `<a class="btn btn-green" href="${nav}" target="_blank" rel="noopener">นำทางไปร้าน</a>` : ""}
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
      <div class="sp-info">
        <div>
          <h4>ข้อมูลร้านและช่องทางสั่ง</h4>
          <ul class="sp-list">
            ${row("บริการ", s.service)}${row("เวลาเปิด", s.hours)}${row("ราคา", s.price)}${row("ที่อยู่", s.address)}${row("โทรสั่ง", s.tel)}
          </ul>
          <div class="sp-thanks">
            <img src="assets/img/sponsors/${esc(s.thanksImage || s.logo)}" alt="" loading="lazy">
            <div>
              <b>จากใจคณะสีกระดังงา (สีเขียว)</b>
              <p>ขอบพระคุณ${esc(s.name)}ที่ร่วมเป็นกำลังใจให้นักเรียนสีเขียว ฝากครู นักเรียน และผู้ปกครองแวะไปอุดหนุนกันนะครับ</p>
              <small>ครูไชยพงศ์ ปานมีศรี หัวหน้าคณะสีกระดังงา (สีเขียว)</small>
            </div>
          </div>
        </div>
        ${s.map || s.geo ? `<div class="sp-map"><iframe title="แผนที่${esc(s.name)}" src="https://www.google.com/maps?q=${q}&z=17&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : ""}
      </div>
    </article>`;
  }).join("");
  box.querySelectorAll(".sp-photos button").forEach(b => b.onclick = () => {
    const s = list[+b.dataset.k];
    openLightbox(s.photos.map(p => ({ src: "assets/img/sponsors/" + p.src, cap: p.cap })), +b.dataset.i);
  });
  box.querySelectorAll(".sp-menuimg").forEach(b => b.onclick = () => {
    const s = list[+b.dataset.k];
    openLightbox([{ src: "assets/img/sponsors/" + s.menuImage, cap: "ใบเมนู" + s.name }], 0);
  });
  if (location.hash === "#sponsors" && sec.id === "sponsors") setTimeout(() => sec.scrollIntoView(), 300);
})();
