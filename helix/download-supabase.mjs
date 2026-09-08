// Run with: node download-supabase.mjs
import https from 'https';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const VERSION = '2.95.5';
const URL = `https://github.com/supabase/cli/releases/download/v${VERSION}/supabase_${VERSION}_windows_amd64.tar.gz`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_TAR = path.join(__dirname, 'supabase.tar.gz');
const BIN_DIR = path.join(__dirname, 'bin');

console.log(`Downloading Supabase CLI v${VERSION}...`);

const file = fs.createWriteStream(OUT_TAR);

function download(url) {
  https.get(url, res => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      download(res.headers.location);
      return;
    }
    const total = parseInt(res.headers['content-length'] || '0');
    let received = 0;
    res.on('data', chunk => {
      received += chunk.length;
      if (total) process.stdout.write(`\r${Math.round(received / total * 100)}%`);
    });
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('\nExtracting...');
      fs.mkdirSync(BIN_DIR, { recursive: true });
      execSync(`tar -xzf "${OUT_TAR}" -C "${BIN_DIR}"`);
      fs.unlinkSync(OUT_TAR);
      console.log(`\nDone! Run with: node bin\\supabase.exe --version`);
    });
  }).on('error', err => {
    fs.unlinkSync(OUT_TAR);
    console.error('Download failed:', err.message);
  });
}

download(URL);
