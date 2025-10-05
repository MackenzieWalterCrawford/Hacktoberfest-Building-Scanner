const express = require('express');
const fs = require('fs');
const _formidable = require('formidable');
// Handle CommonJS vs ESM export shapes: some versions export a function directly, others export as default
const formidable = (typeof _formidable === 'function') ? _formidable : (_formidable.default || _formidable.formidable || _formidable);
const ExifParser = require('exif-parser');
const OpenAI = require('openai');

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function dmsToDecimal(dms, ref) {
  if (dms == null) return null;

  // If it's already a number (some parsers provide decimal degrees)
  if (typeof dms === 'number') {
    const dec = dms;
    return (ref === 'S' || ref === 'W') ? -dec : dec;
  }

  // If it's an array [deg, min, sec]
  if (Array.isArray(dms)) {
    const [deg = 0, min = 0, sec = 0] = dms;
    let dec = Number(deg) + (Number(min) / 60) + (Number(sec) / 3600);
    if (ref === 'S' || ref === 'W') dec = -dec;
    return dec;
  }

  // If it's an object (some parsers return objects), try to extract numeric values
  if (typeof dms === 'object') {
    // Prefer numeric array-like values
    const vals = Object.values(dms).filter(v => typeof v === 'number');
    if (vals.length >= 3) {
      const [deg = 0, min = 0, sec = 0] = vals;
      let dec = Number(deg) + (Number(min) / 60) + (Number(sec) / 3600);
      if (ref === 'S' || ref === 'W') dec = -dec;
      return dec;
    }

    // As a last resort, try to coerce iterable (some exotic shapes)
    try {
      const arr = Array.from(dms);
      if (arr.length >= 1) {
        const [deg = 0, min = 0, sec = 0] = arr;
        let dec = Number(deg) + (Number(min) / 60) + (Number(sec) / 3600);
        if (ref === 'S' || ref === 'W') dec = -dec;
        return dec;
      }
    } catch (e) {
      // fall through
    }
  }

  // Unknown format
  return null;
}

router.post('/scan', (req, res) => {
  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Upload failed' });
  let file = files && files.photo;
  // formidable may return an array if multiples were used or client sent multiple files
  if (Array.isArray(file)) file = file[0];

  if (!file) return res.status(400).json({ error: 'No file uploaded (field name: photo)' });

    try {
      // Support different formidable versions / shapes: filepath (new), path (old), or in-memory buffer
      const tmpPath = file && (file.filepath || file.path || file.tempFilePath || file.tmpName);
      let buffer;
      if (tmpPath && typeof tmpPath === 'string') {
        buffer = fs.readFileSync(tmpPath);
      } else if (file && file.size && file._writeStream === undefined && file.buffer) {
        // Some setups may provide the uploaded bytes directly in `buffer`
        buffer = file.buffer;
      } else {
        console.error('EXIF parse error: uploaded file missing temporary path or buffer', file);
        return res.status(400).json({ error: 'Uploaded file not available on server (no filepath)', details: null });
      }
      const parser = ExifParser.create(buffer);
      const result = parser.parse();
      // Diagnostic logging to understand the exact shape of GPS EXIF values
      console.log('EXIF tags summary:', {
        hasTags: !!result.tags,
        keys: result.tags ? Object.keys(result.tags).slice(0, 20) : [],
      });
      const lat = result.tags.GPSLatitude;
      const lon = result.tags.GPSLongitude;
      const latRef = result.tags.GPSLatitudeRef;
      const lonRef = result.tags.GPSLongitudeRef;
      console.log('GPS raw values:', { lat, lon, latRef, lonRef });

      if (!lat || !lon) {
        return res.status(400).json({ error: 'No GPS EXIF data found in image' });
      }

      const latitude = dmsToDecimal(lat, latRef);
      const longitude = dmsToDecimal(lon, lonRef);

      // Build prompt
      const prompt = `I have coordinates: ${latitude}, ${longitude}. Return a JSON object with keys: name, address, known_use (e.g., residential, office, landmark), year_built (if known), description (short), and data_source. If unknown, use null. Respond ONLY with JSON.`;

      // Choose model (env override or sensible default)
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

      try {
        const response = await openai.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 400,
        });

        const text = response.choices?.[0]?.message?.content || '';
        let parsed;
        try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text }; }

        return res.json({ latitude, longitude, building: parsed });
      } catch (e) {
        console.error('OpenAI error', e?.response?.data || e.message || e);
        return res.status(500).json({ error: 'Failed to fetch building info from OpenAI' });
      }
    } catch (e) {
      console.error('EXIF parse error', e);
      return res.status(500).json({ error: 'Failed to parse EXIF or read file' });
    } finally {
      // attempt to remove temp uploaded file created by formidable (if any)
      try {
        const cleanupPath = file && (file.filepath || file.path || file.tempFilePath || file.tmpName);
        if (cleanupPath && typeof cleanupPath === 'string') fs.unlinkSync(cleanupPath);
      } catch (_) {}
    }
  });
});

module.exports = router;
