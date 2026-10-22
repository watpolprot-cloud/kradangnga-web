// ห้องเรียนของคณะสีกระดังงา (สีเขียว) 17 ห้อง และผังการเข้าแถวเคารพธงชาติ ภาคเรียนที่ 2/2569
// รายชื่อห้อง: ไฟล์ข้อมูลกลางของคณะสี (ตรงกับห้องของครูที่ปรึกษาในทำเนียบครูและทะเบียนนักกีฬา)
// จำนวนนักเรียน: นับจากบัญชีรายชื่อนักเรียนในระบบ PROT CARE ของโรงเรียน (ภาคเรียนที่ 1/2569 ดึงเมื่อ 22 ก.ย. 2569) ใส่เฉพาะตัวเลข ไม่มีชื่อหรือเลขประจำตัวนักเรียน
// ครูที่ปรึกษาดึงจาก data/teachers.js ตามช่อง room (แก้ครูที่ปรึกษาที่ไฟล์นั้นไฟล์เดียว)
// เปลี่ยนจำนวนนักเรียน: แก้ total / boys / girls ของห้องนั้น (boys + girls = total)
window.KD = window.KD || {};
KD.roomMeta = {
  countSource: "บัญชีรายชื่อนักเรียนในระบบ PROT CARE ของโรงเรียน ภาคเรียนที่ 1/2569",
  countDate: "2026-09-22",
  assemblyStart: "2026-10-26",
  assemblyImage: "assets/img/gallery/info_assembly_2569-2_v2.jpg"
};
// ในช่องแต่ละชั้น ห้องเลขน้อยอยู่ขวา เลขมากอยู่ซ้าย (หน้าเว็บกลับลำดับเอง เรียงใน KD.rooms จากเลขน้อยไปมากตามปกติ)
// แถวคณะสีจากฝั่งอาคาร 1 ไปฝั่งเสาธงชาติ (หันหน้าไปทางเวที) สีเขียวอยู่แถวที่ 3 · ในแถวเรียง ม.6 ฝั่งอาคาร 1 ไปถึง ม.1 ฝั่งเสาธงชาติ
KD.assemblyHouses = [
  { name: "ปาริชาต", color: "น้ำเงิน", hex: "#3D2FB8" },
  { name: "ราชพฤกษ์", color: "ฟ้า", hex: "#38B6FF" },
  { name: "กระดังงา", color: "เขียว", hex: "#2F8C55", me: true },
  { name: "ศรีตรัง", color: "แดง", hex: "#E8312F" },
  { name: "จามจุรี", color: "ชมพู", hex: "#FF66C4" }
];
KD.rooms = [
  { room: "ม.6/3", total: 40, boys: 11, girls: 29 },
  { room: "ม.6/9", total: 29, boys: 11, girls: 18 },
  { room: "ม.6/14", total: 36, boys: 14, girls: 22 },
  { room: "ม.5/4", total: 40, boys: 21, girls: 19 },
  { room: "ม.5/7", total: 39, boys: 9, girls: 30 },
  { room: "ม.5/11", total: 41, boys: 18, girls: 23 },
  { room: "ม.4/2", total: 27, boys: 9, girls: 18 },
  { room: "ม.4/8", total: 37, boys: 17, girls: 20 },
  { room: "ม.4/13", total: 39, boys: 16, girls: 23 },
  { room: "ม.3/5", total: 37, boys: 22, girls: 15 },
  { room: "ม.3/7", total: 37, boys: 19, girls: 18 },
  { room: "ม.3/12", total: 32, boys: 20, girls: 12 },
  { room: "ม.2/1", total: 36, boys: 18, girls: 18 },
  { room: "ม.2/6", total: 35, boys: 19, girls: 16 },
  { room: "ม.2/12", total: 38, boys: 24, girls: 14 },
  { room: "ม.1/4", total: 40, boys: 16, girls: 24 },
  { room: "ม.1/10", total: 40, boys: 20, girls: 20 }
];
