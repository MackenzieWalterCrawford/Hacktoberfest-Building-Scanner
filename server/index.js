const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes/scan');
const exifRouter = require('./routes/exif_parsed');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
// Simple favicon route to avoid 404/error pages returning restrictive headers
app.get('/favicon.ico', (req, res) => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>
    <rect width='16' height='16' rx='3' fill='#1f2937'/>
    <text x='50%' y='50%' font-size='10' fill='white' text-anchor='middle' alignment-baseline='central' font-family='Arial'>B</text>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

app.use('/api', apiRouter);

app.use('/exif', exifRouter);


app.listen(port, () => console.log(`Server listening on ${port}`));
