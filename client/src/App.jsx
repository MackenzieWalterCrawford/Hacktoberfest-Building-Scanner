import React, { useEffect, useState, navType } from "react";
import fs from "fs";




export default function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  


function handleRefresh() {
    // code to run when the page was refreshed
    console.log('page refreshed');
    console.log('component mounted');
    photo_file = form.parse.files
    const res = fetch('http://localhost:4000/exif/exif_parsed', { method: 'POST', body: photo_file })
    console.log('res', res)
    console.log('phto_file', photo_file)
    // form.parse(req, (err, files) => {
    // console.log('form.parse err:', err);
    // console.log('form.parse files:', JSON.stringify(files, null, 2));
    // });
  }


 

  useEffect(() => {
    // navType === 'reload' (or performance.navigation.TYPE_RELOAD) indicates a refresh
    if (navType === 'reload' || navType === 1) {
      handleRefresh();
    //   extractExif(f);
    } 

    }); 

  function onFileChange(e) {
    const f = e.target.files[0]
    setFile(f)
    console.log('file', f)
    setPreview(URL.createObjectURL(f))
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    const form = new FormData()
    form.append('photo', file)
    try {
      const res = await fetch('http://localhost:4000/api/scan', { method: 'POST', body: form })

      // Try to parse JSON; if parsing fails, fall back to raw text so we can debug
      const text = await res.text()
      try {
        const data = JSON.parse(text)
        setResult(data)
      } catch (parseErr) {
        // Show raw text along with status for debugging
        setResult({ error: 'Failed to parse JSON', status: res.status, raw: text })
      }
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }

  }


  return (
    <div className="container">
      <h1>Building Scanner</h1>
      <form onSubmit={onSubmit}>
        <input type="file" accept="image/*" onChange={onFileChange} />
        {preview && <img src={preview} alt="preview" className="preview" />}
        <button type="submit" disabled={loading}>{loading ? 'Scanning...' : 'Scan'}</button>
      </form>

      {result && (
        <div className="result">
          <h2>Result</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
