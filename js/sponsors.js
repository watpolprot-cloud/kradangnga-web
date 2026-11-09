// การ์ดผู้สนับสนุน (ข้อมูลใน data/sponsors.js) ใช้ทั้งหน้าแรก (#sponsors) และหน้า sponsors.html
(function () {
  const list = KD.sponsors || [], sec = document.getElementById("sponsors") || document.getElementById("sponsors-page");
  if (!list.length) return;
  sec.hidden = false;
  const box = document.getElementById("sponsor-list");
  // ข้อความในช่อง message: {{1:คำ}} ถึง {{4:คำ}} = ไฮไลต์คำสำคัญ 4 สี (เขียว ทอง ชมพู ม่วง)
  const fmt = t => esc(t).replace(/\{\{([1-4]):(.+?)\}\}/g, (m, c, w) => `<mark class="mk${c}">${w}</mark>`);
  // [[ข้อความ]] = กลุ่มคำที่ไม่ให้ตัดขึ้นบรรทัดใหม่กลางคำ เช่น ชื่อ-สกุลครู (ใช้ได้ในช่อง by, note, facts, thanksText, message.title, message.photoCap)
  const nb = t => esc(t).replace(/\[\[(.+?)\]\]/g, '<span class="sp-nw">$1</span>');
  const plain = t => String(t || "").replace(/\[\[|\]\]/g, "");
  // ชื่อบนการ์ด: แต่ละคำ (ชื่อ นามสกุล) และวงเล็บท้ายชื่อไม่ตัดกลางคำ เช่น ไชย|ปัญญา บนจอมือถือ
  const nameHtml = n => {
    const m = String(n || "").match(/^(.*?)(?: (\([^)]*\)))?$/);
    return m[1].split(" ").map(w => `<span class="sp-nw">${esc(w)}</span>`).join(" ") + (m[2] ? ` <span class="sp-nw">${esc(m[2])}</span>` : "");
  };
  const msgBlock = (s, k) => {
    const m = s.message;
    return `<div class="sp-msg">
        ${m.photo ? `<button type="button" class="sp-msg-photo" data-k="${k}"><img src="assets/img/sponsors/${esc(m.photo)}" alt="${esc(plain(m.photoCap) || s.name)}" loading="lazy">${m.photoCap ? `<span>${nb(m.photoCap)}</span>` : ""}</button>` : ""}
        <blockquote class="sp-letter">
          ${m.from ? `<div class="sp-l-from">${esc(m.from)}</div>` : ""}
          ${m.title ? `<h4>${nb(m.title)}</h4>` : ""}
          ${(m.paras || []).map(p => `<p>${fmt(p)}</p>`).join("")}
          ${m.big || m.cheer ? `<p class="sp-l-end">${m.big ? `<b>${esc(m.big)}</b>` : ""}${m.cheer ? `<span>${esc(m.cheer)}</span>` : ""}</p>` : ""}
          ${m.sign ? `<footer>— ${esc(m.sign)}</footer>` : ""}
        </blockquote>
      </div>`;
  };
  box.innerHTML = list.map((s, k) => {
    const q = encodeURIComponent(s.geo || s.map || s.name);
    const nav = s.geo ? `https://www.google.com/maps/dir/?api=1&destination=${s.geo}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
    const row = (label, val) => val ? `<li><b>${label}</b><span>${nb(val)}</span></li>` : "";
    const hasMap = s.map || s.geo;
    const side = hasMap ? `<div class="sp-map"><iframe title="แผนที่${esc(s.name)}" src="https://www.google.com/maps?q=${q}&z=17&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`
      : s.story ? `<button type="button" class="sp-story" data-k="${k}"><img src="assets/img/sponsors/${esc(s.story.img)}" alt="${esc(s.story.title)}" loading="lazy"><span><b>${esc(s.story.title)}</b>${esc(s.story.text || "")}</span></button>` : "";
    return `
    <article class="sponsor reveal"${s.id ? ` id="sp-${esc(s.id)}"` : ""}>
      <div class="sp-top">
        <div class="sponsor-logo"${s.logoBg ? ` style="background:${esc(s.logoBg)}"` : ""}><img src="assets/img/sponsors/${esc(s.logo)}" alt="โลโก้${esc(s.name)}" loading="lazy"${s.logoBg ? ` style="object-fit:contain"` : ""}></div>
        <div class="sponsor-body">
          <div class="sp-kind">${esc(s.kind || "ผู้สนับสนุน")}</div>
          <h3>${nameHtml(s.name)}</h3>
          ${s.amount ? `<div class="sp-amount">ร่วมสนับสนุน <b>${esc(s.amount)}</b></div>` : ""}
          ${s.by ? `<p class="sp-by">${nb(s.by)}</p>` : ""}
          ${s.note ? `<p>${nb(s.note)}</p>` : ""}
          ${s.slogan ? `<p class="sp-slogan">“${esc(s.slogan)}”</p>` : ""}
          <div class="sp-actions">
            ${s.tel ? `<a class="btn btn-gold" href="tel:${esc(s.tel.replace(/-/g, ""))}">${esc(s.telLabel || "โทรสั่ง")} ${esc(s.tel)}</a>` : ""}
            ${s.line ? `<a class="btn btn-lineapp" href="https://line.me/R/ti/p/${esc(s.line)}" target="_blank" rel="noopener">แอด LINE ${esc(s.line)}</a>` : ""}
            ${hasMap ? `<a class="btn btn-green" href="${nav}" target="_blank" rel="noopener">นำทางไปร้าน</a>` : ""}
            ${s.facebook ? `<a class="btn btn-outline" href="${esc(s.facebook)}" target="_blank" rel="noopener">เพจ Facebook</a>` : ""}
            ${s.delivery ? `<a class="btn btn-outline" href="${esc(s.delivery)}" target="_blank" rel="noopener">สั่งเดลิเวอรี LINE MAN</a>` : ""}
            ${(s.links || []).map((l, i) => l.img ? `<button type="button" class="btn ${i ? "btn-outline" : "btn-gold"} sp-open" data-k="${k}" data-i="${i}">${esc(l.text)}</button>`
              : `<a class="btn ${i ? "btn-outline" : "btn-gold"}" href="${esc(l.href)}"${/^https?:/.test(l.href) ? ' target="_blank" rel="noopener"' : ""}>${esc(l.text)}</a>`).join("")}
          </div>
        </div>
      </div>
      ${s.message ? msgBlock(s, k) : ""}
      ${s.photos && s.photos.length ?`<div class="sp-photos">${s.photos.map((p, i) => `<button type="button" data-k="${k}" data-i="${i}"><img src="assets/img/sponsors/${esc(p.src)}" alt="${esc(p.cap || s.name)}" loading="lazy"><span>${esc(p.cap || "")}</span></button>`).join("")}</div>` : ""}
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
              <p>${nb(s.thanksText || `ขอบพระคุณ${s.name}ที่ร่วมเป็นกำลังใจให้นักเรียนสีเขียว ฝากครู นักเรียน และผู้ปกครองแวะไปอุดหนุนกันนะครับ`)}</p>
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
  // ภาพข้างข้อความ: กดดูภาพใหญ่ (ช่อง message.full ถ้ามี) ต่อด้วยภาพอื่นในช่อง message.more
  box.querySelectorAll(".sp-msg-photo").forEach(b => b.onclick = () => {
    const m = list[+b.dataset.k].message;
    openLightbox([{ src: "assets/img/sponsors/" + (m.full || m.photo), cap: plain(m.photoCap) }].concat((m.more || []).map(p => ({ src: "assets/img/sponsors/" + p.src, cap: p.cap }))), 0);
  });
  // ปุ่มเปิดภาพ (ช่อง links ที่มี img เช่น ภาพ info ขอบคุณ)
  box.querySelectorAll(".sp-open").forEach(b => b.onclick = () => {
    const l = list[+b.dataset.k].links[+b.dataset.i];
    openLightbox([{ src: l.img, cap: l.cap || l.text }], 0);
  });
  // ลิงก์ตรงถึงการ์ด เช่น sponsors.html#sp-neo-water (การ์ดสร้างด้วย JS เบราว์เซอร์จึงเลื่อนเองไม่ได้)
  const target = location.hash.startsWith("#sp-") && document.getElementById(location.hash.slice(1));
  if (target) setTimeout(() => target.scrollIntoView(), 300);
  else if (location.hash === "#sponsors" && sec.id === "sponsors") setTimeout(() => sec.scrollIntoView(), 300);
})();
