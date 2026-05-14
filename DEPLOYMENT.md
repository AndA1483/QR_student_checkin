# 🚀 คู่มือ Deploy ระบบเช็กชื่อนักเรียนบน Render

## 📋 ขั้นตอนการ Deploy

### 1. เตรียม Repository
✅ คุณทำเสร็จแล้ว - โค้ดอยู่บน GitHub แล้ว
- Repository: https://github.com/AndA1483/QR_student_checkin.git

### 2. สร้างบัญชี Render
1. ไปที่ https://render.com
2. คลิก **Sign Up** 
3. เลือก **Sign up with GitHub** (แนะนำ - ง่ายที่สุด)
4. อนุญาตให้ Render เข้าถึง GitHub repository ของคุณ

### 3. Deploy บน Render

#### วิธีที่ 1: ใช้ Blueprint (แนะนำ - ง่ายที่สุด)
1. ไปที่ https://dashboard.render.com
2. คลิก **New +** → เลือก **Blueprint**
3. เชื่อมต่อ GitHub repository: `AndA1483/QR_student_checkin`
4. Render จะอ่านไฟล์ `render.yaml` อัตโนมัติ
5. ตั้งชื่อ Service: `attendance-system` (หรือชื่อที่ต้องการ)
6. คลิก **Apply** → รอ deploy (ประมาณ 3-5 นาที)

#### วิธีที่ 2: สร้าง Web Service เอง
1. ไปที่ https://dashboard.render.com
2. คลิก **New +** → เลือก **Web Service**
3. เชื่อมต่อ repository: `AndA1483/QR_student_checkin`
4. ตั้งค่าดังนี้:
   - **Name**: `attendance-system`
   - **Region**: Singapore (ใกล้ไทยที่สุด)
   - **Branch**: `main`
   - **Root Directory**: `attendance-system`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. คลิก **Advanced** → เพิ่ม **Disk**:
   - **Name**: `attendance-data`
   - **Mount Path**: `/opt/render/project/src/attendance-system/data`
   - **Size**: 1 GB
6. คลิก **Create Web Service**

### 4. รอ Deploy เสร็จ
- ใช้เวลาประมาณ 3-5 นาที
- ดูสถานะได้ที่หน้า Dashboard
- เมื่อเสร็จจะแสดง **Live** สีเขียว

### 5. เข้าใช้งาน
- URL จะเป็น: `https://attendance-system-xxxx.onrender.com`
- Login ด้วย:
  - **Username**: `admin`
  - **Password**: `admin1234`

---

## ⚙️ การตั้งค่าเพิ่มเติม

### 🔒 เปลี่ยนรหัสผ่าน Admin
หลัง deploy เสร็จ ควรเปลี่ยนรหัสผ่าน admin ทันที:
1. Login เข้าระบบ
2. ไปที่เมนู **ผู้ใช้งาน**
3. แก้ไขรหัสผ่าน admin

### 🌐 ใช้ Custom Domain (ถ้าต้องการ)
1. ไปที่ Settings → Custom Domain
2. เพิ่มโดเมนของคุณ (เช่น `attendance.yourschool.com`)
3. ตั้งค่า DNS ตามที่ Render แนะนำ

### 🔄 Auto Deploy
- ทุกครั้งที่ push โค้ดใหม่ไปที่ GitHub
- Render จะ deploy อัตโนมัติ
- ไม่ต้องทำอะไรเพิ่ม

---

## 📊 ข้อมูล Free Tier

| รายการ | ข้อมูล |
|--------|--------|
| ราคา | **ฟรีตลอดไป** |
| RAM | 512 MB |
| CPU | Shared |
| Storage | 1 GB (persistent disk) |
| Bandwidth | 100 GB/เดือน |
| Auto Sleep | หลังไม่ใช้งาน 15 นาที |
| Spin-up Time | 30-60 วินาที |

---

## ⚠️ ข้อควรระวัง

### 1. Auto Sleep
- ระบบจะ sleep หลังไม่มีคนใช้ 15 นาที
- ครั้งแรกที่เปิดหลัง sleep จะช้า 30-60 วินาที
- **แก้ไข**: ใช้ [UptimeRobot](https://uptimerobot.com) ping ทุก 5 นาที (ฟรี)

### 2. Backup ข้อมูล
- ควร backup ไฟล์ `attendance.db` เป็นประจำ
- Download ผ่าน Render Shell:
  ```bash
  # ใน Render Dashboard → Shell
  cat data/attendance.db > /tmp/backup.db
  ```

### 3. การอัพเดทโค้ด
- Push โค้ดใหม่ไปที่ GitHub
- Render จะ deploy อัตโนมัติ
- ข้อมูลใน database จะไม่หาย (เพราะใช้ persistent disk)

---

## 🆘 แก้ปัญหา

### ปัญหา: Deploy ไม่สำเร็จ
1. เช็ค Logs ใน Render Dashboard
2. ตรวจสอบว่า `package.json` มีครบ
3. ตรวจสอบว่า Node version รองรับ (v16+)

### ปัญหา: ข้อมูลหาย
1. ตรวจสอบว่าได้เพิ่ม **Disk** แล้ว
2. Mount Path ต้องเป็น `/opt/render/project/src/attendance-system/data`

### ปัญหา: เข้าไม่ได้
1. ตรวจสอบว่า Service เป็น **Live** (สีเขียว)
2. ลองรอ 1-2 นาที (ถ้าเพิ่ง deploy)
3. เช็ค Logs ว่ามี error อะไร

---

## 📞 ติดต่อ Support

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- GitHub Issues: https://github.com/AndA1483/QR_student_checkin/issues

---

## ✅ Checklist

- [ ] สร้างบัญชี Render
- [ ] เชื่อมต่อ GitHub repository
- [ ] Deploy ด้วย Blueprint หรือ Web Service
- [ ] เพิ่ม Persistent Disk (1 GB)
- [ ] ทดสอบ login (admin / admin1234)
- [ ] เปลี่ยนรหัสผ่าน admin
- [ ] ตั้งค่า UptimeRobot (ถ้าต้องการ)
- [ ] Backup ข้อมูลเป็นประจำ

---

🎉 **ขอให้ deploy สำเร็จ!**
