// แชตบอต "น้องกระดังงา" ปุ่มมุมขวาล่างของทุกหน้า (js/common.js โหลดไฟล์นี้ให้เอง)
// ถามตอบด้วย Gemini ผ่านตัวกลางใน Google Apps Script (KD.chatbot.endpoint)
// ถ้ายังไม่ได้ตั้งตัวกลาง ต่อไม่ได้ หรือโควตาเต็ม จะค้นหาเรื่องในเว็บจาก data/chatbot-knowledge.json ให้แทน
(function () {
  const C = (window.KD && KD.chatbot) || {};
  const NAME = C.name || "น้องกระดังงา";
  const STORE = "kd-chat";
  const MAX_KEEP = 30, MAX_SEND = 12, MAX_LEN = 800;
  const FLOWER = "assets/img/kradangnga-flower.svg";
  const esc = window.esc || (s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));

  let msgs = load(), busy = false, kbPromise = null, root, list, input, sendBtn, sugBox;

  function load() {
    try { const v = JSON.parse(sessionStorage.getItem(STORE) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-MAX_KEEP))); } catch (e) { /* เก็บไม่ได้ก็ไม่เป็นไร */ }
  }

  // ---------- จัดรูปแบบคำตอบ: ตัวหนา รายการ ลิงก์ไปหน้าในเว็บ ----------
  function safeUrl(u) {
    u = u.replace(/&amp;/g, "&");
    if (/^[a-z0-9_-]+\.html(#[\w-]+)?$/i.test(u)) return { href: u, ext: false };
    if (/^https:\/\/(www\.)?(instagram\.com|tiktok\.com|watpolprot-cloud\.github\.io)\/[^\s"'<>]*$/i.test(u)) return { href: u, ext: true };
    return null;
  }
  function inline(s) {
    return s
      .replace(/\[([^\]\n]{1,80})\]\(([^)\s]{1,300})\)/g, (m, t, u) => {
        const x = safeUrl(u);
        return x ? `<a href="${esc(x.href)}"${x.ext ? ' target="_blank" rel="noopener"' : ""}>${t}</a>` : t;
      })
      .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,]|$)/g, "$1<i>$2</i>");
  }
  function fmt(text) {
    const lines = esc(text).split("\n");
    let html = "", listTag = "";
    const close = () => { if (listTag) { html += `</${listTag}>`; listTag = ""; } };
    lines.forEach(raw => {
      const l = raw.trim();
      const ul = l.match(/^[-*•]\s+(.*)/), ol = l.match(/^\d+[.)]\s+(.*)/);
      if (ul || ol) {
        const tag = ul ? "ul" : "ol";
        if (listTag !== tag) { close(); html += `<${tag}>`; listTag = tag; }
        html += `<li>${inline((ul || ol)[1])}</li>`;
      } else if (!l) {
        close();
      } else {
        close();
        html += `<p>${inline(l.replace(/^#+\s*/, ""))}</p>`;
      }
    });
    close();
    return html;
  }

  // ---------- หน้าตา ----------
  function build() {
    root = document.createElement("div");
    root.className = "kc";
    root.innerHTML = `
      <div class="kc-hint" hidden><button type="button" class="kc-hint-x" aria-label="ปิดข้อความ">×</button>มีอะไรให้ช่วยไหมคะ ถามน้องกระดังงาได้เลย</div>
      <button type="button" class="kc-launch" aria-label="เปิดแชตถาม${esc(NAME)}" aria-expanded="false">
        <span class="kc-launch-ring"></span>
        <img class="kc-launch-flower" src="${FLOWER}" alt="">
        <span class="kc-launch-dot"></span>
      </button>
      <section class="kc-panel" role="dialog" aria-label="แชตกับ${esc(NAME)}" hidden>
        <header class="kc-head">
          <span class="kc-ava"><img src="${FLOWER}" alt=""></span>
          <div class="kc-title"><b>${esc(NAME)}</b><small><i class="kc-status"></i><span class="kc-mode"></span></small></div>
          <button type="button" class="kc-icon kc-reset" aria-label="เริ่มคุยใหม่" title="เริ่มคุยใหม่">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>
          </button>
          <button type="button" class="kc-icon kc-close" aria-label="ปิดแชต">×</button>
        </header>
        <div class="kc-list" aria-live="polite"></div>
        <div class="kc-sugs"></div>
        <form class="kc-form">
          <textarea class="kc-input" rows="1" maxlength="${MAX_LEN}" placeholder="พิมพ์คำถามถึง${esc(NAME)}..." aria-label="พิมพ์คำถาม"></textarea>
          <button type="submit" class="kc-send" aria-label="ส่งคำถาม">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>
          </button>
        </form>
        <p class="kc-foot">${esc(NAME)}เป็น AI อาจตอบคลาดเคลื่อนได้ เรื่องสำคัญโปรดตรวจกับครูคณะสีอีกครั้ง และอย่าพิมพ์ข้อมูลส่วนตัว</p>
      </section>`;
    document.body.append(root);
    list = root.querySelector(".kc-list");
    input = root.querySelector(".kc-input");
    sendBtn = root.querySelector(".kc-send");
    sugBox = root.querySelector(".kc-sugs");
    root.querySelector(".kc-mode").textContent = C.endpoint ? (C.tagline || "ผู้ช่วยตอบคำถามคณะสีเขียว") : "ค้นหาเรื่องในเว็บให้";

    const launch = root.querySelector(".kc-launch");
    launch.addEventListener("click", () => toggle());
    root.querySelector(".kc-close").addEventListener("click", () => toggle(false));
    root.querySelector(".kc-reset").addEventListener("click", reset);
    root.querySelector(".kc-hint-x").addEventListener("click", e => { e.stopPropagation(); hideHint(); });
    root.querySelector(".kc-hint").addEventListener("click", () => { hideHint(); toggle(true); });
    root.querySelector(".kc-form").addEventListener("submit", e => { e.preventDefault(); send(input.value); });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
    });
    input.addEventListener("input", grow);
    sugBox.addEventListener("click", e => { const b = e.target.closest("button"); if (b) send(b.textContent); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && isOpen()) toggle(false); });

    // ข้อความชวนคุย ขึ้นครั้งเดียวต่อการเปิดเว็บ
    let seen = false;
    try { seen = sessionStorage.getItem("kd-chat-hint") === "1"; } catch (e) {}
    if (!seen && !msgs.length) setTimeout(() => { if (!isOpen()) root.querySelector(".kc-hint").hidden = false; }, 2500);
    setTimeout(hideHint, 14000);
  }
  function hideHint() {
    if (!root) return;
    root.querySelector(".kc-hint").hidden = true;
    try { sessionStorage.setItem("kd-chat-hint", "1"); } catch (e) {}
  }
  function isOpen() { return root && !root.querySelector(".kc-panel").hidden; }
  function toggle(open) {
    const panel = root.querySelector(".kc-panel"), launch = root.querySelector(".kc-launch");
    open = open == null ? panel.hidden : open;
    panel.hidden = !open;
    root.classList.toggle("open", open);
    launch.setAttribute("aria-expanded", open);
    document.documentElement.classList.toggle("kc-lock", open);
    if (open) {
      hideHint();
      render();
      if (!C.endpoint) knowledge();
      setTimeout(() => input.focus({ preventScroll: true }), 50);
    }
  }
  function grow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 112) + "px";
  }

  function bubble(m) {
    const bot = m.role === "bot";
    return `<div class="kc-msg ${bot ? "kc-bot" : "kc-me"}${m.err ? " kc-err" : ""}">
      ${bot ? `<span class="kc-ava kc-ava-s"><img src="${FLOWER}" alt=""></span>` : ""}
      <div class="kc-bub">${bot ? fmt(m.text) : `<p>${esc(m.text).replace(/\n/g, "<br>")}</p>`}</div></div>`;
  }
  function render() {
    const greet = { role: "bot", text: C.greeting || `สวัสดีค่ะ ${NAME}ยินดีช่วยตอบคำถามเรื่องคณะสีกระดังงาค่ะ` };
    list.innerHTML = [greet].concat(msgs).map(bubble).join("") +
      (busy ? `<div class="kc-msg kc-bot"><span class="kc-ava kc-ava-s"><img src="${FLOWER}" alt=""></span><div class="kc-bub kc-typing" aria-label="กำลังพิมพ์"><i></i><i></i><i></i></div></div>` : "");
    const sugs = msgs.length ? [] : (C.suggestions || []);
    sugBox.innerHTML = sugs.map(s => `<button type="button">${esc(s)}</button>`).join("");
    sugBox.hidden = !sugs.length;
    sendBtn.disabled = busy;
    list.scrollTop = list.scrollHeight;
  }
  function reset() {
    msgs = []; save(); render(); input.focus();
  }

  // ---------- ส่งคำถาม ----------
  async function send(text) {
    text = String(text || "").trim().slice(0, MAX_LEN);
    if (!text || busy) return;
    input.value = ""; grow();
    msgs.push({ role: "user", text });
    busy = true; save(); render();
    let reply;
    if (C.endpoint) {
      try {
        const res = await askAI();
        reply = res.ok && res.answer ? { role: "bot", text: res.answer }
          : await searchReply(res.error === "limit" ? "วันนี้มีคนถามเยอะจนเต็มโควตาของผู้ช่วย AI แล้ว น้องกระดังงาเลยค้นในเว็บให้แทนนะคะ" : "ตอนนี้ผู้ช่วย AI ตอบไม่ได้ชั่วคราว น้องกระดังงาเลยค้นในเว็บให้แทนนะคะ", text);
      } catch (e) {
        reply = await searchReply("ตอนนี้เชื่อมต่อผู้ช่วย AI ไม่ได้ น้องกระดังงาเลยค้นในเว็บให้แทนนะคะ", text);
      }
    } else {
      reply = await searchReply("", text);
    }
    msgs.push(reply);
    busy = false; save(); render();
  }
  async function askAI() {
    const ctrl = "AbortController" in window ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), 45000);
    try {
      // ส่งเป็นข้อความธรรมดา (text/plain) เพื่อให้ Apps Script รับได้โดยไม่ติด CORS
      const r = await fetch(C.endpoint, {
        method: "POST",
        body: JSON.stringify({
          messages: msgs.filter(m => !m.local && !m.err).slice(-MAX_SEND).map(m => ({ role: m.role, text: m.text })),
          page: document.title
        }),
        signal: ctrl ? ctrl.signal : undefined
      });
      return await r.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // ---------- ค้นหาเรื่องในเว็บ (ใช้เมื่อยังไม่มีหรือต่อผู้ช่วย AI ไม่ได้) ----------
  function knowledge() {
    if (!kbPromise) kbPromise = fetch("data/chatbot-knowledge.json").then(r => r.ok ? r.json() : { sections: [] }).catch(() => ({ sections: [] }));
    return kbPromise;
  }
  const STOP = new Set(("ครับ ค่ะ คะ จ้า นะ หน่อย ไหม มั้ย อะไร ยังไง อย่างไร ที่ไหน เมื่อไร เมื่อไหร่ กี่ ใคร คือ เป็น มี ไม่ ได้ และ หรือ ของ ที่ ใน กับ ให้ จะ ก็ แล้ว บ้าง ว่า การ ความ ช่วย บอก อยาก รู้ ถาม หา เรื่อง ตอน นี้ นั้น วัน " +
    "คณะสี สี กระดังงา เขียว สีเขียว").split(" "));
  function words(q) {
    // ห้องเรียนอย่าง ม.2/1 ให้ค้นทั้งคำ
    const rooms = (q.match(/ม\.?\s?\d\s?\/\s?\d+/g) || []).map(r => "ม." + r.replace(/[ม.\s]/g, ""));
    q = q.toLowerCase().replace(/ม\.?\s?\d\s?\/\s?\d+/g, " ").replace(/[?？!.,"'()]/g, " ");
    let out = [];
    if (window.Intl && Intl.Segmenter) {
      for (const s of new Intl.Segmenter("th", { granularity: "word" }).segment(q)) if (s.isWordLike) out.push(s.segment);
    } else {
      out = q.split(/\s+/);
    }
    out = out.filter(w => w.length > 1 && !STOP.has(w));
    // คำติดกันสองคำ ช่วยให้เจอชื่อเรื่องได้แม่นขึ้น
    const pairs = out.slice(1).map((w, i) => out[i] + w);
    return [...new Set(rooms.concat(out, pairs))];
  }
  function count(hay, w) { let n = 0, i = 0; while ((i = hay.indexOf(w, i)) !== -1) { n++; i += w.length; } return n; }
  async function search(q) {
    const kb = await knowledge();
    const ws = words(q);
    if (!ws.length) return [];
    return (kb.sections || []).map(s => {
      const t = s.title.toLowerCase(), x = s.text.toLowerCase();
      let score = 0, hits = 0;
      ws.forEach(w => {
        const a = count(t, w), b = Math.min(count(x, w), 4);
        if (a || b) hits++;
        score += a * 4 + b;
      });
      return { s, score: score * (1 + hits / ws.length) };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(r => {
      // บรรทัดที่ตรงกับคำค้นมากที่สุด
      let line = r.s.text.split("\n")[0], best = 0;
      r.s.text.split("\n").forEach(l => {
        const v = ws.reduce((a, w) => a + (l.toLowerCase().includes(w) ? w.length : 0), 0);
        if (v > best) { best = v; line = l; }
      });
      return { title: r.s.title.replace(/^ข่าว:\s*/, ""), url: r.s.url, snip: line.length > 170 ? line.slice(0, 170) + "…" : line };
    });
  }
  async function searchReply(lead, q) {
    const found = await search(q);
    if (!found.length) return { role: "bot", local: true, text: (lead ? lead + "\n\n" : "") +
      "ยังไม่เจอเรื่องนี้ในเว็บค่ะ ลองถามครูที่ปรึกษาหรือหัวหน้าคณะสี หรือดูประกาศล่าสุดใน [Instagram ของคณะสี](instagram.html) และ [ข่าวสาร](news.html)" };
    return { role: "bot", local: true, text: (lead || "น้องกระดังงาค้นจากเนื้อหาในเว็บให้ค่ะ") + " เจอเรื่องที่น่าจะเกี่ยวข้อง\n\n" +
      found.map(f => `- **${f.title}** ${f.snip}${f.url ? ` [ดูในเว็บ](${f.url})` : ""}`).join("\n") };
  }

  window.KDC = { mount() { if (!root) build(); }, open: () => toggle(true), close: () => toggle(false), _fmt: fmt, _search: search };
})();
