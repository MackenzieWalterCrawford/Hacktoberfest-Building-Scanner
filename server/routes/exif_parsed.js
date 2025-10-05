const express = require('express');
const fs = require('fs');
const ExifParser = require('exif-parser');
const router = express.Router();


  function extractExif(file) {
    try {
      const buffer = fs.readFileSync(file);
      const parser = ExifParser.create(buffer);
      const result = parser.parse();
      console.log(result.tags); // EXIF tags
      return result.tags; // EXIF tags
    } catch (e) {
      console.error('EXIF parse error', e);
      return null;
    }
    } 

// POST /exif-parsed expecting a multer/formidable-saved file path in req.file.path (or adapt to your upload library)
router.post('/exif-parsed', (req, res) => {
  const file = req.file; // if using multer, or adapt depending on your upload parsing
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const tags = extractExif(file.path || file.filepath || file.tempFilePath);
  if (!tags) return res.status(500).json({ error: 'Failed to read EXIF' });
  res.json({ tags });
});

module.exports = router;