// หน้า "ความก้าวหน้าฝ่ายงาน" (progress.html) — หน้าเดียว 3 มุมมอง: สาธารณะ · เฮดฝ่าย · ครู
// คุยกับตัวกลาง Apps Script (KD.progress.endpoint) ด้วย JSON แบบ text/plain เหมือนน้องกระดังงา เพื่อเลี่ยง CORS preflight
// สิทธิ์ทุกข้อตรวจที่ตัวกลาง หน้าเว็บแค่ซ่อนหรือแสดงปุ่ม · ข้อความจากนักเรียนและบอตแสดงด้วย textContent เท่านั้น
// โหมดทดสอบ: progress.html?mock=1 (ข้อมูลจำลองท้ายไฟล์นี้ รหัส MOCK-SET · MOCK-PARADE · MOCK-TEACHER)
(function () {
  "use strict";
  const C = (window.KD && KD.progress) || {};
  const T = Object.assign({
    notReady: "ระบบยังไม่เปิดใช้งาน", offline: "ต่อระบบไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง",
    privacy: "ครูคณะสีที่มีรหัสอ่านบทสนทนานี้ย้อนหลังได้", loginHint: "รหัสฝ่ายได้จากครูทางแชตส่วนตัว อย่าส่งต่อในกลุ่ม",
    drafting: "กำลังร่างตัวชี้วัด ปกติไม่เกิน 1 ชั่วโมง", awaiting: "รอครูอนุมัติแผน", thinking: "ผู้ช่วยกำลังคิด…"
  }, C.texts || {});
  const MOCK = /[?&]mock=1(&|#|$)/.test(location.search);
  const PFX = MOCK ? "kd-pg-mock-" : "kd-pg-";
  const FLOWER = "assets/img/kradangnga-flower.svg";
  const BOT = C.botName || "ผู้ช่วยวางแผนกระดังงา";
  const REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const app = document.getElementById("pg-app");
  const KIND = { plan: "วางแผน", progress: "รายงานความคืบหน้า", change: "ขอแก้แผน" };
  const COLOR = { red: "เลยกำหนด", yellow: "ใกล้กำหนด", green: "ตามแผน", gray: "ยังไม่มีแผนอนุมัติ" };
  const STATE = { passed: ["ผ่านแล้ว", "green"], overdue: ["เลยกำหนด", "red"], soon: ["ใกล้กำหนด", "yellow"], doing: ["กำลังทำ", "gray"], no_ind: ["ยังไม่มีตัวชี้วัด", "gray"] };
  const PLAN_STATUS = { confirmed: T.drafting, drafting: T.drafting, awaiting_approval: T.awaiting };

  // ---------- เก็บในเครื่อง: token บทบาท ฝ่าย ชื่อผู้คุยล่าสุด ชื่อผู้ตรวจ device_id เท่านั้น (ห้ามเก็บรหัส) ----------
  function sget(k) { try { return localStorage.getItem(PFX + k) || ""; } catch (e) { return ""; } }
  function sset(k, v) { try { if (v) localStorage.setItem(PFX + k, v); else localStorage.removeItem(PFX + k); } catch (e) { /* บางเครื่องปิดไว้ */ } }
  function newDevice() {
    let s = "";
    try { const a = new Uint8Array(16); crypto.getRandomValues(a); s = Array.from(a, b => b.toString(16).padStart(2, "0")).join(""); }
    catch (e) { s = (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 32); }
    sset("device", s);
    return s;
  }
  const S = { token: sget("token"), role: sget("role"), deptId: sget("dept"), reporter: sget("reporter"), reviewer: sget("reviewer"), device: sget("device") || newDevice(), tab: "chat", reporterOk: false, chat: null, today: "" };

  // ---------- ตัวช่วยสร้างหน้า (ข้อความทุกชิ้นเป็น textContent) ----------
  function h(tag, props) {
    const el = document.createElement(tag);
    if (props) Object.keys(props).forEach(k => {
      const v = props[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (typeof v === "boolean" || k === "value") el[k] = v;
      else el.setAttribute(k, v);
    });
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(x => add(el, x)); return; }
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function bar(pct, cls) {
    const b = h("div", { class: "pg-bar " + (cls || ""), role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct) }, h("i"));
    const fill = () => { b.firstChild.style.width = Math.max(0, Math.min(100, pct)) + "%"; };
    if (REDUCED) fill(); else requestAnimationFrame(() => requestAnimationFrame(fill));
    return b;
  }
  function countUp(el, to, suffix) {
    suffix = suffix || "";
    if (REDUCED || !to) { el.textContent = to + suffix; return; }
    const t0 = performance.now(), dur = 1100;
    (function step(t) {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  function badge(text, cls) { return h("span", { class: "pg-badge " + (cls || "") }, text); }
  function btn(text, cls, onclick, extra) { return h("button", Object.assign({ type: "button", class: "pg-btn " + (cls || ""), onclick }, extra || {}), text); }

  // ---------- วันเวลา (เวลาไทย) ----------
  const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const TH_D = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
  function nowMs() { return MOCK ? Mock.now() : Date.now(); }
  function thaiYmd(ms) { return new Date(ms + 7 * 3600000).toISOString().slice(0, 10); }
  function today() { return S.today || thaiYmd(nowMs()); }
  function ymdOk(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }
  function thDay(ymd, withYear) {
    if (!ymdOk(ymd)) return ymd || "-";
    const p = ymd.split("-").map(Number), w = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
    return TH_D[w] + " " + p[2] + " " + TH_M[p[1] - 1] + (withYear ? " " + (p[0] + 543) : "");
  }
  function thDT(iso) {
    const ms = Date.parse(iso || "");
    if (!isFinite(ms)) return "";
    const d = new Date(ms + 7 * 3600000);
    return d.getUTCDate() + " " + TH_M[d.getUTCMonth()] + " " + String(d.getUTCHours()).padStart(2, "0") + "." + String(d.getUTCMinutes()).padStart(2, "0") + " น.";
  }
  function daysBetween(a, b) { const pa = a.split("-").map(Number), pb = b.split("-").map(Number); return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000); }
  function shortName(n) { return String(n || "").replace(/\s+ม\.\d+\/\d+$/, ""); }

  // ---------- เรียกตัวกลาง ----------
  async function api(action, data, ms) {
    const body = Object.assign({ action, device_id: S.device }, S.token ? { token: S.token } : {}, data || {});
    if (MOCK) return Mock.call(body);
    if (!C.endpoint) throw { error: "no_endpoint", message: T.notReady };
    const ctrl = "AbortController" in window ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), ms || 30000);
    let j = null;
    try {
      const r = await fetch(C.endpoint, { method: "POST", body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined });
      j = await r.json();
    } catch (e) {
      throw { error: e && e.name === "AbortError" ? "claude_timeout" : "offline", message: e && e.name === "AbortError" ? "รอนานเกินไป กดส่งใหม่ได้เลย" : T.offline };
    } finally { if (timer) clearTimeout(timer); }
    if (!j || j.ok !== true) {
      const err = j && typeof j === "object" ? j : { error: "offline", message: T.offline };
      if (!err.message) err.message = T.offline;
      if (err.error === "token_expired" && action !== "login") { signOut(err.message); }
      throw err;
    }
    return j;
  }
  function signOut(message) {
    S.token = ""; S.role = ""; S.deptId = ""; S.chat = null; S.reporterOk = false; S.det = null; S.ov = null;
    document.body.classList.remove("pg-in");
    sset("token", ""); sset("role", ""); sset("dept", "");
    renderPublic(message);
  }

  // ---------- ดอกกระดังงาร่วงในหัวหน้า ----------
  function petals() {
    const box = document.querySelector(".pg-petals");
    if (!box || REDUCED) return;
    for (let i = 0; i < 6; i++) {
      const im = h("img", { class: "pg-petal", src: FLOWER, alt: "" });
      im.style.left = (60 + i * 7 + Math.random() * 4) + "%"; // ร่วงทางขวา ไม่ทับหัวข้อ
      im.style.animationDuration = (10 + Math.random() * 7).toFixed(1) + "s";
      im.style.animationDelay = (-Math.random() * 14).toFixed(1) + "s";
      im.style.width = (20 + Math.random() * 14).toFixed(0) + "px";
      box.append(im);
    }
  }

  // ======================================================================
  // มุมมองสาธารณะ
  // ======================================================================
  async function renderPublic(notice) {
    document.body.classList.remove("pg-chatting");
    clear(app);
    const pct = h("span", { class: "pg-pct" }, "0", h("small", null, "%"));
    const cds = h("div", { class: "pg-cds" });
    const total = h("div", { class: "pg-card pg-total" }, h("p", { class: "pg-label" }, "ความก้าวหน้ารวมทั้งคณะสี"), pct, bar(0, "big"), cds,
      h("p", { class: "pg-muted pg-small", style: "margin:12px 0 0" }, "เฉลี่ยจาก 8 ฝ่าย ขยับเมื่อครูตรวจงานจริงและติ๊กผ่านตัวชี้วัดเท่านั้น"));
    const code = h("input", { class: "pg-input", id: "pg-code", name: "code", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", maxlength: "40", placeholder: "เช่น K7RM-Q2XP", "aria-label": "รหัส" });
    const msg = h("div", { class: "pg-err", role: "alert" });
    const go = h("button", { type: "submit", class: "pg-btn gold" }, "เข้าสู่ระบบ");
    const form = h("form", { onsubmit: e => { e.preventDefault(); doLogin(); } }, h("label", { class: "pg-label", for: "pg-code" }, "ใส่รหัสฝ่ายหรือรหัสครู"), code, go, msg);
    const login = h("div", { class: "pg-card pg-login" }, h("h2", null, "เข้าสู่ระบบ"), form,
      h("p", { class: "pg-muted pg-small", style: "margin:10px 0 0" }, T.loginHint), MOCK ? h("p", { class: "pg-notice" }, "รหัสทดสอบ: MOCK-SET (ฝ่ายฉาก) · MOCK-PARADE (ฝ่ายขบวน) · MOCK-TEACHER (ครู)") : null);
    if (notice) login.prepend(h("div", { class: "pg-notice red" }, notice));
    app.append(h("div", { class: "pg-public" }, total, login));
    countdown(cds, C.readyDate, C.eventDate);

    async function doLogin() {
      msg.textContent = "";
      if (!code.value.trim()) { msg.textContent = "พิมพ์รหัสก่อนนะ"; return; }
      go.disabled = true;
      try {
        const r = await api("login", { code: code.value });
        S.token = r.token; S.role = r.role; S.deptId = r.dept ? r.dept.dept_id : "";
        sset("token", r.token); sset("role", r.role); sset("dept", S.deptId);
        S.reporterOk = false; S.chat = null; S.tab = "chat";
        route();
      } catch (e) { msg.textContent = e.message || T.offline; go.disabled = false; }
    }
    if (!MOCK && !C.endpoint) { closed(); return; }
    try {
      const s = await api("public_summary");
      countUp(pct.firstChild, s.overall_pct || 0);
      total.querySelector(".pg-bar > i").style.width = (s.overall_pct || 0) + "%";
      countdown(cds, C.readyDate, C.eventDate, s);
      if (s.updated_at) total.append(h("p", { class: "pg-muted pg-small", style: "margin:6px 0 0" }, "ครูติ๊กล่าสุด " + thDT(s.updated_at)));
    } catch (e) { closed(); }
    function closed() {
      clear(total).append(h("div", { class: "pg-closed" }, T.notReady), h("p", { class: "pg-muted pg-small", style: "text-align:center" }, "ครูกำลังตั้งค่าระบบ เปิดใช้เมื่อไรจะแจ้งในกลุ่มคณะสี"));
      code.disabled = true; go.disabled = true;
    }
  }
  function countdown(box, readyDate, eventDate, s) {
    clear(box);
    const t = today();
    const r = s ? s.days_left_ready : (ymdOk(readyDate) ? Math.max(0, daysBetween(t, readyDate)) : 0);
    const ev = s ? s.days_left : (ymdOk(eventDate) ? Math.max(0, daysBetween(t, eventDate)) : 0);
    box.append(
      h("div", { class: "pg-cd" }, h("b", null, String(r)), h("div", null, h("span", { class: "pg-cdl" }, "วัน ถึงวันพร้อมแสดงเต็มชุด"), h("span", null, thDay(readyDate, true)))),
      h("div", { class: "pg-cd" }, h("b", null, String(ev)), h("div", null, h("span", { class: "pg-cdl" }, "วัน ถึงบุนนาคเกมส์ 2569"), h("span", null, "เริ่ม" + thDay(eventDate, true)))));
  }

  function route() {
    const mb = document.getElementById("pg-mockbar");
    if (mb) mb.hidden = !MOCK;
    document.body.classList.toggle("pg-in", !!S.token);
    if (!S.token) return renderPublic();
    if (S.role === "head") return headView();
    if (S.role === "teacher") return teacherView();
    signOut();
  }
  function loading(el, text) { clear(el).append(h("div", { class: "pg-card pg-loading" }, h("img", { class: "pg-spin", src: FLOWER, alt: "" }), h("span", null, text || "กำลังโหลด…"))); }
  function errorCard(el, e, retry) {
    // มีปุ่มออกเสมอ เช่น ฝ่ายถูกปิดหลังเข้าระบบ (dept_closed) จะได้ไม่ค้างหน้านี้
    clear(el).append(h("div", { class: "pg-card" }, h("div", { class: "pg-notice red" }, (e && e.message) || T.offline),
      h("div", { class: "pg-row" }, retry ? btn("ลองใหม่", "ghost", retry) : null,
        S.token ? btn("ออกแล้วใส่รหัสอื่น", "quiet", async () => { try { await api("logout"); } catch (x) { } signOut(); }) : null)));
  }

  // ======================================================================
  // มุมมองเฮดฝ่าย
  // ======================================================================
  async function headView() {
    loading(app);
    try {
      const res = await Promise.all([api("overview"), api("dept_detail")]);
      S.ov = res[0]; S.det = res[1]; S.today = S.det.today || S.ov.today || "";
    } catch (e) { if (S.token) errorCard(app, e, headView); return; }
    clear(app);
    const d = S.det.dept;
    const pctEl = h("span", { class: "pg-pct" }, "0%");
    const top = h("div", { class: "pg-top" },
      h("div", { class: "pg-topinfo" }, h("div", { class: "pg-muted pg-small" }, "เฮดฝ่าย · ความก้าวหน้าทางการ"), h("h2", null, "ฝ่าย" + d.name),
        h("div", { class: "pg-toppct" }, bar(S.det.official_pct, S.det.color), pctEl, badge(COLOR[S.det.color], S.det.color))),
      btn("ออกแล้วใส่รหัสอื่น", "ghost sm", async () => { try { await api("logout"); } catch (e) { } signOut(); }));
    countUp(pctEl, S.det.official_pct, "%");
    const tabs = h("div", { class: "pg-tabs", role: "tablist" });
    [["chat", ["คุยกับ", "ผู้ช่วย"]], ["plan", ["แผนและ", "ตัวชี้วัด"]], ["all", ["ทุกฝ่าย"]]].forEach(([k, t]) => tabs.append(h("button", { type: "button", role: "tab", class: "pg-tab" + (S.tab === k ? " active" : ""), "aria-selected": String(S.tab === k), "data-tab": k, "aria-label": t.join(""), onclick: () => setTab(k) }, t.map(x => h("span", null, x)))));
    const panel = h("div", { id: "pg-panel" });
    app.append(top, tabs, panel);
    setTab(S.tab);
  }
  function setTab(k) {
    S.tab = k;
    document.querySelectorAll(".pg-tab").forEach(b => { const on = b.getAttribute("data-tab") === k; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
    const panel = document.getElementById("pg-panel");
    if (!panel) return;
    document.body.classList.toggle("pg-chatting", k === "chat");
    if (k === "chat") chatTab(panel);
    else if (k === "plan") planTab(panel);
    else allTab(panel);
  }
  async function refreshDetail() {
    try { S.det = await api("dept_detail"); S.today = S.det.today || S.today; } catch (e) { /* ใช้ข้อมูลเดิม */ }
  }

  // ---------- แท็บทุกฝ่าย: ชื่อ % และสีเท่านั้น ----------
  function allTab(panel) {
    clear(panel);
    const list = h("div", { class: "pg-depts" });
    (S.ov.depts || []).forEach((x, i) => {
      const row = h("div", { class: "pg-dept " + x.color + (x.mine ? " mine" : "") },
        h("div", { class: "pg-dname" }, h("span", { class: "pg-dot " + x.color }), "ฝ่าย" + x.name, x.mine ? badge("ฝ่ายของคุณ", "ink") : null),
        h("div", { class: "pg-pct" }, x.official_pct + "%"), bar(x.official_pct, x.color), h("div", { class: "pg-chips" }, badge(COLOR[x.color], x.color)));
      row.style.animationDelay = (i * 0.05) + "s";
      list.append(row);
    });
    panel.append(h("div", { class: "pg-card" }, h("div", { class: "pg-row between" }, h("h2", null, "ความก้าวหน้าทุกฝ่าย"), h("span", { class: "pg-pct" }, "รวม " + S.ov.overall_pct + "%")),
      legend(), list, h("p", { class: "pg-muted pg-small", style: "margin:12px 0 0" }, "นักเรียนเห็น % ของทุกฝ่าย แต่รายละเอียดเห็นเฉพาะฝ่ายตัวเอง")));
  }
  function legend() {
    return h("div", { class: "pg-legend" }, ["red", "yellow", "green", "gray"].map(c => h("span", null, h("span", { class: "pg-dot " + c }), COLOR[c])));
  }

  // ---------- แท็บแผนและตัวชี้วัด ----------
  function planTab(panel) {
    clear(panel);
    const det = S.det, out = [];
    if (det.pending) out.push(h("div", { class: "pg-notice" }, h("b", null, "แผนฉบับที่ " + det.pending.version + ": "), PLAN_STATUS[det.pending.status] || det.pending.status,
      det.pending.status === "awaiting_approval" ? " (ครูนพพล ครูไชยพงศ์ หรือครูธนิษฐา อนุมัติได้)" : ""));
    if (det.current) {
      out.push(h("div", { class: "pg-card" }, h("div", { class: "pg-row between" }, h("h2", null, "แผนที่ใช้อยู่ (ฉบับที่ " + det.current.version + ")"), h("span", { class: "pg-muted pg-small" }, det.current.approved_by ? "อนุมัติโดย" + det.current.approved_by + " · " + thDT(det.current.approved_at) : "")),
        h("p", { class: "pg-muted pg-small" }, "ทำขั้นไหนเสร็จ กด \"พร้อมให้ครูตรวจ\" แล้วนัดครูผู้ตรวจเองก่อนเส้นตาย % ทางการขยับเมื่อครูติ๊กผ่านเท่านั้น"),
        h("div", { class: "pg-steps" }, det.current.steps.map(s => stepCard(s, "head")))));
    } else if (det.pending) {
      out.push(h("div", { class: "pg-card" }, h("h2", null, "แผนที่ส่งแล้ว (ฉบับที่ " + det.pending.version + ")"), h("p", { class: "pg-muted pg-small" }, "ตัวชี้วัดจะขึ้นเมื่อร่างเสร็จ และเริ่มนับ % เมื่อครูอนุมัติ"),
        h("div", { class: "pg-steps" }, det.pending.steps.map(s => stepCard(s, "view")))));
    } else {
      out.push(h("div", { class: "pg-card pg-empty" }, h("h2", null, "ยังไม่มีแผน"), h("p", null, "เริ่มคุยกับผู้ช่วยในแท็บแรกเพื่อวางแผนงานของฝ่าย"), btn("ไปคุยกับผู้ช่วย", "gold", () => setTab("chat"))));
    }
    out.push(reportsCard(det.reports));
    add(panel, out);
  }
  function reportsCard(reports) {
    return h("div", { class: "pg-card" }, h("h2", null, "รายงานของนักเรียน"), h("p", { class: "pg-muted pg-small" }, "ป้าย \"นักเรียนรายงาน\" ไม่นับเป็น % ทางการ"),
      reports && reports.length ? h("ul", { class: "pg-reports" }, reports.slice(0, 15).map(r => h("li", null, badge("นักเรียนรายงาน", "gold"), " ", r.step_no ? "ขั้น " + r.step_no + " · " : "", r.text,
        h("span", { class: "pg-meta" }, shortName(r.reporter) + " · " + thDT(r.at))))) : h("p", { class: "pg-empty" }, "ยังไม่มีรายงาน"));
  }
  // การ์ดขั้น: mode = head (มีปุ่มพร้อมให้ครูตรวจ) · teacher (มีปุ่มติ๊ก) · view (อ่านอย่างเดียว) · pending (แผนรออนุมัติ)
  function stepCard(s, mode, ctx) {
    const st = STATE[s.state] || STATE.doing;
    const mats = (s.materials || []).map(m => m.item + (m.supplier ? " (" + m.supplier + ")" : "")).join(", ");
    const card = h("div", { class: "pg-step " + s.state, id: (mode === "pending" ? "pg-pstep-" : "pg-step-") + s.step_no },
      h("h3", null, h("span", { class: "pg-no" }, "ขั้นที่ " + s.step_no), h("span", { class: "pg-wrap-text" }, s.title),
        mode === "pending" ? (s.changed ? badge("เปลี่ยนหรือเพิ่มใหม่", "gold") : badge("เหมือนเดิม ยกผลเดิม", "gray")) : badge(st[0], st[1]),
        s.waiting && mode !== "pending" ? badge("นักเรียนแจ้งพร้อมตรวจ", "ink") : null),
      h("div", { class: "pg-facts" }, h("span", null, h("b", null, "เส้นตาย "), thDay(s.due_date, true)), s.date_tentative ? badge("รอยืนยันวัน", "yellow") : null,
        s.owner ? h("span", null, h("b", null, "ผู้รับผิดชอบ "), s.owner) : null, mats ? h("span", { class: "pg-wrap-text" }, h("b", null, "วัสดุ "), mats) : null),
      s.detail ? h("div", { class: "pg-wrap-text" }, s.detail) : null);
    if (mode === "pending" && s.changed && ctx && ctx.old) card.append(h("div", { class: "pg-compare" }, h("b", null, "แผนเดิมขั้นที่ " + ctx.old.step_no + ": "), ctx.old.title + (ctx.old.detail ? " — " + ctx.old.detail : "")));
    if (s.draft_note) card.append(h("div", { class: "pg-notice" }, "หมายเหตุจากผู้ร่าง: " + s.draft_note));
    if (s.draft_failed) card.append(h("div", { class: "pg-notice red" }, "ร่างตัวชี้วัดไม่สำเร็จ ขั้นนี้ยังไม่มีตัวชี้วัดและยังไม่นับใน % (แจ้งครูนพพลให้สั่งร่างใหม่ได้)"));
    if (s.redrafting) card.append(h("div", { class: "pg-notice" }, "กำลังร่างตัวชี้วัดของขั้นนี้ใหม่ ปกติไม่เกิน 1 ชั่วโมง"));
    if (s.indicators && s.indicators.length) {
      card.append(h("ul", { class: "pg-inds" }, s.indicators.map(i => indRow(i, mode, s))));
    } else if (!s.draft_failed && !s.redrafting && mode !== "view") card.append(h("p", { class: "pg-muted pg-small" }, "ยังไม่มีตัวชี้วัด"));
    if (mode === "head" && s.state !== "passed" && s.indicators && s.indicators.length) card.append(readyBox(s));
    return card;
  }
  function indRow(i, mode, s) {
    const mark = i.passed ? badge("ผ่าน", "green") : badge("ยังไม่ผ่าน", "gray");
    const li = h("li", { class: "pg-ind" + (i.passed ? " ok" : "") }, h("div", { class: "pg-ihead" }, mark, h("span", { class: "pg-w" }, "น้ำหนัก " + i.weight), i.carried_from && mode === "pending" ? badge("ยกผลจากแผนเดิม", "gray") : null),
      h("div", { class: "pg-itext" }, i.text),
      h("div", { class: "pg-how" }, "วิธีตรวจ: " + (i.how_to_check || "-") + (i.rule_ref ? " · เกณฑ์: " + i.rule_ref : "")));
    const act = h("div", { class: "pg-actions" });
    if (i.passed && i.checked_by) act.append(h("span", { class: "pg-muted pg-small" }, "ตรวจโดย" + i.checked_by + " · " + thDT(i.checked_at) + (i.note ? " · " + i.note : "")));
    else if (!i.passed && i.checked_by) act.append(h("span", { class: "pg-muted pg-small" }, "ยกเลิกติ๊กโดย" + i.checked_by + " · " + thDT(i.checked_at)));
    if (i.photo_id) act.append(btn("ดูรูป", "quiet sm", () => viewImage(i.photo_id, "รูปที่ครูแนบ")));
    if (mode === "teacher") {
      const can = !!S.reviewer;
      act.append(btn(i.passed ? "ยกเลิกติ๊ก" : "ติ๊กผ่าน", (i.passed ? "danger sm" : "sm") + (can ? "" : " is-off"), () => {
        if (!S.reviewer) { flashReviewer(); return; }
        checkModal(i, !i.passed, s);
      }, { "aria-disabled": String(!can), title: can ? "" : "เลือกชื่อผู้ตรวจด้านบนก่อน" }));
    }
    if (act.childNodes.length) li.append(act);
    return li;
  }
  function readyBox(s) {
    const box = h("div", { class: "pg-ready" });
    const note = h("input", { class: "pg-input", maxlength: "200", placeholder: "หมายเหตุ เช่น นัดครูพุธ 4 พ.ย. หลังคาบคณะสี", "aria-label": "หมายเหตุถึงครู" });
    const info = h("div", { class: "pg-small" });
    if (s.ready_at) info.append(h("span", { class: "pg-ok" }, "แจ้งพร้อมตรวจแล้ว " + thDT(s.ready_at) + (s.ready_by ? " โดย " + shortName(s.ready_by) : "")));
    const go = btn(s.ready_at ? "แจ้งพร้อมตรวจอีกครั้ง" : "พร้อมให้ครูตรวจ", "ghost sm", async () => {
      go.disabled = true;
      try {
        await api("step_ready", { step_no: s.step_no, note: note.value, reporter: S.reporter || "" });
        await refreshDetail();
        planTab(document.getElementById("pg-panel"));
      } catch (e) { go.disabled = false; clear(info).append(h("span", { class: "pg-err" }, e.message || T.offline)); }
    });
    box.append(h("div", { class: "pg-row" }, h("div", { class: "pg-grow" }, note), go), info);
    return box;
  }

  // ---------- แท็บคุยกับผู้ช่วย ----------
  function chatTab(panel) {
    clear(panel);
    const det = S.det;
    if (!S.reporterOk) { reporterPicker(panel); return; }
    if (!S.chat) {
      const kind = det.current ? "progress" : (det.pending ? "" : "plan");
      if (!kind) { // ส่งแผนแล้ว รอร่างหรือรออนุมัติ ยังไม่มีแผนใช้อยู่
        panel.append(h("div", { class: "pg-card pg-empty" }, h("h2", null, "ส่งแผนแล้ว"), h("p", null, PLAN_STATUS[det.pending.status] || ""),
          h("p", { class: "pg-muted pg-small" }, "ระหว่างนี้ถ้าต้องเปลี่ยนแผน กดขอแก้แผนได้"), h("div", { class: "pg-row", style: "justify-content:center" }, btn("ขอแก้แผน", "ghost", () => startKind("change")), btn("ดูแผนที่ส่ง", "quiet", () => setTab("plan")))));
        return;
      }
      startKind(kind);
      return;
    }
    renderChat(panel);
  }
  function reporterPicker(panel) {
    const heads = (S.det.dept.heads || []);
    let pick = S.reporter;
    const other = h("input", { class: "pg-input", maxlength: "60", placeholder: "หรือพิมพ์ชื่อคนอื่นในฝ่าย", "aria-label": "ชื่อผู้คุย" });
    if (pick && heads.indexOf(pick) < 0) other.value = pick;
    const names = h("div", { class: "pg-names" });
    function draw() {
      clear(names);
      heads.forEach(n => names.append(h("button", { type: "button", class: "pg-name" + (n === pick ? " active" : ""), onclick: () => { pick = n; other.value = ""; draw(); } }, n)));
    }
    draw();
    const err = h("div", { class: "pg-err" });
    panel.append(h("div", { class: "pg-card" }, h("h2", null, "ใครกำลังคุยกับผู้ช่วย"), h("p", { class: "pg-muted" }, "เลือกชื่อของคุณ ระบบจะบันทึกชื่อผู้คุยไว้กับทุกข้อความ"), names, other, err,
      h("div", { class: "pg-row", style: "margin-top:12px" }, btn("เริ่มคุย", "gold", () => {
        const n = (other.value.trim() || pick || "").replace(/\s+/g, " ").slice(0, 60);
        if (!n) { err.textContent = "เลือกหรือพิมพ์ชื่อก่อนนะ"; return; }
        S.reporter = n; sset("reporter", n); S.reporterOk = true; chatTab(panel);
      })), h("p", { class: "pg-privacy", style: "margin-top:12px" }, T.privacy)));
  }
  async function startKind(kind) {
    const panel = document.getElementById("pg-panel");
    const open = (S.det.open_sessions || []).filter(s => s.kind === kind)[0];
    S.chat = { kind, session_id: "", msgs: [], busy: false, imgs: [], free: false, left: S.det.messages_left_today, last: null, draft: [] };
    if (open) {
      loading(panel, "กำลังโหลดบทสนทนา…");
      try {
        const r = await api("chat_history", { dept_id: S.det.dept.dept_id, session_id: open.session_id });
        S.chat.session_id = open.session_id;
        S.chat.msgs = r.messages.map(m => ({ role: m.role, display: m.display || {}, at: m.at, reporter: m.reporter, images: (m.image_ids || []).length }));
        const bots = S.chat.msgs.filter(m => m.role === "assistant");
        S.chat.last = bots.length ? bots[bots.length - 1].display : null;
        S.chat.draft = latestDraft(S.chat.msgs);
      } catch (e) { if (!S.token) return; }
    }
    if (S.tab === "chat") renderChat(panel);
  }
  function latestDraft(msgs) {
    for (let i = msgs.length - 1; i >= 0; i--) { const d = msgs[i].display; if (msgs[i].role === "assistant" && d && d.plan_changed && d.plan && d.plan.steps && d.plan.steps.length) return d.plan.steps; }
    return [];
  }
  function renderChat(panel) {
    clear(panel);
    const ch = S.chat, det = S.det;
    const head = h("div", { class: "pg-chathead" },
      h("div", { class: "pg-who" }, badge(KIND[ch.kind], "ink"), " ผู้คุย: ", h("b", null, shortName(S.reporter)), " ",
        h("button", { type: "button", class: "pg-linkbtn", onclick: () => { S.reporterOk = false; chatTab(panel); } }, "เปลี่ยนชื่อ")),
      h("div", { class: "pg-row" },
        ch.kind !== "change" && (det.current || det.pending) ? btn("ขอแก้แผน", "quiet sm", () => startKind("change")) : null,
        ch.kind === "change" && det.current ? btn("กลับไปรายงานความคืบหน้า", "quiet sm", () => startKind("progress")) : null,
        btn("ดูบทสนทนาเก่า", "quiet sm", () => historyModal(det.dept.dept_id, "ฝ่าย" + det.dept.name))));
    const clar = h("div", { class: "pg-clarity" });
    const alert = h("div");
    const msgs = h("div", { class: "pg-msgs", "aria-live": "polite" });
    const confirm = h("div");
    const compose = h("div", { class: "pg-compose" });
    panel.append(h("div", { class: "pg-card pg-chat" }, head, clar, alert, msgs, confirm, compose));
    S.ui = { clar, alert, msgs, confirm, compose };
    drawChat();
  }
  function drawChat() {
    const ch = S.chat, u = S.ui;
    if (!u) return;
    const last = ch.last;
    // ความชัดเจนของแผน (เฉพาะวางแผน)
    clear(u.clar);
    u.clar.hidden = ch.kind !== "plan";
    if (ch.kind === "plan") {
      const v = last ? last.clarity_pct || 0 : 0;
      const cls = v >= 85 ? "clar-high" : v >= 40 ? "clar-mid" : "clar-low";
      u.clar.append(h("div", { class: "pg-row between" }, h("span", { class: "pg-label", style: "margin:0" }, "ความชัดเจนของแผน"), h("span", { class: "pg-pct" }, v + "%")), bar(v, cls));
      const miss = last && last.clarity_missing ? last.clarity_missing.split(/\s*·\s*|\n/).filter(Boolean) : [];
      if (miss.length) u.clar.append(h("ul", { class: "pg-missing", "aria-label": "ยังขาด" }, h("li", { class: "pg-mlabel" }, "ยังขาด"), miss.map(m => h("li", null, badge(m, "gray")))));
      else u.clar.append(h("div", { style: "height:8px" }));
    }
    clear(u.alert);
    if (last && last.contradiction) u.alert.append(h("div", { class: "pg-alert", role: "alert" }, h("b", null, "จุดที่ขัดกันหรือผิดกติกา: "), last.contradiction));
    if (last && last.due_issues && last.due_issues.length && !last.contradiction) u.alert.append(h("div", { class: "pg-alert" }, h("b", null, "เส้นตายที่ต้องแก้: "), last.due_issues.map(x => "ขั้น " + x.no + " " + x.reason).join(" · ")));
    // ข้อความ
    clear(u.msgs);
    if (!ch.msgs.length) {
      const first = { plan: "สวัสดีค่ะ ช่วยวางแผนงานของฝ่ายหน่อยค่ะ", progress: "สวัสดีค่ะ ขอรายงานความคืบหน้าของฝ่ายค่ะ", change: "ขอแก้แผนของฝ่ายค่ะ" }[ch.kind];
      u.msgs.append(h("div", { class: "pg-start" }, h("img", { class: "pg-spin", src: FLOWER, alt: "", style: "animation-duration:6s" }),
        h("p", null, BOT + " พร้อมช่วย" + (ch.kind === "plan" ? "วางแผนงานของฝ่ายตั้งแต่วันนี้ถึงวันแสดง" : ch.kind === "change" ? "แก้แผนของฝ่าย" : "รับรายงานความคืบหน้า") + " กดปุ่มด้านล่างหรือพิมพ์ข้อความเพื่อเริ่มคุย"),
        btn("เริ่มคุยกับผู้ช่วย", "gold", () => send(first, ""), { disabled: ch.busy })));
    }
    ch.msgs.forEach(m => u.msgs.append(bubble(m)));
    const ended = !!(last && last.ready_to_confirm);
    if (last && !ch.busy && last.options && last.options.length) {
      const box = h("div", { class: "pg-opts" });
      last.options.forEach((o, i) => { const b = h("button", { type: "button", class: "pg-opt", onclick: () => send(o.label, o.id) }, o.label); b.style.animationDelay = (i * 0.05) + "s"; box.append(b); });
      box.append(h("button", { type: "button", class: "pg-opt other", onclick: () => { ch.free = true; drawCompose(); const t = document.getElementById("pg-text"); if (t) t.focus(); } }, "อื่น ๆ / ไม่ตรงกับตัวเลือก"));
      u.msgs.append(box);
    }
    if (ch.busy) u.msgs.append(h("div", { class: "pg-msg bot" }, h("div", { class: "pg-bub pg-thinking" }, h("img", { class: "pg-spin", src: FLOWER, alt: "" }), T.thinking)));
    requestAnimationFrame(() => { u.msgs.scrollTop = u.msgs.scrollHeight; });
    // ตารางแผนและปุ่มยืนยันแผน
    clear(u.confirm);
    if (ended && ch.draft && ch.draft.length) u.confirm.append(confirmBox(ch.draft, last));
    drawCompose();
  }
  function bubble(m) {
    const d = m.display || {};
    if (m.role === "assistant") {
      return h("div", { class: "pg-msg bot" }, h("span", { class: "pg-ava" }, h("img", { src: FLOWER, alt: "" })),
        h("div", { class: "pg-bub" }, d.reply || "", d.question ? h("span", { class: "pg-q" }, d.question) : null, m.at ? h("span", { class: "pg-meta" }, thDT(m.at)) : null));
    }
    if (m.role === "sys") return h("div", { class: "pg-msg sys" }, h("div", { class: "pg-bub" }, d.text || ""));
    if (m.role === "err") return h("div", { class: "pg-msg bot err" }, h("span", { class: "pg-ava" }, h("img", { src: FLOWER, alt: "" })), h("div", { class: "pg-bub" }, d.text || T.offline));
    const thumbs = (m.thumbs || []).map(src => h("img", { src, alt: "รูปที่แนบ" }));
    return h("div", { class: "pg-msg me" }, h("div", { class: "pg-bub" }, d.text || "", thumbs.length ? h("div", { class: "pg-thumbs" }, thumbs) : (m.images || d.images) ? h("span", { class: "pg-meta" }, "แนบรูป " + (m.images || d.images) + " รูป") : null,
      h("span", { class: "pg-meta" }, [shortName(m.reporter), thDT(m.at)].filter(Boolean).join(" · "))));
  }
  function confirmBox(steps, last) {
    const go = btn("ยืนยันแผน", "gold", async () => {
      go.disabled = true; msg.textContent = "";
      try {
        const r = await api("plan_confirm", { session_id: S.chat.session_id, reporter: S.reporter });
        S.chat = null;
        await refreshDetail();
        try { S.ov = await api("overview"); } catch (e) { }
        setTab("plan");
        const p = document.getElementById("pg-panel");
        if (p) p.prepend(h("div", { class: "pg-notice green", role: "status" }, "ส่งแผนฉบับที่ " + r.version + " แล้ว " + (r.status === "awaiting_approval" ? T.awaiting : T.drafting)));
      } catch (e) { go.disabled = false; msg.textContent = e.message || T.offline; }
    });
    const msg = h("div", { class: "pg-err" });
    return h("div", { class: "pg-confirm" }, h("h3", null, S.chat.kind === "plan" ? "สรุปแผนของฝ่าย" : "สรุปแผนใหม่"),
      last.change_summary ? h("p", { class: "pg-small" }, h("b", null, "สิ่งที่เปลี่ยน: "), last.change_summary) : null,
      planTable(steps),
      h("p", { class: "pg-muted pg-small" }, "ตรวจตารางให้ถูกต้อง ถ้ายังมีอะไรต้องแก้ พิมพ์บอกผู้ช่วยได้ · กดยืนยันแล้วระบบจะร่างตัวชี้วัด (ไม่เกิน 1 ชั่วโมง) แล้วให้ครูอนุมัติ"),
      h("div", { class: "pg-row" }, go), msg);
  }
  function planTable(steps) {
    return h("table", { class: "pg-plan-table" }, h("colgroup", null, h("col", { class: "c-no" }), h("col"), h("col", { class: "c-due" })),
      h("thead", null, h("tr", null, h("th", null, "ขั้น"), h("th", null, "งาน ผู้รับผิดชอบ และวัสดุ"), h("th", null, "เส้นตาย"))),
      h("tbody", null, steps.map(s => h("tr", null, h("td", null, String(s.no)),
        h("td", null, h("b", null, s.title), s.detail ? h("span", { class: "pg-sub" }, s.detail) : null, s.owner ? h("span", { class: "pg-sub" }, "ผู้รับผิดชอบ: " + s.owner) : null,
          (s.materials || []).length ? h("span", { class: "pg-sub" }, "วัสดุ: " + s.materials.map(m => m.item + (m.supplier ? " (" + m.supplier + ")" : "")).join(", ")) : null),
        h("td", null, thDay(s.due_date), s.date_tentative ? h("div", null, badge("รอยืนยันวัน", "yellow")) : null)))));
  }
  function drawCompose() {
    const ch = S.chat, u = S.ui;
    if (!u) return;
    const last = ch.last;
    const keep = document.getElementById("pg-text");
    const typed = keep ? keep.value : "";
    clear(u.compose);
    u.compose.append(h("p", { class: "pg-privacy" }, T.privacy));
    const needFree = !last || !last.options || !last.options.length || last.allow_free_text || ch.free || last.ready_to_confirm;
    if (!needFree) {
      u.compose.append(h("p", { class: "pg-muted pg-small" }, "เลือกตัวเลือกด้านบน หรือกด \"อื่น ๆ / ไม่ตรงกับตัวเลือก\" เพื่อพิมพ์เอง"));
    } else {
      const ta = h("textarea", { class: "pg-textarea", id: "pg-text", rows: "2", maxlength: "1500", placeholder: ch.free ? "พิมพ์คำตอบของคุณ" : "พิมพ์ข้อความถึง" + BOT, "aria-label": "พิมพ์ข้อความ", disabled: ch.busy });
      ta.value = typed;
      ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && window.matchMedia("(min-width: 900px)").matches) { e.preventDefault(); send(ta.value, ""); } });
      const file = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, onchange: async () => {
        const files = Array.from(file.files || []).slice(0, 3 - ch.imgs.length);
        for (const f of files) { try { ch.imgs.push(await resizeImage(f)); } catch (e) { } }
        file.value = ""; drawCompose();
      } });
      const att = h("div", { class: "pg-attach" }, ch.imgs.map((x, i) => h("figure", null, h("img", { src: x.url, alt: "รูปที่ " + (i + 1) }), h("button", { type: "button", "aria-label": "ลบรูปที่ " + (i + 1), onclick: () => { ch.imgs.splice(i, 1); drawCompose(); } }, "ลบ"))));
      u.compose.append(ta, att, h("div", { class: "pg-compose-row" },
        btn("แนบรูป (" + ch.imgs.length + "/3)", "quiet sm", () => file.click(), { disabled: ch.busy || ch.imgs.length >= 3 }), file,
        btn(ch.busy ? "กำลังส่ง…" : "ส่ง", "gold sm", () => send(ta.value, ""), { disabled: ch.busy }),
        h("span", { class: "pg-left" }, ch.left != null ? "เหลือวันนี้ " + ch.left + " ข้อความ" : "")));
    }
    if (!needFree) u.compose.append(h("div", { class: "pg-compose-row" }, h("span", { class: "pg-left" }, ch.left != null ? "เหลือวันนี้ " + ch.left + " ข้อความ" : "")));
  }
  async function send(text, choiceId) {
    const ch = S.chat;
    if (!ch || ch.busy) return;
    text = String(text || "").trim();
    const imgs = ch.imgs.slice();
    if (!text && !imgs.length) return;
    ch.msgs = ch.msgs.filter(m => m.role !== "err");
    ch.msgs.push({ role: "user", display: { text }, reporter: S.reporter, at: new Date(nowMs()).toISOString(), thumbs: imgs.map(x => x.url) });
    ch.busy = true; ch.imgs = []; ch.free = false;
    const ta = document.getElementById("pg-text"); if (ta) ta.value = "";
    drawChat();
    try {
      const r = await api("chat_send", { session_id: ch.session_id || "", kind: ch.kind, reporter: S.reporter, text, choice_id: choiceId || "", images: imgs.map(x => x.b64) }, 100000);
      if (r.rolled) ch.msgs.push({ role: "sys", display: { text: "บทสนทนาเดิมยาวครบกำหนด ระบบเริ่มบทสนทนาใหม่ต่อจากแผนเดิมให้แล้ว" } });
      ch.session_id = r.session_id; ch.kind = r.kind;
      ch.msgs.push({ role: "assistant", display: r.bot, at: r.at });
      ch.last = r.bot; ch.left = r.messages_left_today;
      ch.draft = r.draft_plan && r.draft_plan.length ? r.draft_plan : ch.draft;
    } catch (e) {
      if (!S.token) return;
      const mine = ch.msgs.pop();
      ch.msgs.push({ role: "err", display: { text: e.message || T.offline } });
      ch.imgs = imgs;
      ch.busy = false; drawChat();
      const t = document.getElementById("pg-text"); if (t) t.value = mine && mine.display.text || "";
      return;
    }
    ch.busy = false;
    drawChat();
  }
  // ย่อรูปในเครื่องให้ด้านยาวไม่เกิน 1,600 px เป็น JPEG คุณภาพราว 0.8 (และไม่เกิน 1.5 MB)
  function resizeImage(file) {
    return new Promise((ok, fail) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * s)), hh = Math.max(1, Math.round(img.naturalHeight * s));
        const cv = document.createElement("canvas"); cv.width = w; cv.height = hh;
        const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, hh); cx.drawImage(img, 0, 0, w, hh);
        URL.revokeObjectURL(url);
        let q = 0.8, data = cv.toDataURL("image/jpeg", q);
        while (data.length * 0.75 > 1.45 * 1024 * 1024 && q > 0.45) { q -= 0.1; data = cv.toDataURL("image/jpeg", q); }
        ok({ url: data, b64: data.split(",")[1] });
      };
      img.onerror = () => { URL.revokeObjectURL(url); fail(new Error("อ่านรูปไม่ได้")); };
      img.src = url;
    });
  }

  // ---------- บทสนทนาย้อนหลัง (โหลดเมื่อกดเท่านั้น) ----------
  async function historyModal(deptId, title) {
    const body = h("div", null, h("div", { class: "pg-loading" }, h("img", { class: "pg-spin", src: FLOWER, alt: "" }), "กำลังโหลด…"));
    const close = modal(h("div", { class: "pg-dialog wide", role: "dialog", "aria-label": "บทสนทนาย้อนหลัง" }, h("div", { class: "pg-row between" }, h("h2", null, "บทสนทนาย้อนหลัง · " + title), btn("ปิด", "quiet sm", () => close())), body));
    try {
      const r = await api("chat_history", { dept_id: deptId });
      clear(body);
      if (!r.sessions.length) { body.append(h("p", { class: "pg-empty" }, "ยังไม่มีบทสนทนา")); return; }
      if (r.truncated) body.append(h("p", { class: "pg-notice" }, "บทสนทนามีมาก แสดงบทล่าสุดก่อน บทเก่ากดเปิดได้ทีละบท"));
      r.sessions.forEach((s, i) => {
        const list = h("div", { class: "pg-msgs" });
        const mine = r.messages.filter(m => m.session_id === s.session_id);
        if (!mine.length && r.truncated && s.turns) list.append(btn("เปิดบทสนทนานี้", "quiet sm", async ev => {
          const b = ev.currentTarget; b.disabled = true;
          try { const one = await api("chat_history", { dept_id: deptId, session_id: s.session_id }); b.remove(); drawHist(list, one.messages); }
          catch (e) { b.disabled = false; alertBox(e.message || T.offline); }
        }));
        drawHist(list, mine);
        body.append(h("details", { class: "pg-sess", open: i === 0 }, h("summary", null, KIND[s.kind] + " · เริ่ม " + thDT(s.started_at) + " · " + s.turns + " รอบ" + (s.status === "open" ? " · คุยต่อได้" : " · ปิดแล้ว")), list));
      });
    } catch (e) { clear(body).append(h("div", { class: "pg-notice red" }, e.message || T.offline)); }
  }
  function drawHist(list, msgs) {
    msgs.forEach(m => {
      list.append(bubble({ role: m.role, display: m.display || {}, at: m.at, reporter: m.reporter, images: (m.image_ids || []).length }));
      if (m.role === "assistant" && m.display && m.display.options && m.display.options.length) list.append(h("div", { class: "pg-muted pg-small", style: "padding-left:40px" }, "ตัวเลือก: " + m.display.options.map(o => o.label).join(" / ")));
      if (m.role === "user" && (m.image_ids || []).length && S.role === "teacher") list.append(h("div", { class: "pg-row", style: "justify-content:flex-end" }, m.image_ids.map((fid, k) => btn("ดูรูปที่ " + (k + 1), "quiet sm", () => viewImage(fid, "รูปที่นักเรียนแนบ")))));
    });
  }
  function modal(dialog) {
    const wrap = h("div", { class: "pg-modal", onclick: e => { if (e.target === wrap) close(); } }, dialog);
    function close() { wrap.remove(); document.documentElement.classList.remove("pg-lock"); document.removeEventListener("keydown", esc, true); }
    // ฟังแบบ capture ให้ทำงานก่อนตัวปิดรูปขยายของ js/common.js: ถ้ารูปขยายเปิดอยู่ Esc ครั้งแรกปิดเฉพาะรูป
    function esc(e) { if (e.key === "Escape" && !document.querySelector(".lightbox.open")) close(); }
    document.addEventListener("keydown", esc, true);
    document.documentElement.classList.add("pg-lock");
    document.body.append(wrap);
    const f = dialog.querySelector("textarea, input, button"); if (f) setTimeout(() => f.focus({ preventScroll: true }), 30);
    return close;
  }
  async function viewImage(fileId, cap) {
    try {
      const r = await api("image_get", { file_id: fileId });
      const src = "data:" + r.media_type + ";base64," + r.data;
      if (window.openLightbox) window.openLightbox([{ src, cap }], 0); else window.open(src);
    } catch (e) { alertBox(e.message || T.offline); }
  }
  function alertBox(text) {
    const close = modal(h("div", { class: "pg-dialog", role: "alertdialog" }, h("p", null, text), h("div", { class: "pg-row end" }, btn("ตกลง", "gold", () => close()))));
  }

  // ======================================================================
  // มุมมองครู
  // ======================================================================
  async function teacherView(focus) {
    document.body.classList.remove("pg-chatting");
    loading(app);
    try { S.ov = await api("overview"); S.today = S.ov.today || ""; } catch (e) { if (S.token) errorCard(app, e, () => teacherView()); return; }
    clear(app);
    app.append(teacherTop());
    const ov = S.ov;
    const follow = ov.followups || [];
    const fol = h("div", { class: "pg-card pg-follow" }, h("h2", null, "ต้องติดตาม (" + follow.length + ")"));
    if (follow.length) fol.append(h("ul", null, follow.map(f => h("li", null, h("button", { type: "button", onclick: () => teacherDept(f.dept_id, f.step_no) }, followBadge(f), h("span", null, followText(f)))))));
    else fol.append(h("p", { class: "pg-empty" }, "ไม่มีเรื่องที่ต้องติดตามตอนนี้"));
    const pct = h("span", { class: "pg-pct" }, "0%");
    const list = h("div", { class: "pg-depts" });
    ov.depts.forEach((x, i) => {
      const chips = h("div", { class: "pg-chips" }, badge(COLOR[x.color], x.color), x.overdue_steps ? badge("เลยกำหนด " + x.overdue_steps + " ขั้น", "red") : null,
        x.waiting ? badge("รอตรวจ " + x.waiting + " ขั้น", "ink") : null, x.pending_version ? badge("แผนใหม่ฉบับที่ " + x.pending_version, "gold") : null, x.open ? null : badge("ยังไม่เปิดใช้", "gray"));
      const last = x.last_report ? "รายงานล่าสุด " + thDT(x.last_report.at) + " · " + shortName(x.last_report.by) + ": " + x.last_report.text : "ยังไม่มีรายงานจากนักเรียน";
      const row = h("button", { type: "button", class: "pg-dept " + x.color, onclick: () => teacherDept(x.dept_id) },
        h("div", { class: "pg-dname" }, h("span", { class: "pg-dot " + x.color }), "ฝ่าย" + x.name), h("div", { class: "pg-pct" }, x.official_pct + "%"),
        bar(x.official_pct, x.color), chips, h("div", { class: "pg-last" }, last, x.last_reviewer ? " · ครูตรวจล่าสุด " + x.last_reviewer.by + " " + thDT(x.last_reviewer.at) : ""));
      row.style.animationDelay = (i * 0.05) + "s";
      list.append(row);
    });
    app.append(fol, h("div", { class: "pg-card" }, h("div", { class: "pg-row between" }, h("h2", null, "ความก้าวหน้าทุกฝ่าย"), h("span", null, "รวม ", pct)), legend(), list));
    countUp(pct, ov.overall_pct, "%");
    if (focus) teacherDept(focus);
  }
  function teacherTop() {
    const sel = h("select", { class: "pg-select", id: "pg-reviewer", "aria-label": "ชื่อผู้ตรวจ", onchange: () => { S.reviewer = sel.value; sset("reviewer", sel.value); redrawTeacherButtons(); } },
      h("option", { value: "" }, "ไม่ได้เลือก (ดูอย่างเดียว)"), (S.ov.reviewers || []).map(n => h("option", { value: n, selected: n === S.reviewer }, n)));
    if (S.reviewer && (S.ov.reviewers || []).indexOf(S.reviewer) < 0) { S.reviewer = ""; sset("reviewer", ""); }
    sel.value = S.reviewer || "";
    return h("div", { class: "pg-top" }, h("div", { class: "pg-topinfo" }, h("div", { class: "pg-muted pg-small" }, "ครูคณะสี · เห็นทุกฝ่าย"), h("h2", null, "แดชบอร์ดครู")),
      h("label", { class: "pg-reviewer" }, h("small", null, "ผู้ตรวจ (ติ๊กและอนุมัติได้เฉพาะ 3 ท่านนี้ จำไว้ในเครื่อง)"), sel),
      btn("ออกจากระบบ", "ghost sm", async () => { try { await api("logout"); } catch (e) { } signOut(); }));
  }
  function flashReviewer() {
    const sel = document.getElementById("pg-reviewer");
    if (sel) { sel.focus(); sel.scrollIntoView({ block: "center", behavior: REDUCED ? "auto" : "smooth" }); }
    alertBox("เลือกชื่อผู้ตรวจ 1 ใน 3 ท่านด้านบนก่อน จึงติ๊กหรืออนุมัติได้");
  }
  function redrawTeacherButtons() { if (S.tdept) renderTeacherDept(); }
  function followBadge(f) {
    return { waiting: badge("รอตรวจ", "ink"), overdue: badge("เลยกำหนด", "red"), no_ind: badge("ไม่มีตัวชี้วัด", "red"), approval: badge("รออนุมัติแผน", "gold"), stale: badge("ไม่มีใครรายงาน", "gray") }[f.type] || badge(f.type);
  }
  function followText(f) {
    if (f.type === "waiting") return "ฝ่าย" + f.dept_name + " ขั้นที่ " + f.step_no + " " + f.title + " · แจ้ง " + thDT(f.at);
    if (f.type === "overdue") return "ฝ่าย" + f.dept_name + " ขั้นที่ " + f.step_no + " " + f.title + " · เส้นตาย " + thDay(f.due_date);
    if (f.type === "no_ind") return "ฝ่าย" + f.dept_name + " ขั้นที่ " + f.step_no + " " + f.title + " · ร่างตัวชี้วัดไม่สำเร็จ ครูนพพลสั่งร่างใหม่ได้";
    if (f.type === "approval") return "ฝ่าย" + f.dept_name + " แผนฉบับที่ " + f.version + (f.failed_steps ? " (ร่างไม่สำเร็จ " + f.failed_steps + " ขั้น)" : "");
    return "ฝ่าย" + f.dept_name + (f.at ? " · ล่าสุด " + thDT(f.at) : " · ยังไม่เคยคุยกับผู้ช่วย");
  }
  async function teacherDept(deptId, stepNo) {
    clear(app);
    app.append(teacherTop());
    const holder = h("div", { id: "pg-tdept" });
    app.append(holder);
    loading(holder);
    try { S.tdet = await api("dept_detail", { dept_id: deptId }); S.today = S.tdet.today || S.today; } catch (e) { if (S.token) errorCard(holder, e, () => teacherDept(deptId, stepNo)); return; }
    S.tdept = deptId;
    renderTeacherDept(stepNo);
  }
  function renderTeacherDept(stepNo) {
    const holder = document.getElementById("pg-tdept");
    if (!holder) return;
    const d = S.tdet;
    clear(holder);
    const pct = h("span", { class: "pg-pct" }, d.official_pct + "%");
    holder.append(h("div", { class: "pg-row", style: "margin-bottom:12px" }, btn("กลับไปหน้ารวม", "quiet sm", () => { S.tdept = ""; teacherView(); }),
      btn("อ่านบทสนทนาย้อนหลัง", "quiet sm", () => historyModal(d.dept.dept_id, "ฝ่าย" + d.dept.name))));
    holder.append(h("div", { class: "pg-card" }, h("div", { class: "pg-row between" }, h("h2", null, "ฝ่าย" + d.dept.name), h("span", null, pct, " ", badge(COLOR[d.color], d.color))), bar(d.official_pct, d.color),
      h("p", { class: "pg-muted pg-small", style: "margin:8px 0 0" }, "เฮดฝ่าย: " + (d.dept.heads || []).join(" · ")),
      S.reviewer ? h("p", { class: "pg-ok pg-small" }, "ผู้ตรวจ: " + S.reviewer) : h("p", { class: "pg-notice" }, "เลือกชื่อผู้ตรวจด้านบนก่อนจึงติ๊กหรืออนุมัติได้ ครูท่านอื่นดูได้อย่างเดียว")));
    if (d.pending) holder.append(pendingCard(d));
    if (d.current) holder.append(h("div", { class: "pg-card" }, h("h2", null, "แผนที่ใช้คิด % (ฉบับที่ " + d.current.version + ")"),
      h("p", { class: "pg-muted pg-small" }, "อนุมัติโดย" + (d.current.approved_by || "-") + " · " + thDT(d.current.approved_at) + " · ติ๊กแล้วมีหน้าต่างยืนยัน ใส่หมายเหตุหรือแนบรูปได้ (ไม่บังคับ)"),
      h("div", { class: "pg-steps" }, d.current.steps.map(s => stepCard(s, "teacher")))));
    else if (!d.pending) holder.append(h("div", { class: "pg-card pg-empty" }, "ฝ่ายนี้ยังไม่มีแผน"));
    holder.append(historyCard(d), reportsCard(d.reports));
    if (stepNo) {
      const el = document.getElementById("pg-step-" + stepNo);
      if (el) { el.scrollIntoView({ block: "center", behavior: REDUCED ? "auto" : "smooth" }); el.classList.add("flash"); }
    }
  }
  function pendingCard(d) {
    const p = d.pending, waiting = p.status !== "awaiting_approval";
    const can = !!S.reviewer && !waiting;
    const failed = p.steps.filter(s => s.draft_failed).length;
    const go = btn("อนุมัติแผน", "gold" + (S.reviewer ? "" : " is-off"), () => {
      if (!S.reviewer) { flashReviewer(); return; }
      if (waiting) return;
      approveModal(d, p, failed);
    }, { disabled: waiting, "aria-disabled": String(!can) });
    return h("div", { class: "pg-card", style: "border-top-color: var(--gold-deep)" },
      h("div", { class: "pg-row between" }, h("h2", null, "แผนรออนุมัติ (ฉบับที่ " + p.version + ")"), waiting ? badge(T.drafting, "yellow") : badge(T.awaiting, "gold")),
      h("p", { class: "pg-small" }, "ยืนยันโดย " + shortName(p.confirmed_by) + " · " + thDT(p.confirmed_at)),
      p.change_summary ? h("div", { class: "pg-notice" }, h("b", null, "สิ่งที่เปลี่ยน: "), p.change_summary) : null,
      d.current ? h("p", { class: "pg-muted pg-small" }, "ระหว่างรออนุมัติ % ยังคิดจากแผนเดิม · ขั้นที่ชื่อและรายละเอียดเหมือนเดิมยกตัวชี้วัดและผลผ่านมาให้") : null,
      h("div", { class: "pg-steps" }, p.steps.map(s => stepCard(s, "pending", { old: d.current ? d.current.steps.filter(o => o.step_no === s.step_no)[0] : null }))),
      failed ? h("div", { class: "pg-notice red" }, "มี " + failed + " ขั้นที่ร่างตัวชี้วัดไม่สำเร็จ อนุมัติได้ แต่ขั้นนั้นยังไม่นับใน % จนกว่าครูนพพลจะสั่งร่างใหม่สำเร็จ") : null,
      h("div", { class: "pg-row", style: "margin-top:10px" }, go));
  }
  function historyCard(d) {
    const byId = {};
    [d.current, d.pending].forEach(p => p && p.steps.forEach(s => s.indicators.forEach(i => { byId[i.ind_id] = { s, i }; })));
    const list = d.checks || [];
    return h("div", { class: "pg-card" }, h("h2", null, "ประวัติการติ๊กและอนุมัติ"),
      list.length ? h("ul", { class: "pg-history" }, list.slice(0, 40).map(k => {
        const x = byId[k.ind_id];
        const what = k.action === "approve" ? (k.note || "อนุมัติแผน") : (x ? "ขั้นที่ " + x.s.step_no + ": " + x.i.text : k.ind_id);
        return h("li", null, h("b", null, thDT(k.at)), " · ", k.reviewer, " · ", { check: badge("ติ๊กผ่าน", "green"), uncheck: badge("ยกเลิกติ๊ก", "red"), approve: badge("อนุมัติ", "gold") }[k.action] || k.action, " ", what,
          k.note && k.action !== "approve" ? " · " + k.note : "", k.photo_id ? btn("ดูรูป", "quiet sm", () => viewImage(k.photo_id, "รูปที่ครูแนบ")) : null);
      })) : h("p", { class: "pg-empty" }, "ยังไม่มีประวัติ"));
  }
  function checkModal(ind, passed, step) {
    const note = h("textarea", { class: "pg-textarea", maxlength: "500", placeholder: "หมายเหตุ (ไม่บังคับ)", "aria-label": "หมายเหตุ" });
    let photo = null;
    const prev = h("div", { class: "pg-attach" });
    const file = h("input", { type: "file", accept: "image/*", hidden: true, onchange: async () => {
      const f = file.files && file.files[0];
      if (f) { try { photo = await resizeImage(f); clear(prev).append(h("figure", null, h("img", { src: photo.url, alt: "รูปที่แนบ" }), h("button", { type: "button", onclick: () => { photo = null; clear(prev); } }, "ลบ"))); } catch (e) { } }
      file.value = "";
    } });
    const err = h("div", { class: "pg-err" });
    const ok = btn(passed ? "ยืนยันติ๊กผ่าน" : "ยืนยันยกเลิกติ๊ก", passed ? "gold" : "danger", async () => {
      ok.disabled = true; err.textContent = "";
      try {
        const r = await api("indicator_check", { ind_id: ind.ind_id, passed, reviewer: S.reviewer, note: note.value, photo: photo ? photo.b64 : "" });
        close();
        S.tdet = await api("dept_detail", { dept_id: S.tdept });
        renderTeacherDept(step.step_no);
        const holder = document.getElementById("pg-tdept");
        if (holder) holder.prepend(h("div", { class: "pg-notice green", role: "status" }, "บันทึกแล้ว % ใหม่ของฝ่าย " + r.official_pct + "% · % รวมทั้งคณะสี " + r.overall_pct + "%"));
      } catch (e) { ok.disabled = false; err.textContent = e.message || T.offline; }
    });
    const close = modal(h("div", { class: "pg-dialog", role: "dialog", "aria-label": "ยืนยันการติ๊ก" },
      h("h2", null, passed ? "ติ๊กผ่านตัวชี้วัด" : "ยกเลิกติ๊กตัวชี้วัด"),
      h("p", { class: "pg-small" }, h("b", null, "ขั้นที่ " + step.step_no + " " + step.title)),
      h("p", null, ind.text), h("p", { class: "pg-muted pg-small" }, "วิธีตรวจ: " + (ind.how_to_check || "-")),
      h("p", { class: "pg-small" }, "ผู้ตรวจ: ", h("b", null, S.reviewer)), note,
      h("div", { class: "pg-row", style: "margin-top:8px" }, btn("แนบรูป (ไม่บังคับ)", "quiet sm", () => file.click()), file), prev, err,
      h("div", { class: "pg-row end" }, btn("ยกเลิก", "quiet", () => close()), ok)));
  }
  function approveModal(d, p, failed) {
    const err = h("div", { class: "pg-err" });
    const ok = btn("ยืนยันอนุมัติ", "gold", async () => {
      ok.disabled = true; err.textContent = "";
      try {
        const r = await api("plan_approve", { dept_id: d.dept.dept_id, version: p.version, reviewer: S.reviewer });
        close();
        S.tdet = await api("dept_detail", { dept_id: S.tdept });
        renderTeacherDept();
        const holder = document.getElementById("pg-tdept");
        if (holder) holder.prepend(h("div", { class: "pg-notice green", role: "status" }, "อนุมัติแผนฉบับที่ " + r.version + " แล้ว % ของฝ่ายตอนนี้ " + r.official_pct + "%"));
      } catch (e) { ok.disabled = false; err.textContent = e.message || T.offline; }
    });
    const close = modal(h("div", { class: "pg-dialog", role: "dialog", "aria-label": "ยืนยันอนุมัติแผน" }, h("h2", null, "อนุมัติแผนฉบับที่ " + p.version + " ของฝ่าย" + d.dept.name),
      h("p", null, "เมื่ออนุมัติ แผนเดิมจะถูกแทน และ % จะคิดจากแผนนี้ทันที"), failed ? h("p", { class: "pg-notice red" }, "มี " + failed + " ขั้นที่ยังไม่มีตัวชี้วัด") : null,
      h("p", { class: "pg-small" }, "ผู้อนุมัติ: ", h("b", null, S.reviewer)), err, h("div", { class: "pg-row end" }, btn("ยกเลิก", "quiet", () => close()), ok)));
  }

  // ======================================================================
  // โหมดทดสอบ (เฉพาะ ?mock=1) — ข้อมูลไม่จริง ใช้ตรวจหน้าจอทุกมุมมอง
  // ======================================================================
  const Mock = (function () {
    const NOW = Date.parse("2026-10-28T13:45:00+07:00");
    const TODAY = "2026-10-28";
    let tick = 0;
    function now() { return NOW + tick * 60000; }
    function iso(s) { return s.length === 10 ? s + "T12:00:00+07:00" : s + ":00+07:00"; }
    const REV = ["ครูนพพล ภาณุสุวัฒน์", "ครูไชยพงศ์ ปานมีศรี", "ครูธนิษฐา ดีสม"];
    const DEPTS = [
      ["cheer_stand", "สแตนด์เชียร์", ["กัญญานัฐ รอดบำรุง ม.5/7"]],
      ["cheerleader", "เชียร์ลีดเดอร์", ["ฐิติยา แสนชัยสัญ ม.5/7", "เรวัต แสงพันธ์ ม.5/7"]],
      ["parade", "ขบวนพาเหรด", ["นราพร อินทวาด ม.5/4", "สุภาพร พงษ์ศา ม.5/4", "วณัฏฐ์ศิตา แพลอย ม.5/4"]],
      ["baton", "คฑากร", ["เกวลี ใจบุญ ม.5/7", "ศรันยา พินิจ ม.5/7"]],
      ["set", "ฉาก", ["วณัฏฐ์ศิตา แพลอย ม.5/4"]],
      ["welfare", "สวัสดิการ", ["บุณยาพร ศรีทัด ม.5/11"]],
      ["pr", "ประชาสัมพันธ์", ["ชินวุฒิ ขันสมบัติ ม.5/7", "นราพร อินทวาด ม.5/4", "นิพิฐพนธ์ แก่นไธสง ม.5/11"]],
      ["sports", "กีฬา", ["สุภนิชา ปั้นทองดี ม.5/11"]]
    ];
    const CODES = { MOCKSET: ["head", "set"], MOCKPARADE: ["head", "parade"], MOCKTEACHER: ["teacher", ""] };
    const tokens = {};
    let seq = 0;
    // ตัวช่วยสร้างแผนจำลอง: I(ข้อความ, วิธีตรวจ, น้ำหนัก, เกณฑ์, ผู้ตรวจ, เวลา)
    function I(text, how, w, rule, by, at) { return { text, how_to_check: how, weight: w, rule_ref: rule || "", passed: !!by, checked_by: by || "", checked_at: at ? iso(at) : "", note: "", photo_id: "", carried_from: "" }; }
    function St(no, title, detail, owner, mats, due, inds, extra) { return Object.assign({ step_no: no, title, detail, owner, materials: mats, due_date: due, date_tentative: false, changed: false, ready_at: "", ready_by: "", draft_note: "", indicators: inds }, extra || {}); }
    function P(ver, status, by, at, steps, extra) { return Object.assign({ version: ver, status, confirmed_by: "", confirmed_at: "", approved_by: by, approved_at: at ? iso(at) : "", change_summary: "", steps }, extra || {}); }
    const db = { plans: {}, reports: {}, checks: {}, sessions: {}, used: {}, activity: {}, open: {} };
    DEPTS.forEach(d => { db.plans[d[0]] = { current: null, pending: null }; db.reports[d[0]] = []; db.checks[d[0]] = []; db.sessions[d[0]] = []; db.used[d[0]] = 0; db.activity[d[0]] = ""; db.open[d[0]] = true; });
    db.plans.parade.current = P(1, "approved", REV[0], "2026-10-21T15:30", [
      St(1, "รวบรวมรายชื่อผู้ร่วมขบวน", "ทำรายชื่อนักเรียนและครูที่ร่วมเดินขบวน แบ่งเป็น 4 แถว", "นราพร", [], "2026-10-23", [I("มีรายชื่อผู้ร่วมขบวนรวมครูอย่างน้อย 80 คน", "ดูรายชื่อแล้วนับ", 4, "ผู้ร่วมขบวน 80 คน", REV[1], "2026-10-23T15:10"), I("แบ่งหน้าที่ครบทั้ง 4 แถว มีชื่อหัวแถว", "ดูผังแถว", 2, "", REV[1], "2026-10-23T15:12")]),
      St(2, "ทำอุปกรณ์ประกอบขบวน", "ทำธงผ้าและป้ายชื่อคณะสี ไม่ใช้วัสดุที่ทำให้พื้นลื่น", "สุภาพร", [{ item: "ผ้าสีเขียว", supplier: "คณะสี" }, { item: "ไม้ด้ามธง", supplier: "ทีมขบวน" }], "2026-10-26", [I("อุปกรณ์ทุกชิ้นไม่มีไฟ ฟืน แป้ง หรือดอกไม้โปรย", "ดูอุปกรณ์ทุกชิ้น", 5, "วัสดุต้องห้าม (ได้ 10 หรือ 0)"), I("ป้ายชื่อคณะสีเสร็จ 1 ป้าย อ่านออกจากระยะ 10 เมตร", "ดูป้ายจริง", 2, "", REV[0], "2026-10-26T14:05")]),
      St(3, "ซ้อมเดินขบวน", "ซ้อมเดินครบระยะรอบสนามพร้อมจัดแถว", "วณัฏฐ์ศิตา", [], "2026-11-04", [I("ซ้อมเดินครบระยะต่อหน้าครูโดยแถวไม่ขาด", "ดูซ้อมจริง 1 รอบ", 3, "ความพร้อมเพรียงและความเป็นระเบียบ"), I("ทุกคนแต่งกายสุภาพตามแผน", "ดูการแต่งกาย", 2, "แต่งกายสุภาพ")], { ready_at: iso("2026-10-27T16:00"), ready_by: "นราพร อินทวาด ม.5/4" }),
      St(4, "ซ้อมใหญ่เต็มชุด", "ซ้อมเต็มชุดพร้อมอุปกรณ์และนับคน", "นราพร", [], "2026-11-10", [I("ซ้อมเต็มชุดต่อหน้าครู นับคนได้ไม่น้อยกว่า 80 คน", "นับคนตอนตั้งแถว", 5, "ผู้ร่วมขบวน 80 คน")])
    ]);
    db.plans.cheer_stand.current = P(1, "approved", REV[1], "2026-10-22T14:00", [
      St(1, "แต่งเพลงเชียร์ 4 เพลง", "แต่งและเรียงเพลงให้ต่อเนื่อง 12 นาที", "กัญญานัฐ", [], "2026-10-25", [I("มีเนื้อเพลงเชียร์ครบ 4 เพลงพิมพ์แจกได้", "ดูเนื้อเพลง", 3, "ความต่อเนื่อง 12 นาที", REV[1], "2026-10-25T13:00")]),
      St(2, "รวบรวมกองเชียร์", "ชวนนักเรียนขึ้นสแตนด์และทำรายชื่อ", "กัญญานัฐ", [], "2026-10-29", [I("มีรายชื่อกองเชียร์ที่ยืนยันแล้วอย่างน้อย 100 คน", "ดูรายชื่อแล้วนับ", 5, "บนสแตนด์ 100 คน")]),
      St(3, "ซ้อมร้องต่อเนื่อง", "ซ้อมร้องครบชุดด้วยเสียงสด", "กัญญานัฐ", [], "2026-11-06", [I("ร้องต่อเนื่องครบชุดด้วยเสียงสด จับเวลาได้ 11–13 นาที", "จับเวลา", 5, "เสียงเชียร์สด · 12 ± 1 นาที")])
    ]);
    db.plans.baton.current = P(1, "approved", REV[2], "2026-10-22T15:00", [
      St(1, "ออกแบบท่าคฑา", "ออกแบบท่าตามแนวคิดมโนราห์ร่ายรำ", "เกวลี", [], "2026-10-27", [I("มีท่าครบทั้งชุดเขียนลำดับไว้", "ดูลำดับท่า", 3, "", REV[2], "2026-10-27T15:00"), I("ซ้อมท่าแรกได้พร้อมกันทุกคน", "ดูซ้อม 1 รอบ", 3, "ความพร้อมเพรียง", REV[2], "2026-10-27T15:05")]),
      St(2, "ซ้อมท่าหน้าประธาน", "ซ้อมครบชุดพร้อมจับเวลา", "ศรันยา", [], "2026-11-05", [I("ซ้อมต่อหน้าครูครบชุด จับเวลาได้ 4–6 นาที", "จับเวลา", 5, "เวลาแสดง 5 ± 1 นาที")]),
      St(3, "เตรียมชุดตาม concept", "ทุกคนใส่เสื้อคณะสีและชุดตามแนวคิด", "เกวลี", [{ item: "เสื้อคณะสี", supplier: "นักเรียนแต่ละคน" }], "2026-11-09", [I("ทุกคนใส่เสื้อคณะสีและชุดตาม concept ครบ", "ดูตอนซ้อม", 2, "การแต่งกายตรงตาม concept")])
    ]);
    db.plans.cheerleader.current = P(1, "approved", REV[0], "2026-10-21T16:00", [
      St(1, "เลือกเพลงและท่า", "เลือกเพลงและออกแบบท่าแปรแถว", "ฐิติยา", [], "2026-10-24", [I("มีลำดับเพลงและท่าครบ 12 นาที", "ดูลำดับ", 3, "เวลา 12 ± 1 นาที", REV[0], "2026-10-24T15:00")]),
      St(2, "ซ้อมแปรแถว", "ซ้อมแปรแถว 3 รูปแบบ", "เรวัต", [], "2026-10-27", [I("แปรแถวครบ 3 รูปแบบโดยไม่ชนกัน", "ดูซ้อม", 3, "การแปรแถว", REV[0], "2026-10-27T14:30"), I("ทุกคนจำท่าได้ไม่ต้องดูคนข้าง ๆ", "ดูซ้อม", 2, "", REV[1], "2026-10-27T14:40")]),
      St(3, "ซ้อมเต็มชุด", "ซ้อมเต็มชุดพร้อมจับเวลา", "ฐิติยา", [], "2026-11-03", [I("ซ้อมต่อหน้าครูจบเพลงโดยไม่หยุด จับเวลาได้ 11–13 นาที", "จับเวลา", 5, "เวลา 12 ± 1 นาที")]),
      St(4, "เครื่องแต่งกาย", "ใส่เสื้อคณะสีและท่อนล่างตามแผน", "เรวัต", [], "2026-11-10", [I("ใส่เสื้อคณะสีครบทุกคน", "นับตอนซ้อมใหญ่", 4, "บังคับเสื้อคณะสี")])
    ]);
    db.plans.pr.current = P(1, "approved", REV[1], "2026-10-22T13:00", [
      St(1, "เปิดช่องทางรวมข่าว", "ตั้งกลุ่มรวมข่าวของคณะสี", "ชินวุฒิ", [], "2026-10-24", [I("มีกลุ่มรวมข่าวที่ทุกฝ่ายเข้าได้", "ดูกลุ่ม", 2, "", REV[1], "2026-10-24T12:00")]),
      St(2, "โพสต์คลิปซ้อม", "โพสต์คลิปซ้อมสัปดาห์ละ 2 คลิป", "นิพิฐพนธ์", [], "2026-11-06", [I("โพสต์คลิปซ้อมแล้วอย่างน้อย 2 คลิป", "เปิดดูโพสต์", 3, "", REV[1], "2026-10-27T18:00"), I("มีภาพนิ่งชุดซ้อมใหญ่อย่างน้อย 10 ภาพ", "เปิดดูอัลบั้ม", 2, "")]),
      St(3, "ทำป้ายเชียร์", "ทำป้ายเชียร์ให้กองเชียร์ถือ", "นราพร", [], "2026-11-10", [I("ป้ายเชียร์เสร็จครบ 20 แผ่น", "นับป้าย", 4, "")])
    ]);
    db.plans.pr.pending = P(2, "awaiting_approval", "", "", [
      St(1, "เปิดช่องทางรวมข่าว", "ตั้งกลุ่มรวมข่าวของคณะสี", "ชินวุฒิ", [], "2026-10-24", [Object.assign(I("มีกลุ่มรวมข่าวที่ทุกฝ่ายเข้าได้", "ดูกลุ่ม", 2, "", REV[1], "2026-10-24T12:00"), { carried_from: "pr-v1-s1-i1" })]),
      St(2, "โพสต์คลิปซ้อม", "โพสต์คลิปซ้อมสัปดาห์ละ 2 คลิป", "นิพิฐพนธ์", [], "2026-11-06", [Object.assign(I("โพสต์คลิปซ้อมแล้วอย่างน้อย 2 คลิป", "เปิดดูโพสต์", 3, "", REV[1], "2026-10-27T18:00"), { carried_from: "pr-v1-s2-i1" }), Object.assign(I("มีภาพนิ่งชุดซ้อมใหญ่อย่างน้อย 10 ภาพ", "เปิดดูอัลบั้ม", 2, ""), { carried_from: "pr-v1-s2-i2" })]),
      St(3, "ทำป้ายเชียร์", "ทำป้ายเชียร์ให้กองเชียร์ถือ", "นราพร", [], "2026-11-09", [Object.assign(I("ป้ายเชียร์เสร็จครบ 20 แผ่น", "นับป้าย", 4, ""), { carried_from: "pr-v1-s3-i1" })]),
      St(4, "ทำคลิปเปิดตัวสแตนด์", "ตัดคลิป 30 วินาทีเปิดตัวสแตนด์ธีมพระสุธนมโนราห์", "นิพิฐพนธ์", [], "2026-11-08", [I("มีคลิปความยาว 25–35 วินาทีเปิดดูได้", "เปิดคลิปแล้วจับเวลา", 3, ""), I("ในคลิปมีชื่อคณะสีและธีมพระสุธนมโนราห์", "ดูคลิป", 2, "")], { changed: true, draft_note: "ควรนัดตรวจหลังคาบคณะสี" }),
      St(5, "ถ่ายภาพหมู่คณะสี", "นัดถ่ายภาพหมู่ทุกฝ่ายวันซ้อมใหญ่", "ชินวุฒิ", [], "2026-11-10", [], { changed: true, draft_failed: true })
    ], { confirmed_by: "ชินวุฒิ ขันสมบัติ ม.5/7", confirmed_at: iso("2026-10-28T10:20"), change_summary: "เพิ่มขั้นทำคลิปเปิดตัวสแตนด์และถ่ายภาพหมู่ เลื่อนป้ายเชียร์เป็น 9 พ.ย." });
    db.plans.sports.current = P(1, "approved", REV[0], "2026-10-21T13:00", [
      St(1, "ส่งรายชื่อนักกีฬาครบ", "ตรวจรายชื่อทุกประเภทกับครูผู้ควบคุม", "สุภนิชา", [], "2026-10-22", [I("รายชื่อนักกีฬาครบทุกประเภทที่สมัคร", "ดูทะเบียน", 3, "", REV[0], "2026-10-22T15:00")]),
      St(2, "พร้อมแข่งวันพุธ 28 ต.ค.", "นักกีฬาและครูผู้ควบคุมพร้อมทุกประเภทที่แข่งวันนี้", "สุภนิชา", [], "2026-10-28", [I("มีครูผู้ควบคุมครบทุกประเภทที่แข่งวันนี้", "ดูรายชื่อครูผู้ควบคุม", 4, "ไม่มีครูนำส่งไม่ได้แข่ง", REV[0], "2026-10-28T12:30")]),
      St(3, "พร้อมแข่งวันพุธ 4 พ.ย.", "เตรียมนักกีฬารอบ 2", "สุภนิชา", [], "2026-11-04", [I("นักกีฬาทุกคนแต่งกายถูกกติกา ไม่มีกางเกงนักเรียน", "ดูก่อนลงแข่ง", 3, "ห้ามกางเกงนักเรียน")]),
      St(4, "พร้อมแข่งวันพุธ 11 พ.ย.", "เตรียมนักกีฬารอบสุดท้าย", "สุภนิชา", [], "2026-11-11", [I("มีครูผู้ควบคุมครบทุกประเภทที่แข่งวันนี้", "ดูรายชื่อ", 4, "ไม่มีครูนำส่งไม่ได้แข่ง")])
    ]);
    ["parade", "cheer_stand", "baton", "cheerleader", "pr", "sports"].forEach((id, k) => {
      const p = db.plans[id].current;
      p.steps.forEach(s => s.indicators.forEach((i, n) => { i.ind_id = id + "-v1-s" + s.step_no + "-i" + (n + 1); if (i.passed) db.checks[id].push({ at: i.checked_at, ind_id: i.ind_id, action: "check", reviewer: i.checked_by, note: "", photo_id: "" }); }));
      db.checks[id].push({ at: p.approved_at, ind_id: "", action: "approve", reviewer: p.approved_by, note: "อนุมัติแผนฉบับที่ 1", photo_id: "" });
      db.activity[id] = iso(["2026-10-27T16:00", "2026-10-28T09:10", "2026-10-27T15:10", "2026-10-26T13:00", "2026-10-28T10:20", "2026-10-28T12:40"][k]);
    });
    db.plans.pr.pending.steps.forEach(s => s.indicators.forEach((i, n) => { i.ind_id = "pr-v2-s" + s.step_no + "-i" + (n + 1); }));
    db.checks.parade[0].photo_id = "mock-photo-1";
    db.reports.parade = [
      { at: iso("2026-10-27T16:00"), reporter: "นราพร อินทวาด ม.5/4", step_no: 3, text: "กด \"พร้อมให้ครูตรวจ\" ขั้น 3 · นัดครูพุธ 28 ต.ค. หลังคาบคณะสี" },
      { at: iso("2026-10-26T12:30"), reporter: "สุภาพร พงษ์ศา ม.5/4", step_no: 2, text: "ขั้น 2 ทำธงเสร็จ 7 จาก 10 ผืน ผ้าสีเขียวไม่พอ ขอผ้าเพิ่มจากครูไชยพงศ์แล้ว" }];
    db.reports.cheer_stand = [{ at: iso("2026-10-28T09:10"), reporter: "กัญญานัฐ รอดบำรุง ม.5/7", step_no: 2, text: "ขั้น 2 ได้รายชื่อกองเชียร์ 84 คน ยังขาด 16 คน จะชวนห้อง ม.4 เพิ่มพรุ่งนี้" }];
    db.reports.sports = [{ at: iso("2026-10-28T12:40"), reporter: "สุภนิชา ปั้นทองดี ม.5/11", step_no: 2, text: "วันนี้แข่ง 5 ประเภท ครูผู้ควบคุมครบ นักกีฬาพร้อม" }];
    // บทสนทนาวางแผนของฝ่ายฉาก (ยังไม่มีแผน)
    function bot(o) { return Object.assign({ reply: "", question: "", options: [], allow_free_text: false, clarity_pct: 0, clarity_missing: "", contradiction: "", topics_done: [], plan_changed: false, plan: { steps: [] }, current_step_no: 0, report_note: "", ready_to_confirm: false, change_summary: "", due_issues: [] }, o); }
    const opts = a => a.map((l, i) => ({ id: "abcde"[i], label: l }));
    db.sessions.set.push({ session_id: "Sset-mock-1", kind: "plan", status: "open", started_at: iso("2026-10-28T13:30"), last_at: iso("2026-10-28T13:36"), turns: 2, clarity_pct: 10, messages: [
      { role: "user", at: iso("2026-10-28T13:30"), reporter: "วณัฏฐ์ศิตา แพลอย ม.5/4", display: { text: "สวัสดีค่ะ ช่วยวางแผนงานของฝ่ายหน่อยค่ะ", images: 0 }, image_ids: [] },
      { role: "assistant", at: iso("2026-10-28T13:30"), reporter: "", display: bot({ reply: "สวัสดีค่ะ ผู้ช่วยวางแผนกระดังงายินดีช่วยวางแผนฉากเบื้องหลังสแตนด์ ตั้งแต่วันนี้ถึงวันติดตั้งเสร็จพุธ 11 พ.ย. ค่ะ ครูคณะสีที่มีรหัสอ่านบทสนทนานี้ย้อนหลังได้นะคะ", question: "ทีมฉากตอนนี้มีกี่คนคะ", options: opts(["3–5 คน", "6–10 คน", "มากกว่า 10 คน"]), clarity_missing: "ทีม · แนวคิด · ตอนนี้ทำถึงไหน · ขั้นตอน · วัสดุ · กติกา · เส้นตาย" }), image_ids: [] },
      { role: "user", at: iso("2026-10-28T13:35"), reporter: "วณัฏฐ์ศิตา แพลอย ม.5/4", display: { text: "6–10 คน", choice_id: "b", images: 0 }, image_ids: [] },
      { role: "assistant", at: iso("2026-10-28T13:36"), reporter: "", display: bot({ reply: "ทีม 6–10 คนกำลังดีค่ะ ขอทราบแนวคิดของฉากก่อนนะคะ", question: "ฉากจะเล่าตอนไหนของพระสุธนมโนราห์คะ", options: opts(["มโนราห์เล่นน้ำที่สระอโนดาต", "พระสุธนตามหามโนราห์", "พระสุธนกับมโนราห์ได้พบกันอีกครั้ง", "รวมหลายตอนต่อกัน"]), clarity_pct: 10, topics_done: ["team"], clarity_missing: "แนวคิด · ตอนนี้ทำถึงไหน · ขั้นตอน · วัสดุ · กติกา · เส้นตาย" }), image_ids: [] }
    ] });
    db.activity.set = iso("2026-10-28T13:36");
    db.sessions.parade.push({ session_id: "Sparade-mock-1", kind: "progress", status: "open", started_at: iso("2026-10-26T12:20"), last_at: iso("2026-10-26T12:30"), turns: 1, clarity_pct: 0, messages: [
      { role: "user", at: iso("2026-10-26T12:20"), reporter: "สุภาพร พงษ์ศา ม.5/4", display: { text: "ขอรายงานขั้น 2 ค่ะ ทำธงไปได้ 7 ผืนแล้ว", images: 1 }, image_ids: ["mock-photo-2"] },
      { role: "assistant", at: iso("2026-10-26T12:30"), reporter: "", display: bot({ reply: "เยี่ยมเลยค่ะ ทำไปได้ 7 จาก 10 ผืนแล้ว ธงในรูปใช้ผ้าล้วน ไม่มีวัสดุที่ทำให้พื้นลื่น ถูกกติกาค่ะ", question: "ติดอะไรที่ทำให้อีก 3 ผืนยังไม่เสร็จไหมคะ", options: opts(["ผ้าไม่พอ", "คนทำไม่พอ", "ไม่ติดอะไร"]), clarity_pct: 100, current_step_no: 2, report_note: "ขั้น 2 ทำธงเสร็จ 7 จาก 10 ผืน" }), image_ids: [] }
    ] });
    const SCRIPT = [
      { reply: "ตอนนี้เลือกแนวคิดได้ชัดแล้วค่ะ", question: "ตอนนี้งานฉากทำถึงไหนแล้วคะ", options: opts(["ยังไม่เริ่ม", "ร่างแบบแล้ว", "เริ่มขึ้นโครงแล้ว"]), clarity_pct: 20, topics_done: ["team", "concept"], clarity_missing: "ตอนนี้ทำถึงไหน · ขั้นตอน · วัสดุ · กติกา · เส้นตาย" },
      { reply: "รับทราบค่ะ", question: "ฉากจะสูงประมาณเท่าไรคะ", options: opts(["2.20 ม.", "2.40 ม.", "3 เมตร"]), clarity_pct: 30, topics_done: ["team", "concept", "current_stage"], clarity_missing: "ขั้นตอน · วัสดุ · กติกา · เส้นตาย" },
      { reply: "ความสูงนี้ไม่เกินกติกา 2.40 ม. ค่ะ", question: "วัสดุหลักที่ใช้ทำฉากมีอะไร และใครจัดหาคะ", options: opts(["ไม้อัดกับโครงไม้ คณะสีจัดหา", "ฟิวเจอร์บอร์ด ทีมฉากจัดหา", "ผ้าใบขึงโครง คณะสีจัดหา"]), allow_free_text: true, clarity_pct: 55, topics_done: ["team", "concept", "current_stage", "rules"], clarity_missing: "ขั้นตอน · วัสดุ · เส้นตาย" },
      { reply: "ขอเสนอลำดับขั้นตอนตามนี้นะคะ", question: "ลำดับขั้นนี้ใช้ได้ไหมคะ ร่างแบบ ขึ้นโครง ลงสี ซ้อมถอดและประกอบกลับ ติดตั้งจริง", options: opts(["ใช้ได้เลย", "ขอสลับบางขั้น", "ขอเพิ่มขั้น"]), clarity_pct: 80, topics_done: ["team", "concept", "current_stage", "rules", "materials", "steps"], clarity_missing: "เส้นตายของทุกขั้น" }
    ];
    const PLAN = [
      { no: 1, title: "ร่างแบบฉาก", detail: "วาดแบบฉาก 6 แผ่น สูง 2.30 ม. ตอนพระสุธนกับมโนราห์ได้พบกัน", owner: "วณัฏฐ์ศิตา", materials: [{ item: "กระดาษร่างแบบ", supplier: "ทีมฉาก" }], due_date: "2026-10-30", date_tentative: false },
      { no: 2, title: "ขึ้นโครงฉาก", detail: "ประกอบโครงไม้ 6 แผ่น ตั้งได้เองไม่ล้ม", owner: "ทีมช่าง 4 คน", materials: [{ item: "ไม้ระแนง", supplier: "คณะสี" }, { item: "ไม้อัด", supplier: "คณะสี" }], due_date: "2026-11-04", date_tentative: false },
      { no: 3, title: "ลงสีและตกแต่ง", detail: "ลงสีพื้นทุกแผ่นและวาดตัวละคร", owner: "ทีมศิลป์ 3 คน", materials: [{ item: "สีน้ำพลาสติก", supplier: "คณะสี" }], due_date: "2026-11-08", date_tentative: true },
      { no: 4, title: "ซ้อมถอดและประกอบกลับ", detail: "ซ้อมถอดและประกอบกลับให้ทันพิธีจุดคบเพลิงทั้ง 12 และ 13 พ.ย.", owner: "ทีมช่าง", materials: [], due_date: "2026-11-10", date_tentative: false },
      { no: 5, title: "ติดตั้งฉากจริง", detail: "ติดตั้งหลังสแตนด์ เก็บพื้นที่ให้สะอาด", owner: "ทีมฉากทั้งหมด", materials: [{ item: "เคเบิลไทร์", supplier: "ทีมฉาก" }], due_date: "2026-11-11", date_tentative: false }
    ];
    let step = 0;
    function mockBot(text, kind, dept) {
      if (/3\s*(เมตร|ม\.?)(?!\S*\d)/.test(text) && !/2\.\d/.test(text)) return bot({ reply: "ขอทวนนิดหนึ่งนะคะ", contradiction: "ฉากสูง 3 เมตร เกินกติกาที่กำหนดไม่เกิน 2.40 เมตร", question: "ปรับความสูงฉากเป็นเท่าไรดีคะ", options: opts(["2.20 ม.", "2.30 ม.", "2.40 ม. พอดี"]), clarity_pct: 20, topics_done: ["team", "concept"], clarity_missing: "กติกา (ความสูงฉาก) · ขั้นตอน · วัสดุ · เส้นตาย" });
      if (kind === "progress") return bot({ reply: "รับทราบค่ะ บันทึกรายงานให้ครูแล้ว", question: "มีขั้นไหนเสร็จแล้วพร้อมให้ครูตรวจไหมคะ", options: opts(["มี จะกดพร้อมให้ครูตรวจ", "ยังไม่มี"]), clarity_pct: 100, current_step_no: 2, report_note: "รายงานจากโหมดทดสอบ: " + text.slice(0, 80) });
      if (/สรุป|พร้อม|ยืนยัน|ใช้ได้เลย/.test(text) || step >= SCRIPT.length) {
        return bot({ reply: "แผนครบทุกหัวข้อแล้วค่ะ ตรวจตารางด้านล่าง ถ้าถูกต้องกด \"ยืนยันแผน\" ได้เลยค่ะ", clarity_pct: 92, topics_done: ["team", "concept", "current_stage", "steps", "materials", "rules", "due_dates"], plan_changed: true, plan: { steps: PLAN }, ready_to_confirm: true, allow_free_text: true, change_summary: kind === "change" ? "ปรับขั้นตอนตามที่คุย" : "" });
      }
      return bot(SCRIPT[step++]);
    }
    // คำนวณแบบเดียวกับตัวกลาง
    function stepState(s, checks) {
      const all = s.indicators.length > 0 && s.indicators.every(i => i.passed);
      let state = "doing";
      if (!s.indicators.length) state = "no_ind"; else if (all) state = "passed"; else if (s.due_date < TODAY) state = "overdue"; else if (daysBetween(TODAY, s.due_date) <= 2) state = "soon";
      const ids = s.indicators.map(i => i.ind_id), rd = Date.parse(s.ready_at || "");
      const waiting = !!rd && !all && s.indicators.length > 0 && !checks.some(k => ids.indexOf(k.ind_id) >= 0 && Date.parse(k.at) > rd);
      return Object.assign({}, s, { state, waiting });
    }
    function view(p, id) { return p ? Object.assign({}, p, { steps: p.steps.map(s => stepState(s, db.checks[id])) }) : null; }
    function pct(p) { if (!p) return 0; let t = 0, ok = 0; p.steps.forEach(s => s.indicators.forEach(i => { t += i.weight; if (i.passed) ok += i.weight; })); return t ? Math.round(ok / t * 100) : 0; }
    function stats(id) {
      const p = view(db.plans[id].current, id), pe = db.plans[id].pending;
      const color = !p ? "gray" : p.steps.some(s => s.state === "overdue") ? "red" : p.steps.some(s => s.state === "soon") ? "yellow" : "green";
      return { p, pe, color, pct: pct(db.plans[id].current), overdue: p ? p.steps.filter(s => s.state === "overdue").length : 0, waiting: p ? p.steps.filter(s => s.waiting).length : 0, status: pe ? pe.status : (p ? "approved" : "no_plan") };
    }
    function overall() { return Math.round(DEPTS.reduce((a, d) => a + stats(d[0]).pct, 0) / DEPTS.length); }
    function who(b) { const t = tokens[b.token]; if (!t) throw { error: "token_expired", message: "บัตรผ่านหมดอายุหรือถูกยกเลิก กรุณาใส่รหัสใหม่" }; return t; }
    function forbid() { throw { error: "forbidden", message: "ไม่มีสิทธิ์ทำรายการนี้" }; }
    function needRev(name) { if (REV.indexOf(name) < 0) throw { error: "forbidden", message: "เลือกชื่อผู้ตรวจ 1 ใน 3 ท่านก่อน" }; }
    function dname(id) { return DEPTS.filter(d => d[0] === id)[0][1]; }
    function stamp() { tick++; return new Date(now() + 7 * 3600000).toISOString().slice(0, 19) + "+07:00"; }
    const A = {
      public_summary: () => ({ overall_pct: overall(), days_left: daysBetween(TODAY, "2026-11-12"), days_left_ready: daysBetween(TODAY, "2026-11-10"), updated_at: iso("2026-10-28T12:30") }),
      login(b) {
        const c = CODES[String(b.code || "").toUpperCase().replace(/[\s-]/g, "")];
        if (!c) throw { error: "bad_code", message: "รหัสไม่ถูกต้อง ตรวจตัวอักษรแล้วลองใหม่" };
        const tok = "mock-token-" + (++seq);
        tokens[tok] = { role: c[0], dept: c[1] };
        const d = DEPTS.filter(x => x[0] === c[1])[0];
        return { token: tok, role: c[0], expires_at: iso("2026-11-04T13:45"), dept: d ? { dept_id: d[0], name: d[1], heads: d[2] } : null, reviewers: c[0] === "teacher" ? REV : undefined };
      },
      logout(b) { delete tokens[b.token]; return {}; },
      overview(b) {
        const w = who(b), teacher = w.role === "teacher";
        const rows = DEPTS.map((d, i) => { const s = stats(d[0]); const o = { dept_id: d[0], name: d[1], official_pct: s.pct, status: s.status, color: s.color, mine: !teacher && w.dept === d[0], _i: i };
          if (teacher) { const rep = db.reports[d[0]][0]; const chk = db.checks[d[0]].filter(k => k.action !== "approve").sort((a, b2) => Date.parse(b2.at) - Date.parse(a.at))[0];
            Object.assign(o, { open: db.open[d[0]], overdue_steps: s.overdue, waiting: s.waiting, last_report: rep ? { at: rep.at, by: rep.reporter, text: rep.text } : null, last_reviewer: chk ? { at: chk.at, by: chk.reviewer } : null, pending_version: s.pe ? s.pe.version : 0 }); }
          return o; }).sort((a, b2) => ({ red: 0, yellow: 1, green: 2, gray: 3 })[a.color] - ({ red: 0, yellow: 1, green: 2, gray: 3 })[b2.color] || a._i - b2._i);
        rows.forEach(r => delete r._i);
        const res = { overall_pct: overall(), today: TODAY, days_left: 15, days_left_ready: 13, depts: rows, role: w.role };
        if (teacher) {
          const f = [];
          DEPTS.forEach(d => { const s = stats(d[0]); if (s.p) s.p.steps.forEach(x => { if (x.waiting) f.push({ type: "waiting", dept_id: d[0], dept_name: d[1], step_no: x.step_no, title: x.title, at: x.ready_at }); }); });
          DEPTS.forEach(d => { const s = stats(d[0]); if (s.p) s.p.steps.forEach(x => { if (x.state === "overdue") f.push({ type: "overdue", dept_id: d[0], dept_name: d[1], step_no: x.step_no, title: x.title, due_date: x.due_date }); }); });
          DEPTS.forEach(d => { const pe = db.plans[d[0]].pending; if (pe && pe.status === "awaiting_approval") f.push({ type: "approval", dept_id: d[0], dept_name: d[1], version: pe.version, failed_steps: pe.steps.filter(s => !s.indicators.length).length }); });
          DEPTS.forEach(d => { const a = Date.parse(db.activity[d[0]] || ""); if (db.open[d[0]] && (!a || now() - a > 3 * 86400000)) f.push({ type: "stale", dept_id: d[0], dept_name: d[1], at: db.activity[d[0]] }); });
          res.followups = f; res.reviewers = REV;
        } else { const d = DEPTS.filter(x => x[0] === w.dept)[0]; res.dept = { dept_id: d[0], name: d[1], heads: d[2] }; }
        return res;
      },
      dept_detail(b) {
        const w = who(b), id = b.dept_id || w.dept;
        if (w.role !== "teacher" && id !== w.dept) forbid();
        const s = stats(id), d = DEPTS.filter(x => x[0] === id)[0];
        const pe = s.pe ? view(s.pe, id) : null;
        if (pe) pe.steps.forEach(x => { x.draft_failed = pe.status === "awaiting_approval" && !x.indicators.length; });
        return { dept: { dept_id: id, name: d[1], heads: d[2], open: true }, official_pct: s.pct, color: s.color, status: s.status, today: TODAY, current: s.p, pending: pe,
          checks: db.checks[id].slice().sort((a, b2) => Date.parse(b2.at) - Date.parse(a.at)), reports: db.reports[id],
          open_sessions: db.sessions[id].filter(x => x.status === "open").map(x => ({ session_id: x.session_id, kind: x.kind, turns: x.turns, clarity_pct: x.clarity_pct, last_at: x.last_at })),
          messages_left_today: w.role === "head" ? 60 - db.used[id] : undefined, final_date: id === "set" ? "2026-11-11" : "2026-11-10" };
      },
      chat_history(b) {
        const w = who(b), id = b.dept_id || w.dept;
        if (w.role !== "teacher" && id !== w.dept) forbid();
        const ss = db.sessions[id].filter(x => !b.session_id || x.session_id === b.session_id);
        const msgs = [];
        ss.forEach(x => x.messages.forEach((m, i) => msgs.push(Object.assign({ session_id: x.session_id, seq: i + 1 }, m))));
        return { dept_id: id, sessions: ss.map(x => ({ session_id: x.session_id, kind: x.kind, started_at: x.started_at, last_at: x.last_at, turns: x.turns, clarity_pct: x.clarity_pct, status: x.status })), messages: msgs };
      },
      chat_send(b) {
        const w = who(b); if (w.role !== "head") forbid();
        const id = w.dept;
        if (db.used[id] >= 60) throw { error: "daily_limit", message: "วันนี้ฝ่ายนี้ส่งข้อความครบ 60 ข้อความแล้ว พรุ่งนี้คุยต่อได้" };
        let sess = db.sessions[id].filter(x => x.session_id === b.session_id && x.status === "open")[0];
        if (!sess) { sess = { session_id: "S" + id + "-mock-" + (++seq), kind: b.kind, status: "open", started_at: stamp(), last_at: "", turns: 0, clarity_pct: 0, messages: [] }; db.sessions[id].unshift(sess); }
        const at = stamp(), r = mockBot(String(b.text || ""), sess.kind, id);
        sess.messages.push({ role: "user", at, reporter: b.reporter, display: { text: b.text, choice_id: b.choice_id, images: (b.images || []).length }, image_ids: (b.images || []).map((x, i) => "mock-photo-" + (i + 2)) });
        sess.messages.push({ role: "assistant", at, reporter: "", display: r, image_ids: [] });
        sess.turns++; sess.last_at = at; sess.clarity_pct = r.clarity_pct; db.used[id]++; db.activity[id] = at;
        if (r.report_note) db.reports[id].unshift({ at, reporter: b.reporter, step_no: r.current_step_no, text: r.report_note });
        let draft = [];
        for (let i = sess.messages.length - 1; i >= 0; i--) { const d = sess.messages[i].display; if (d.plan_changed && d.plan.steps.length) { draft = d.plan.steps; break; } }
        return { session_id: sess.session_id, kind: sess.kind, bot: r, draft_plan: draft, messages_left_today: 60 - db.used[id], rolled: false, at };
      },
      plan_confirm(b) {
        const w = who(b); if (w.role !== "head") forbid();
        const id = w.dept, sess = db.sessions[id].filter(x => x.session_id === b.session_id)[0];
        if (!sess) throw { error: "not_ready", message: "แผนยังไม่พร้อมยืนยัน" };
        const last = sess.messages.filter(m => m.role === "assistant").slice(-1)[0].display;
        if (!last.ready_to_confirm) throw { error: "not_ready", message: "แผนยังไม่พร้อมยืนยัน คุยกับผู้ช่วยต่ออีกนิด" };
        const cur = db.plans[id].current, ver = Math.max(cur ? cur.version : 0, db.plans[id].pending ? db.plans[id].pending.version : 0) + 1;
        db.plans[id].pending = P(ver, "drafting", "", "", last.plan.steps.map(s => St(s.no, s.title, s.detail, s.owner, s.materials, s.due_date, [], { date_tentative: s.date_tentative, changed: true })), { confirmed_by: b.reporter, confirmed_at: stamp(), change_summary: last.change_summary });
        sess.status = "closed";
        return { version: ver, status: "drafting", steps_to_draft: last.plan.steps.length };
      },
      step_ready(b) {
        const w = who(b); if (w.role !== "head") forbid();
        const p = db.plans[w.dept].current; if (!p) throw { error: "not_ready", message: "ยังไม่มีแผนที่ครูอนุมัติ" };
        const s = p.steps.filter(x => x.step_no === Number(b.step_no))[0];
        s.ready_at = stamp(); s.ready_by = b.reporter;
        db.reports[w.dept].unshift({ at: s.ready_at, reporter: b.reporter, step_no: s.step_no, text: "กด \"พร้อมให้ครูตรวจ\" ขั้น " + s.step_no + (b.note ? " · " + b.note : "") });
        return { step_no: s.step_no, ready_at: s.ready_at };
      },
      indicator_check(b) {
        const w = who(b); if (w.role !== "teacher") forbid(); needRev(b.reviewer);
        let found = null, dept = "";
        DEPTS.forEach(d => { const p = db.plans[d[0]].current; if (p) p.steps.forEach(s => s.indicators.forEach(i => { if (i.ind_id === b.ind_id) { found = i; dept = d[0]; } })); });
        if (!found) throw { error: "not_found", message: "ไม่พบข้อมูลที่ขอ" };
        const at = stamp();
        Object.assign(found, { passed: !!b.passed, checked_by: b.reviewer, checked_at: at, note: b.note || "", photo_id: b.photo ? "mock-photo-1" : found.photo_id });
        db.checks[dept].unshift({ at, ind_id: b.ind_id, action: b.passed ? "check" : "uncheck", reviewer: b.reviewer, note: b.note || "", photo_id: b.photo ? "mock-photo-1" : "" });
        const s = stats(dept);
        return { dept_id: dept, ind_id: b.ind_id, passed: !!b.passed, official_pct: s.pct, color: s.color, overall_pct: overall() };
      },
      plan_approve(b) {
        const w = who(b); if (w.role !== "teacher") forbid(); needRev(b.reviewer);
        const pl = db.plans[b.dept_id], pe = pl.pending;
        if (!pe || pe.version !== Number(b.version) || pe.status !== "awaiting_approval") throw { error: "not_ready", message: "ยังร่างตัวชี้วัดไม่เสร็จ รอสักครู่" };
        const at = stamp();
        pe.status = "approved"; pe.approved_by = b.reviewer; pe.approved_at = at;
        pl.current = pe; pl.pending = null;
        pe.steps.forEach(s => { delete s.draft_failed; });
        db.checks[b.dept_id].unshift({ at, ind_id: "", action: "approve", reviewer: b.reviewer, note: "อนุมัติแผนฉบับที่ " + pe.version, photo_id: "" });
        const s = stats(b.dept_id);
        return { dept_id: b.dept_id, version: pe.version, status: "approved", official_pct: s.pct, color: s.color, overall_pct: overall() };
      },
      image_get(b) {
        who(b);
        const cv = document.createElement("canvas"); cv.width = 640; cv.height = 420;
        const x = cv.getContext("2d");
        const g = x.createLinearGradient(0, 0, 640, 420); g.addColorStop(0, "#0F5236"); g.addColorStop(1, "#2F8C55");
        x.fillStyle = g; x.fillRect(0, 0, 640, 420); x.fillStyle = "#FFF1BE"; x.font = "600 34px Prompt, sans-serif"; x.textAlign = "center";
        x.fillText("รูปตัวอย่าง (โหมดทดสอบ)", 320, 200); x.font = "24px Sarabun, sans-serif"; x.fillText(String(b.file_id || ""), 320, 250);
        return { file_id: b.file_id, media_type: "image/png", data: cv.toDataURL("image/png").split(",")[1] };
      }
    };
    function call(b) {
      return new Promise((ok, fail) => {
        const fn = A[b.action];
        setTimeout(() => {
          try { if (!fn) throw { error: "bad_request", message: "ข้อมูลที่ส่งมาไม่ครบหรือไม่ถูกต้อง" }; const r = fn(b); r.ok = true; ok(JSON.parse(JSON.stringify(r))); }
          catch (e) { if (e && e.error === "token_expired" && b.action !== "login") signOut(e.message); fail(e); }
        }, b.action === "chat_send" ? 900 : 180);
      });
    }
    return { call, now };
  })();

  // ---------- เริ่มต้น ----------
  petals();
  route();
  window.KDP = { _mock: MOCK };
})();
