const express = require('express');
const fs = require('fs');
const _formidable = require('formidable');
// Handle CommonJS vs ESM export shapes: some versions export a function directly, others export as default
const formidable = (typeof _formidable === 'function') ? _formidable : (_formidable.default || _formidable.formidable || _formidable);
const ExifParser = require('exif-parser');
const Anthropic = require('@anthropic-ai/sdk');
const sharp = require('sharp');

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

      // Build prompt with image
      const promptText =
        `You are a building information assistant. You will receive an image of a building along with approximate GPS coordinates. The coordinates may be 1-2 blocks away from the actual building, so carefully analyze the image to identify the correct building.
        Given the GPS coordinates: Latitude ${latitude}, Longitude ${longitude}, identify the building in the image and provide the following information in JSON format.
        Respond ONLY with valid JSON in this exact structure:

        {
        "address": "full street address",
        "year_built": "year or Unknown",
        "architect": "name or Unknown",
        "floors": "number or Unknown",
        "height": "measurement with units or Unknown",
        "type": "residential/commercial/industrial/mixed-use/institutional/other",
        "fun_facts": ["fact 1", "fact 2", "fact 3"] or []
        }

        Do not include any text outside the JSON object.`;

      // Compress image to reduce API costs and stay within limits
      // Claude supports up to 5MB per image, but smaller is faster and cheaper
      const compressedBuffer = await sharp(buffer)
        .resize(1568, 1568, { // Max dimension Claude recommends for detail
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 }) // Convert to JPEG with good quality
        .toBuffer();

      // Convert compressed image to base64
      const base64Image = compressedBuffer.toString('base64');

      // Use JPEG as media type since we're converting to JPEG
      const mimeType = 'image/jpeg';

      // Choose model (env override or sensible default)
      const model = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219';

      try {

        const response = await anthropic.messages.create({
          model,
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Image,
                }
              },
              {
                type: 'text',
                text: promptText
              }
            ]
          }],
        });

        const text = response.content?.[0]?.text || '';
        let parsed;
        try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text }; }

        return res.json( parsed );
      } catch (e) {
        console.error('Anthropic error', e?.response?.data || e.message || e);
        return res.status(500).json({ error: 'Failed to fetch building info from Claude' });
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
