// Script to add PWA meta tags to all HTML files
const fs = require('fs');
const path = require('path');

const PWA_HEADERS = `
  <!-- PWA Meta Tags -->
  <meta name="description" content="ระบบเช็กชื่อนักเรียนสำหรับครูผู้สอน">
  <meta name="theme-color" content="#4f46e5">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="เช็กชื่อ">
  
  <!-- PWA Icons -->
  <link rel="manifest" href="/manifest.json">
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/icons/icon-192x192.png">
  <link rel="apple-touch-icon" href="/assets/icons/icon-192x192.png">
`;

const PWA_SCRIPT = `
<!-- PWA Install Script -->
<script src="/pwa-install.js"></script>`;

const htmlFiles = [
  'attendance.html',
  'classes.html',
  'profile.html',
  'qrcode.html',
  'report.html',
  'students.html',
  'users.html'
];

htmlFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add PWA headers after <title> tag if not already present
  if (!content.includes('PWA Meta Tags') && content.includes('<title>')) {
    content = content.replace(
      /(<title>.*?<\/title>)/,
      `$1${PWA_HEADERS}`
    );
  }
  
  // Add PWA script before </body> if not already present
  if (!content.includes('pwa-install.js') && content.includes('</body>')) {
    content = content.replace(
      /<\/body>/,
      `${PWA_SCRIPT}\n</body>`
    );
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated: ${file}`);
});

console.log('\n🎉 All HTML files updated with PWA support!');
