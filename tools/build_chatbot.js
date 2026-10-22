// รวมเนื้อหาทั้งเว็บเป็นความรู้ให้แชตบอต "น้องกระดังงา" -> data/chatbot-knowledge.json
// รันโดย GitHub Actions (.github/workflows/chatbot-knowledge.yml) ทุกครั้งที่ข้อมูลหรือหน้าเว็บเปลี่ยน
// ทดสอบในเครื่อง: node tools/build_chatbot.js
// ไม่ใส่เวลาที่รันลงในไฟล์ ไฟล์จึงเปลี่ยนเฉพาะตอนเนื้อหาเปลี่ยน
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "chatbot-knowledge.json");
const DATA = ["site", "news", "teachers", "duty", "students", "gallery", "memories", "tiktok", "tiktok-feed", "instagram", "instagram-feed", "chatbot"];
const PAGES = [
  ["index.html", "หน้าแรก"],
  ["news.html", "ข่าวสาร"],
  ["gallery.html", "ภาพกิจกรรม"],
  ["tiktok.html", "คลิป TikTok"],
  ["instagram.html", "Instagram"],
  ["memories.html", "ความทรงจำ"],
  ["teachers.html", "ทำเนียบครู"],
  ["duty.html", "เวรประจำจุด"],
  ["students.html", "ทำเนียบนักเรียน"],
  ["games.html", "บุนนาคเกมส์ 2569"]
];
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
// เว็บคณะสีไม่ลงเรื่องเงิน บรรทัดที่มีคำเหล่านี้จะไม่เข้าความรู้ของบอต
const MONEY = /บาท|โอนเงิน|พร้อมเพย์|promptpay|เลขบัญชี|บริจาค|qr ?code/i;

function readText(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

// โหลดไฟล์ข้อมูล data/*.js แบบเดียวกับในเบราว์เซอร์
function loadKD() {
  const ctx = vm.createContext({});
  vm.runInContext("var window = this;", ctx);
  for (const name of DATA) {
    const f = `data/${name}.js`;
    if (fs.existsSync(path.join(ROOT, f))) vm.runInContext(readText(f), ctx, { filename: f });
  }
  return ctx.KD || {};
}

function thDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${d} ${TH_MONTHS[m - 1]} ${y + 543}`;
}
function clean(s) {
  return String(s == null ? "" : s)
    .replace(/#[^\s#]+/g, "")
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}‍️]/gu, "")
    .replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}
function decode(s) {
  return s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&");
}

// ข้อความที่เขียนไว้ในหน้า HTML (ไม่รวมสคริปต์) แบ่งบรรทัดตามหัวข้อ ย่อหน้า และแถวตาราง
function pageText(file) {
  let s = readText(file);
  const body = s.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  s = body ? body[1] : s;
  s = s.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|svg|template)[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<\/(td|th)>/gi, " | ").replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|tr|div|section|figure|figcaption|label|summary|table|ul|ol|header)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const lines = decode(s).split("\n").map(l => l.replace(/\s+/g, " ").replace(/\s*\|\s*$/, "").trim()).filter(Boolean);
  return lines.filter((l, i) => l !== lines[i - 1]).join("\n");
}
function metaDesc(file) {
  const m = readText(file).match(/<meta name="description" content="([^"]*)"/);
  return m ? decode(m[1]) : "";
}
// อ่านค่าคงที่ที่เขียนไว้ในสคริปต์ของหน้า เช่น เช็กลิสต์ฉากใน games.html
function pageConst(file, name) {
  const m = readText(file).match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]);\\n`));
  if (!m) return null;
  try { return vm.runInNewContext(m[1]); } catch (e) { return null; }
}

function build() {
  const KD = loadKD();
  const S = KD.site || {};
  const B = KD.chatbot || {};
  const sections = [];
  const add = (title, url, text) => {
    text = String(text || "").split("\n").filter(l => !MONEY.test(l)).join("\n").trim();
    if (text && !MONEY.test(title)) sections.push({ title, url: url || "", text });
  };

  // ข้อมูลทั่วไปและหน้าแรก
  add("ข้อมูลทั่วไปของคณะสีกระดังงา", "index.html", [
    `${S.name || "คณะสีกระดังงา"} (${S.color || "สีเขียว"}) ${S.school || ""} ${S.year || ""}`,
    S.theme && `ธีมบุนนาคเกมส์ 2569 ของคณะสีกระดังงา: ${S.theme}`,
    S.gamesName && `${S.gamesName} แข่งขันวันที่ ${S.gamesDates || thDate(S.gamesStart)}`,
    S.motto && `คำขวัญ: ${S.motto.join(" ")}`,
    S.tiktok && `TikTok ของคณะสี: ${S.tiktokName} ${S.tiktok}`,
    S.instagram && `Instagram ของคณะสี: ${S.instagramName} ${S.instagram}`,
    `เว็บไซต์คณะสี: https://watpolprot-cloud.github.io/kradangnga-web/`,
    S.updated && `เว็บปรับปรุงล่าสุด ${S.updated}`,
    "",
    "ข้อความในหน้าแรก:",
    pageText("index.html")
  ].filter(x => x != null && x !== false).join("\n"));

  // แผนผังเว็บ
  add("หน้าต่าง ๆ ในเว็บ", "", PAGES.filter(([f]) => fs.existsSync(path.join(ROOT, f)))
    .map(([f, t]) => `- ${t} (${f}): ${metaDesc(f)}`).join("\n") +
    "\nมุมขวาล่างของทุกหน้ามีแชตบอตน้องกระดังงาช่วยตอบคำถาม ถ้ามีประกาศด่วนจาก Instagram จะมีแถบสีทองขึ้นใต้เมนูทุกหน้า");

  // ข่าวสาร
  (KD.news || []).forEach(n => {
    const lines = [`วันที่ ${thDate(n.date)} · ประเภท ${n.type || "ข่าว"}`, n.body];
    if (n.table && n.table.rows) {
      const head = n.table.head || [];
      lines.push(`${n.table.summary || "รายละเอียด"}:`);
      n.table.rows.forEach(r => lines.push("- " + r.map((c, i) => head[i] ? `${head[i]} ${c}` : c).join(" · ")));
    }
    if (n.album) lines.push(`มีภาพในอัลบั้มที่หน้าภาพกิจกรรม (gallery.html)`);
    if (n.link) lines.push(`ลิงก์ที่เกี่ยวข้อง: ${n.linkText || ""} (${n.link})`);
    if (n.link2) lines.push(`ลิงก์ที่เกี่ยวข้อง: ${n.linkText2 || ""} (${n.link2})`);
    add(`ข่าว: ${n.title}`, "news.html", lines.filter(Boolean).join("\n"));
  });

  // บุนนาคเกมส์
  if (fs.existsSync(path.join(ROOT, "games.html"))) {
    let t = pageText("games.html");
    const ck = pageConst("games.html", "CK");
    if (ck) t += "\n\nเช็กลิสต์ฉากเบื้องหลังสแตนด์ (20 ข้อ ข้อละ 5 คะแนน):\n" +
      ck.map(([h, items], i) => `${i + 1}. ${h}: ${items.join(" / ")}`).join("\n");
    add("บุนนาคเกมส์ 2569 สรุปกติกาและสิ่งที่ต้องรู้", "games.html", t);
  }

  // ทำเนียบครู
  const T = KD.teachers || [];
  if (T.length) add(`ทำเนียบครูที่ปรึกษาคณะสีกระดังงา (${T.length} ท่าน)`, "teachers.html",
    T.map(t => `- ${t.name} ครูที่ปรึกษา ${t.room}${t.group ? ` กลุ่มสาระ/ฝ่าย ${t.group}` : ""}${t.role ? ` หน้าที่ ${t.role}` : ""}`).join("\n"));

  // เวรประจำจุดของครู
  const DU = KD.duty || [], DM = KD.dutyMeta || {};
  if (DU.length) {
    const who = [...new Set(DU.flatMap(d => d.teachers))];
    add(`${DM.title || "เวรประจำจุดของครูคณะสี"} (${DM.day || ""})`, "duty.html", [
      `ครูคณะสีกระดังงาลงเวรประจำจุด${DM.day || ""} ${new Set(DU.map(d => d.spot)).size} จุด ${DU.length} ช่วงเวร คุณครู ${who.length} ท่าน${DM.note ? ` ${DM.note}` : ""}`,
      "แยกตามจุด:",
      ...DU.map(d => `- จุดที่ ${d.spot} ${d.place} เวลา ${d.time} (ช่วง${d.period}): ${d.teachers.length ? d.teachers.join(", ") : "ยังไม่มีครูลงเวร"}`),
      "แยกตามครู:",
      ...who.map(n => `- ${n}: ` + DU.filter(d => d.teachers.includes(n)).map(d => `จุดที่ ${d.spot} ${d.place} ${d.time}`).join(" และ ")),
      DM.checked && `ข้อมูลตรวจเมื่อ ${DM.checked} ถ้าข้อมูลไม่ถูกต้องให้แจ้งหัวหน้าคณะสี`
    ].filter(Boolean).join("\n"));
  }

  // ทำเนียบนักเรียน
  const G = KD.studentGroups || [];
  if (G.length) add("ทำเนียบนักเรียนผู้มีหน้าที่ในคณะสี", "students.html",
    G.map(g => `${g.group}:\n` + (g.members || []).map(m =>
      `- ${m.name}${m.nick ? ` (${m.nick})` : ""} ห้อง ${m.room}${m.role ? ` หน้าที่ ${m.role}` : ""}`).join("\n")).join("\n") +
    ((KD.studentPending || []).length ? `\nฝ่ายที่ยังรวบรวมรายชื่อ: ${KD.studentPending.join(", ")}` : "") +
    "\nทำเนียบแสดงเฉพาะรูป ชื่อ ชื่อเล่น ห้อง และหน้าที่ ไม่แสดงเลขประจำตัวหรือข้อมูลติดต่อ");

  // อัลบั้มภาพ
  const A = KD.albums || [];
  if (A.length) add("อัลบั้มภาพกิจกรรม", "gallery.html", A.map(a => {
    const n = (KD.photos || []).filter(p => p.album === a.id).length;
    return `- ${a.title} (${thDate(a.date)}): ${a.desc || ""}${n ? ` มี ${n} ภาพ` : ""}`;
  }).join("\n") + "\n" + pageText("gallery.html"));

  // ความทรงจำ
  const ach = KD.achievements || [], mem = KD.memories || [];
  if (ach.length || mem.length) add("ผลงาน รางวัล และเรื่องเล่าความทรงจำ", "memories.html", [
    ach.length && "ผลงานและหมุดหมาย:\n" + ach.map(a => `- ปีการศึกษา ${a.year}: ${a.title} ${a.event}`).join("\n"),
    mem.length && "เรื่องเล่า:\n" + mem.map(m => `- ${m.title} (${thDate(m.date)}): ${m.text}`).join("\n")
  ].filter(Boolean).join("\n"));

  // คลิป TikTok
  const TF = KD.tiktokFeed || {}, TC = KD.tiktok || {};
  const tHide = (TC.hideWords || []).map(w => w.toLowerCase());
  const clips = (TF.videos || []).filter(v => {
    const c = (TC.clips || {})[v.id] || {};
    return !c.hide && !tHide.some(w => String(v.desc || "").toLowerCase().includes(w));
  });
  if (clips.length || TF.profile) {
    const P = TF.profile || {};
    add("คลิป TikTok ของคณะสี", "tiktok.html", [
      `ช่อง TikTok ${S.tiktokName || "@" + (TF.account || "")}${P.followers != null ? ` ผู้ติดตาม ${P.followers} คน` : ""}${P.videos != null ? ` มี ${P.videos} คลิป` : ""}`,
      ...clips.map(v => {
        const c = (TC.clips || {})[v.id] || {};
        const title = c.title || clean(v.desc).split("\n")[0] || "คลิปคณะสี";
        return `- ${title} (${thDate(v.date)}${v.views != null ? ` ยอดดู ${v.views}` : ""})${c.note ? `: ${c.note}` : ""}`;
      })
    ].join("\n"));
  }

  // โพสต์ Instagram
  const IF = KD.instagramFeed || {}, IC = KD.instagram || {};
  const iHide = (IC.hideWords || []).map(w => w.toLowerCase());
  const posts = (IF.posts || []).filter(p => {
    const c = (IC.posts || {})[p.id] || {};
    return !c.hide && !iHide.some(w => String(p.caption || "").toLowerCase().includes(w));
  });
  if (posts.length || IF.profile) {
    const P = IF.profile || {};
    add("โพสต์ Instagram ของคณะสี", "instagram.html", [
      `Instagram ${S.instagramName || "@" + (IF.account || "")}${P.followers != null ? ` ผู้ติดตาม ${P.followers} คน` : ""}${P.posts != null ? ` มีทั้งหมด ${P.posts} โพสต์` : ""} โพสต์ใหม่ขึ้นเว็บเองทุก 2 ชั่วโมง`,
      ...posts.map(p => {
        const c = (IC.posts || {})[p.id] || {};
        const title = c.title || clean(p.caption).split("\n")[0] || "โพสต์คณะสี";
        return `- ${title} (${thDate(p.date)})${c.note ? `: ${c.note}` : ""}`;
      })
    ].join("\n"));
  }

  // ข้อความแนะนำของหน้าอื่น ๆ
  [["students.html", "หน้าทำเนียบนักเรียน"], ["memories.html", "หน้าความทรงจำ"]].forEach(([f, t]) => {
    if (fs.existsSync(path.join(ROOT, f))) add(`ข้อความใน${t}`, f, pageText(f));
  });

  const kb = {
    name: B.name || "น้องกระดังงา",
    site: "https://watpolprot-cloud.github.io/kradangnga-web/",
    models: B.models || [],
    generation: { temperature: 0.3, maxOutputTokens: 2048 },
    rules: B.rules || [],
    sections
  };
  kb.hash = crypto.createHash("sha1").update(JSON.stringify(kb)).digest("hex").slice(0, 12);
  return kb;
}

const kb = build();
const json = JSON.stringify(kb, null, 1) + "\n";
const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
if (old !== json) fs.writeFileSync(OUT, json);
console.log(`${kb.sections.length} sections, ${Buffer.byteLength(json)} bytes, hash ${kb.hash}${old === json ? " (ไม่เปลี่ยน)" : ""}`);
