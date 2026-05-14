# 🚀 วิธี Push โปรเจคไปที่ GitHub

## ขั้นตอนที่ 1: สร้าง Repository บน GitHub

1. ไปที่ https://github.com
2. คลิก **"New repository"** (ปุ่มสีเขียว)
3. ตั้งชื่อ repository เช่น `attendance-system` หรือ `QR-student-checkin`
4. เลือก **Public** หรือ **Private**
5. **อย่าเลือก** "Initialize this repository with a README"
6. คลิก **"Create repository"**

## ขั้นตอนที่ 2: เชื่อมต่อกับ GitHub

หลังจากสร้าง repository แล้ว GitHub จะแสดง URL ให้ เช่น:
```
https://github.com/YOUR_USERNAME/attendance-system.git
```

รันคำสั่งนี้ใน terminal (แทนที่ URL ด้วย URL ของคุณ):

```bash
# เพิ่ม remote repository
git remote add origin https://github.com/YOUR_USERNAME/attendance-system.git

# เปลี่ยน branch เป็น main (ถ้าต้องการ)
git branch -M main

# Push ไปที่ GitHub
git push -u origin main
```

## ขั้นตอนที่ 3: ตรวจสอบ

ไปที่ GitHub repository ของคุณ จะเห็นไฟล์ทั้งหมดแล้ว! 🎉

---

## คำสั่ง Git ที่ใช้บ่อย

### Push การเปลี่ยนแปลงใหม่:
```bash
git add .
git commit -m "your commit message"
git push
```

### ดูสถานะ:
```bash
git status
```

### ดูประวัติ commit:
```bash
git log --oneline
```

### ดู remote repository:
```bash
git remote -v
```

---

## ⚠️ หมายเหตุ

- ไฟล์ `attendance.db` จะไม่ถูก push ขึ้น GitHub (อยู่ใน .gitignore)
- `node_modules/` จะไม่ถูก push ขึ้น GitHub (อยู่ใน .gitignore)
- คนอื่นที่ clone โปรเจคต้องรัน `npm install` เพื่อติดตั้ง dependencies

---

## 🔐 การใช้ Personal Access Token (ถ้า GitHub ขอ)

ถ้า GitHub ขอ password แต่ไม่ยอมรับ ให้ใช้ Personal Access Token แทน:

1. ไปที่ GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. คลิก "Generate new token (classic)"
3. เลือก scope: `repo` (ทั้งหมด)
4. คัดลอก token ที่ได้
5. ใช้ token นี้แทน password เมื่อ push

หรือใช้ GitHub CLI:
```bash
gh auth login
```
