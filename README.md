# เว็บไซต์คณะสีกระดังงา (สีเขียว) · โรงเรียนพรตพิทยพยัต

เว็บของครูและนักเรียนคณะสีกระดังงา รวมข่าวสาร ภาพกิจกรรม ความทรงจำ ทำเนียบครู ทำเนียบนักเรียน และข้อมูลบุนนาคเกมส์ 2569

- เป็นเว็บแบบไฟล์ล้วน (HTML/CSS/JS) ไม่ต้องติดตั้งอะไร เปิด `index.html` ได้ทันที
- ข้อมูลทั้งหมดอยู่ใน `data/*.js` แก้ไขแล้วเว็บเปลี่ยนตาม
- ภาพอยู่ใน `assets/img/` (gallery = ภาพใหญ่, thumbs = ภาพย่อ)
- ฟอนต์ Prompt, Sarabun, Charmonman ใช้ภายใต้สัญญาอนุญาต SIL Open Font License (`assets/fonts/`)

## คลิป TikTok (หน้า tiktok.html)

- GitHub Actions (`.github/workflows/tiktok-sync.yml`) รัน `tools/tiktok_sync.py` วันละ 2 ครั้ง (06.00 และ 18.00 น.) ดึงคลิปจาก TikTok @kradangnga.prot มาไว้ที่ `data/tiktok-feed.js` และภาพปกที่ `assets/img/tiktok/` แล้วบันทึกขึ้นเว็บเอง ไม่ต้องแก้สองที่นี้ด้วยมือ
- อยากดึงทันที: แท็บ Actions > ดึงคลิป TikTok > Run workflow
- ตั้งหมวด คำที่ใช้จัดหมวด ชื่อเรื่องและคำอธิบายรายคลิป หรือซ่อนคลิป แก้ที่ `data/tiktok.js`
- ส่วน "หน้า TikTok ของคณะสี" ใช้ตัวฝังของ TikTok เอง คลิปใหม่ขึ้นทันทีที่โพสต์
- เพราะ Actions บันทึกไฟล์ขึ้น GitHub เอง ก่อนกด Commit ใน GitHub Desktop ให้กด Fetch/Pull origin ก่อนทุกครั้ง
