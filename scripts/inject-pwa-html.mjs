import fs from 'node:fs';
import path from 'node:path';

const indexPath = path.resolve(process.argv[2] || 'dist/web/index.html');

if (!fs.existsSync(indexPath)) {
  throw new Error(`index.html was not found at ${indexPath}`);
}

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace('<html lang="en">', '<html lang="ru">');

if (!html.includes('manifest.webmanifest')) {
  const head = `
    <meta name="theme-color" content="#3F51B5" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="PocketLib" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/pwa/icon-192.png" />
  `;
  html = html.replace('</head>', `${head}</head>`);
}

if (!html.includes("navigator.serviceWorker.register('/sw.js')")) {
  const serviceWorker = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function () {});
        });
      }
    </script>
  `;
  html = html.replace('</body>', `${serviceWorker}</body>`);
}

fs.writeFileSync(indexPath, html);
