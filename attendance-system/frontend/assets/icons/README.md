# 🎨 PWA Icons

## วิธีสร้างไอคอน

### ตัวเลือกที่ 1: ใช้ Generator (แนะนำ - ง่ายที่สุด)
1. เปิดไฟล์ `generate-icons.html` ในเบราว์เซอร์
2. คลิก "สร้างไอคอนทั้งหมด"
3. คลิก "ดาวน์โหลดทั้งหมด"
4. บันทึกไฟล์ทั้งหมดในโฟลเดอร์นี้

### ตัวเลือกที่ 2: ใช้เครื่องมือออนไลน์
1. ไปที่ https://realfavicongenerator.net/
2. อัปโหลดโลโก้ของคุณ (512x512px PNG)
3. ดาวน์โหลดและแตกไฟล์มาที่นี่

### ตัวเลือกที่ 3: ใช้ SVG to PNG Converter
1. ใช้ไฟล์ `icon.svg` ที่มีอยู่
2. แปลงเป็น PNG ขนาดต่างๆ:
   - https://cloudconvert.com/svg-to-png
   - https://svgtopng.com/

## ขนาดไอคอนที่ต้องการ

- ✅ icon-72x72.png
- ✅ icon-96x96.png
- ✅ icon-128x128.png
- ✅ icon-144x144.png
- ✅ icon-152x152.png
- ✅ icon-192x192.png (สำคัญ - Android)
- ✅ icon-384x384.png
- ✅ icon-512x512.png (สำคัญ - Splash screen)

## หมายเหตุ

- ไอคอนควรเป็น PNG แบบ transparent หรือมี background สี
- ขนาดต้องตรงตามที่กำหนด
- ชื่อไฟล์ต้องตรงกับที่ระบุใน `manifest.json`
- สำหรับ iOS ควรมี padding 10-15% รอบๆ ไอคอน

## ตัวอย่างการใช้ Photoshop/Figma

1. สร้าง canvas 512x512px
2. วาดโลโก้ตรงกลาง (ขนาดประมาณ 400x400px)
3. Export เป็น PNG ขนาดต่างๆ
4. ตั้งชื่อตามรูปแบบ `icon-{size}x{size}.png`

## ตัวอย่างการใช้ ImageMagick (Command Line)

```bash
# แปลง SVG เป็น PNG ทุกขนาด
convert icon.svg -resize 72x72 icon-72x72.png
convert icon.svg -resize 96x96 icon-96x96.png
convert icon.svg -resize 128x128 icon-128x128.png
convert icon.svg -resize 144x144 icon-144x144.png
convert icon.svg -resize 152x152 icon-152x152.png
convert icon.svg -resize 192x192 icon-192x192.png
convert icon.svg -resize 384x384 icon-384x384.png
convert icon.svg -resize 512x512 icon-512x512.png
```

## ตรวจสอบไอคอน

หลังจากสร้างไอคอนแล้ว:
1. เปิด DevTools (F12)
2. ไปที่ Application → Manifest
3. เช็คว่าไอคอนแสดงครบทุกขนาด
4. ถ้าไม่แสดง ให้ Clear cache และรีเฟรช
