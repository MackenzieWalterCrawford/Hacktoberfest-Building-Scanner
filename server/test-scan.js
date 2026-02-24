const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node test-scan.js <path-to-image>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error('File not found:', imagePath);
  process.exit(1);
}

const form = new FormData();
form.append('photo', fs.createReadStream(imagePath), path.basename(imagePath));

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/scan',
  method: 'POST',
  headers: form.getHeaders(),
};

console.log('Sending', path.basename(imagePath), 'to POST /api/scan ...');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      console.log('Response:', JSON.stringify(JSON.parse(data), null, 2));
    } catch {
      console.log('Response:', data);
    }
  });
});

req.on('error', (e) => console.error('Request failed:', e.message));
form.pipe(req);
