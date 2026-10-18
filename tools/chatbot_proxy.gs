/**
 * ตัวกลางแชตบอต "น้องกระดังงา" ของเว็บคณะสีกระดังงา
 * https://watpolprot-cloud.github.io/kradangnga-web/
 *
 * หน้าที่: รับคำถามจากหน้าเว็บ แล้วถาม Gemini ด้วย API key ที่เก็บไว้ในโปรเจกต์นี้ (ไม่อยู่ในเว็บ ใครก็มองไม่เห็น)
 * ความรู้ของบอตและกติกาการตอบ ดึงจาก data/chatbot-knowledge.json ของเว็บทุก 10 นาที
 * จึงไม่ต้องกลับมาแก้โค้ดนี้เมื่อเว็บมีข่าวหรือข้อมูลใหม่
 *
 * วิธีตั้งค่า (ทำครั้งเดียว)
 * 1. กดรูปเฟือง "การตั้งค่าโปรเจกต์" ด้านซ้าย > เลื่อนลงไปที่ "พร็อพเพอร์ตีของสคริปต์" > เพิ่ม
 *    ชื่อพร็อพเพอร์ตี: GEMINI_API_KEY   ค่า: API key จาก https://aistudio.google.com/apikey
 * 2. กด "ทำให้ใช้งานได้" > "การทำให้ใช้งานได้รายการใหม่" > ประเภท "เว็บแอป"
 *    เรียกใช้ในฐานะ: ฉัน   ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน > ทำให้ใช้งานได้ > ให้สิทธิ์เข้าถึง
 * 3. คัดลอก URL ของเว็บแอป (ลงท้ายด้วย /exec) ไปใส่ใน endpoint ของ data/chatbot.js
 */

var SITE = 'https://watpolprot-cloud.github.io/kradangnga-web/';
var KNOWLEDGE_URL = SITE + 'data/chatbot-knowledge.json';
var DEFAULT_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];
var DAILY_LIMIT = 1500;        // จำนวนคำถามสูงสุดต่อวัน กันโควตาหมด
var MAX_TURNS = 12;            // จำนวนข้อความล่าสุดที่ส่งให้ AI
var MAX_CHARS = 800;           // ความยาวสูงสุดของคำถามแต่ละข้อความ
var TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
var TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

// เปิดลิงก์เว็บแอปในเบราว์เซอร์เพื่อเช็กว่าพร้อมใช้ไหม
function doGet() {
  return out({ ok: true, name: 'แชตบอตคณะสีกระดังงา', ready: !!apiKey() });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var messages = cleanMessages(req.messages);
    if (!messages.length) return out({ ok: false, error: 'empty' });
    if (!apiKey()) return out({ ok: false, error: 'nokey' });
    if (!countToday()) return out({ ok: false, error: 'limit' });
    var kb = knowledge();
    var page = String(req.page || '').slice(0, 120);
    return out({ ok: true, answer: askGemini(kb, messages, page) });
  } catch (err) {
    console.error(err);
    return out({ ok: false, error: String(err && err.message || err).slice(0, 160) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function apiKey() {
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
}

// รับเฉพาะข้อความผู้ใช้กับคำตอบของบอต ตัดให้สั้น และต้องจบด้วยคำถามของผู้ใช้
function cleanMessages(list) {
  if (!Array.isArray(list)) return [];
  var msgs = list.slice(-MAX_TURNS).map(function (m) {
    return { role: m && m.role === 'bot' ? 'model' : 'user', text: String((m && m.text) || '').trim().slice(0, MAX_CHARS) };
  }).filter(function (m) { return m.text; });
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return [];
  return msgs;
}

// นับคำถามรายวัน (เวลาไทย) เกินวันละ DAILY_LIMIT จะหยุดตอบจนถึงวันถัดไป
function countToday() {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var props = PropertiesService.getScriptProperties();
    var key = 'count-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd');
    var n = Number(props.getProperty(key) || 0);
    if (n >= DAILY_LIMIT) return false;
    props.setProperty(key, String(n + 1));
    if (n === 0) {
      Object.keys(props.getProperties()).forEach(function (k) {
        if (k.indexOf('count-') === 0 && k !== key) props.deleteProperty(k);
      });
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

// ความรู้จากเว็บ เก็บไว้ในแคช 10 นาที (แบ่งเป็นท่อน เพราะแคชเก็บได้ท่อนละไม่เกิน 100KB)
function knowledge() {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('kb-n') || 0);
  if (n) {
    var keys = [];
    for (var i = 0; i < n; i++) keys.push('kb-' + i);
    var got = cache.getAll(keys);
    if (Object.keys(got).length === n) return JSON.parse(keys.map(function (k) { return got[k]; }).join(''));
  }
  var res = UrlFetchApp.fetch(KNOWLEDGE_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('knowledge ' + res.getResponseCode());
  var text = res.getContentText('UTF-8');
  var kb = JSON.parse(text);
  var parts = {}, size = 30000, count = Math.ceil(text.length / size);
  for (var j = 0; j < count; j++) parts['kb-' + j] = text.slice(j * size, (j + 1) * size);
  parts['kb-n'] = String(count);
  try { cache.putAll(parts, 600); } catch (e) { /* แคชไม่ได้ก็ดึงใหม่ครั้งหน้า */ }
  return kb;
}

function thaiToday() {
  var now = new Date();
  var d = Number(Utilities.formatDate(now, 'Asia/Bangkok', 'd'));
  var m = Number(Utilities.formatDate(now, 'Asia/Bangkok', 'M'));
  var y = Number(Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy')) + 543;
  var w = Number(Utilities.formatDate(now, 'Asia/Bangkok', 'u')) % 7;
  return 'วัน' + TH_DAYS[w] + 'ที่ ' + d + ' ' + TH_MONTHS[m - 1] + ' ' + y + ' เวลา ' + Utilities.formatDate(now, 'Asia/Bangkok', 'HH:mm') + ' น.';
}

function systemText(kb, page) {
  var rules = (kb.rules || []).map(function (r, i) { return (i + 1) + '. ' + r; }).join('\n');
  var sections = (kb.sections || []).map(function (s) {
    return '## ' + s.title + (s.url ? '\nหน้าในเว็บ: ' + s.url : '') + '\n' + s.text;
  }).join('\n\n');
  return '# กติกา\n' + rules +
    '\n\n# วันนี้\n' + thaiToday() +
    (page ? '\n\n# หน้าที่ผู้ใช้เปิดอยู่\n' + page : '') +
    '\n\n# ข้อมูลในเว็บ\n' + sections;
}

// ถาม Gemini ทีละรุ่นตามลำดับ ถ้ารุ่นไหนใช้ไม่ได้หรือโควตาเต็ม จะลองรุ่นถัดไป
function askGemini(kb, messages, page) {
  var key = apiKey();
  var models = (kb.models && kb.models.length) ? kb.models : DEFAULT_MODELS;
  var body = {
    systemInstruction: { parts: [{ text: systemText(kb, page) }] },
    contents: messages.map(function (m) { return { role: m.role, parts: [{ text: m.text }] }; }),
    generationConfig: kb.generation || { temperature: 0.3, maxOutputTokens: 2048 }
  };
  var last = '';
  for (var i = 0; i < models.length; i++) {
    var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(models[i]) + ':generateContent', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': key },
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code === 200) {
      var data = JSON.parse(res.getContentText('UTF-8'));
      var cand = (data.candidates || [])[0];
      var parts = (cand && cand.content && cand.content.parts) || [];
      var text = parts.filter(function (p) { return p.text && !p.thought; }).map(function (p) { return p.text; }).join('').trim();
      if (text) return text;
      last = 'empty ' + (cand && cand.finishReason || '');
      continue;
    }
    last = models[i] + ' ' + code;
    if (code === 400 || code === 401 || code === 403) {
      var msg = res.getContentText().slice(0, 300);
      if (/API key|API_KEY|PERMISSION/i.test(msg)) throw new Error('key ' + code);
    }
  }
  throw new Error(last || 'no model');
}

// กดเรียกใช้ฟังก์ชันนี้ในหน้าแก้โค้ดเพื่อทดสอบว่า key ใช้ได้
function testBot() {
  var kb = knowledge();
  console.log(askGemini(kb, [{ role: 'user', text: 'บุนนาคเกมส์ 2569 แข่งวันไหน' }], ''));
}
