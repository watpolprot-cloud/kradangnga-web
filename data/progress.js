// หน้า "ความก้าวหน้าฝ่ายงาน" (progress.html) — ไฟล์นี้แก้ด้วยมือได้ ห้ามใส่รหัส ห้ามใส่ API key
// endpoint: ลิงก์ Web app ของ Apps Script ตัวใหม่ "ระบบรายงานความก้าวหน้า คณะสีกระดังงา" (ลงท้ายด้วย /exec)
//           ไม่ใช่ความลับ ใส่ได้ เพราะทุกคำขอที่ไม่ใช่ public_summary และ login ต้องมีบัตรผ่าน
//           ถ้าเว้นว่าง หน้าเว็บจะแสดง "ระบบยังไม่เปิดใช้งาน"
// โหมดทดสอบ: เปิด progress.html?mock=1 เท่านั้น (ใช้ข้อมูลจำลองใน js/progress.js รหัสทดสอบ MOCK-SET · MOCK-PARADE · MOCK-TEACHER)
window.KD = window.KD || {};
KD.progress = {
  endpoint: "https://script.google.com/macros/s/AKfycbxdIxOX5a60S0cYq7kOVM27Gx1vUD3HS--g5Fqs5ex07BDw8_euLACop6JHR9B6ayKK3w/exec",
  title: "ความก้าวหน้าคณะสีกระดังงา สู่บุนนาคเกมส์ 2569",
  readyDate: "2026-11-10",   // ใช้นับถอยหลังสำรองเมื่อยังต่อตัวกลางไม่ได้
  eventDate: "2026-11-12",
  botName: "ผู้ช่วยวางแผนกระดังงา",
  texts: {
    notReady: "ระบบยังไม่เปิดใช้งาน",
    offline: "ต่อระบบไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง",
    privacy: "ครูคณะสีที่มีรหัสอ่านบทสนทนานี้ย้อนหลังได้",
    loginHint: "รหัสฝ่ายได้จากครูทางแชตส่วนตัว อย่าส่งต่อในกลุ่ม",
    drafting: "กำลังร่างตัวชี้วัด ปกติไม่เกิน 1 ชั่วโมง",
    awaiting: "รอครูอนุมัติแผน",
    thinking: "ผู้ช่วยกำลังคิด…"
  }
};
