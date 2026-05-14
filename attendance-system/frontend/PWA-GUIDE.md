# 📱 คู่มือ PWA (Progressive Web App)

## ✨ ฟีเจอร์ PWA ที่เพิ่มเข้ามา

### 1. 📲 ติดตั้งเป็น App
- ติดตั้งบนหน้าจอหลักของมือถือ/คอมพิวเตอร์
- เปิดแบบ fullscreen (ไม่มี address bar)
- มีไอคอนเหมือน native app

### 2. 📴 ใช้งานแบบ Offline
- เปิดแอปได้แม้ไม่มีอินเทอร์เน็ต
- แคชหน้าเว็บและ assets สำคัญ
- แสดงข้อมูลที่เคยโหลดไว้

### 3. ⚡ โหลดเร็วขึ้น
- แคช static files (CSS, JS, images)
- ลดการโหลดซ้ำ
- ประสบการณ์ใช้งานที่ลื่นไหล

### 4. 🔔 รองรับ Push Notifications (พร้อมใช้งาน)
- แจ้งเตือนการเช็กชื่อ
- แจ้งเตือนอัพเดทระบบ

---

## 📥 วิธีติดตั้ง PWA

### iOS (iPhone/iPad)
1. เปิด Safari → ไปที่เว็บไซต์
2. กดปุ่ม **Share** (ไอคอนแชร์)
3. เลื่อนลงหา **"Add to Home Screen"**
4. ตั้งชื่อ → กด **Add**
5. ✅ เสร็จแล้ว! ไอคอนจะปรากฏบนหน้าจอหลัก

### Android
1. เปิด Chrome → ไปที่เว็บไซต์
2. กดเมนู **⋮** (มุมขวาบน)
3. เลือก **"Add to Home screen"** หรือ **"Install app"**
4. ตั้งชื่อ → กด **Add**
5. ✅ เสร็จแล้ว! ไอคอนจะปรากฏบนหน้าจอหลัก

### Desktop (Chrome/Edge)
1. เปิดเว็บไซต์
2. ดูที่ address bar → จะมีไอคอน **⊕ Install**
3. คลิก Install
4. ✅ เสร็จแล้ว! เปิดเป็นแอปแยกได้

---

## 🎨 สร้างไอคอน PWA

### วิธีที่ 1: ใช้ Generator (แนะนำ)
1. เปิดไฟล์ `assets/icons/generate-icons.html` ในเบราว์เซอร์
2. คลิก **"สร้างไอคอนทั้งหมด"**
3. คลิก **"ดาวน์โหลดทั้งหมด"**
4. บันทึกไฟล์ทั้งหมดในโฟลเดอร์ `assets/icons/`

### วิธีที่ 2: ใช้เครื่องมือออนไลน์
1. ไปที่ https://realfavicongenerator.net/
2. อัปโหลดโลโก้ของคุณ (แนะนำ 512x512px)
3. ปรับแต่งตามต้องการ
4. ดาวน์โหลดและแตกไฟล์ไปที่ `assets/icons/`

### วิธีที่ 3: ใช้ Photoshop/Figma
สร้างไอคอนขนาดต่างๆ:
- 72x72px
- 96x96px
- 128x128px
- 144x144px
- 152x152px
- 192x192px
- 384x384px
- 512x512px

บันทึกเป็น PNG ชื่อ `icon-{size}x{size}.png`

---

## 🔧 ไฟล์ PWA ที่สำคัญ

### 1. `manifest.json`
- กำหนดชื่อแอป, ไอคอน, สี theme
- ตั้งค่าการแสดงผล (standalone, fullscreen)
- กำหนด start URL

### 2. `service-worker.js`
- จัดการ offline caching
- แคช static files
- รองรับ background sync
- จัดการ push notifications

### 3. `pwa-install.js`
- แสดงปุ่มติดตั้ง
- แสดง install banner
- จัดการ install prompt

---

## 📊 การทำงานของ Service Worker

### Cache Strategy
```
Network First → Cache Fallback
```

1. **HTML Pages**: พยายามโหลดจาก network ก่อน, ถ้าไม่ได้ใช้ cache
2. **Static Assets** (CSS/JS/Images): ใช้ cache ก่อน, อัพเดทใน background
3. **API Calls**: ไม่แคช (ต้องการข้อมูลล่าสุดเสมอ)

### Offline Support
- หน้าเว็บที่เคยเปิดจะใช้งานได้แม้ offline
- ข้อมูลที่แคชไว้จะแสดงได้
- API calls จะรอจนกว่าจะมีเน็ตกลับมา

---

## 🧪 ทดสอบ PWA

### 1. ทดสอบ Offline Mode
```bash
# เปิด DevTools (F12)
# ไปที่ Application → Service Workers
# เช็ค "Offline" checkbox
# รีเฟรชหน้า → ควรโหลดได้ปกติ
```

### 2. ทดสอบ Install
```bash
# เปิด DevTools (F12)
# ไปที่ Application → Manifest
# คลิก "Add to homescreen"
```

### 3. Lighthouse Audit
```bash
# เปิด DevTools (F12)
# ไปที่ Lighthouse
# เลือก "Progressive Web App"
# คลิก "Generate report"
# คะแนนควรได้ 90+ คะแนน
```

---

## 🚀 Deploy PWA

### Render (แนะนำ)
- ✅ รองรับ HTTPS อัตโนมัติ (จำเป็นสำหรับ PWA)
- ✅ Service Worker ทำงานได้ทันที
- ✅ ไม่ต้องตั้งค่าเพิ่ม

### ข้อกำหนด
1. **HTTPS Required** - PWA ต้องใช้ HTTPS (Render ให้ฟรี)
2. **Valid manifest.json** - ต้องมีไอคอนครบ
3. **Service Worker** - ต้อง register สำเร็จ

---

## 📱 ฟีเจอร์เพิ่มเติม (Future)

### 1. Background Sync
- บันทึกการเช็กชื่อแบบ offline
- Sync อัตโนมัติเมื่อมีเน็ตกลับมา

### 2. Push Notifications
- แจ้งเตือนเมื่อถึงเวลาเช็กชื่อ
- แจ้งเตือนนักเรียนขาดเรียน

### 3. Share API
- แชร์รายงานผ่าน native share
- แชร์ QR Code

### 4. Camera API
- เปิดกล้องสแกน QR โดยตรง
- ถ่ายรูปนักเรียนในแอป

---

## ⚠️ ข้อควรระวัง

### iOS Safari
- ต้องเพิ่มผ่าน Safari เท่านั้น (Chrome/Firefox ไม่ได้)
- Service Worker มีข้อจำกัดบางอย่าง
- Push Notifications ยังไม่รองรับ (iOS 16.4+)

### Android
- รองรับครบทุกฟีเจอร์
- แนะนำใช้ Chrome

### Desktop
- รองรับ Chrome, Edge, Opera
- Firefox รองรับบางส่วน
- Safari (macOS) รองรับจำกัด

---

## 🔍 Debug & Troubleshooting

### Service Worker ไม่ทำงาน
```bash
# เช็คว่า register สำเร็จหรือไม่
# เปิด Console (F12)
# ดูข้อความ "Service Worker registered"

# ถ้าไม่เห็น:
1. เช็คว่าใช้ HTTPS หรือ localhost
2. เช็คว่าไฟล์ service-worker.js อยู่ที่ root
3. Clear cache และรีเฟรช (Ctrl+Shift+R)
```

### ไอคอนไม่แสดง
```bash
# เช็คว่าไฟล์ไอคอนมีจริง
# เปิด DevTools → Application → Manifest
# ดู Icons section → ควรเห็นไอคอนทุกขนาด

# ถ้าไม่เห็น:
1. เช็ค path ในไฟล์ manifest.json
2. สร้างไอคอนใหม่ตามขนาดที่กำหนด
3. Clear cache และรีเฟรช
```

### Install Prompt ไม่แสดง
```bash
# เงื่อนไขที่ต้องมี:
1. ✅ HTTPS
2. ✅ manifest.json ถูกต้อง
3. ✅ Service Worker register สำเร็จ
4. ✅ มีไอคอน 192x192 และ 512x512
5. ✅ ยังไม่ได้ติดตั้ง

# ถ้ายังไม่แสดง:
- รอ 30 วินาที (Chrome มี delay)
- ลองปิดเปิดแท็บใหม่
- เช็ค Lighthouse audit
```

---

## 📚 Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Can I Use PWA](https://caniuse.com/?search=pwa)

---

## ✅ Checklist

- [x] สร้าง manifest.json
- [x] สร้าง service-worker.js
- [x] สร้าง pwa-install.js
- [x] เพิ่ม PWA meta tags ในทุกหน้า
- [x] เพิ่ม manifest link ในทุกหน้า
- [ ] สร้างไอคอนทุกขนาด (ใช้ generate-icons.html)
- [ ] ทดสอบ offline mode
- [ ] ทดสอบ install บน iOS
- [ ] ทดสอบ install บน Android
- [ ] ทดสอบ Lighthouse audit (คะแนน 90+)

---

🎉 **ขอให้ใช้งาน PWA สนุก!**
