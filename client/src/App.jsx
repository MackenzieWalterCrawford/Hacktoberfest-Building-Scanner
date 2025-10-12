import React, { useState } from "react";

export default function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false) 

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
    <div className="app">
      {/* <div className="container"> */}
        <header className="header">
          <h1 className="title" style={{ fontFamily: 'Stencil Std' }}>BUILDING SCANNER</h1>
          {/* <p className="subtitle" style={{ fontFamily: 'inter, sans-serif' }}>Upload a photo to discover building information</p> */}
        </header>

        <form onSubmit={onSubmit} className="upload-form">
          <label className="file-input-label">
            <input
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="file-input"
            />
            <span className="file-input-text">
              {file ? file.name : 'Choose a photo'}
            </span>
          </label>

          {preview && (
            <div className="preview-container">
              <img src={preview} alt="preview" className="preview" />
            </div>
          )}

          {file && (
            <button type="submit" disabled={loading} className="scan-button">
              {loading ? (
                <span className="loading-text">
                  <span className="spinner"></span>
                  Analyzing...
                </span>
              ) : (
                'Scan Building'
              )}
            </button>
          )}
        </form>

        {result && !result.error && (
          <div className="result-card">
            <h2 className="result-title">Building Information</h2>

            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Address</span>
                <span className="info-value">{result.address || 'Unknown'}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Type</span>
                <span className="info-value type-badge">{result.type || 'Unknown'}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Year Built</span>
                <span className="info-value">{result.year_built || 'Unknown'}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Architect</span>
                <span className="info-value">{result.architect || 'Unknown'}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Floors</span>
                <span className="info-value">{result.floors || 'Unknown'}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Height</span>
                <span className="info-value">{result.height || 'Unknown'}</span>
              </div>
            </div>

            {result.fun_facts && result.fun_facts.length > 0 && (
              <div className="fun-facts">
                <h3 className="fun-facts-title">Interesting Facts</h3>
                <ul className="fun-facts-list">
                  {result.fun_facts.map((fact, i) => (
                    <li key={i} className="fun-fact-item">{fact}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {result && result.error && (
          <div className="error-card">
            <h3 className="error-title">Error</h3>
            <p className="error-message">{result.error}</p>
            {result.raw && (
              <details className="error-details">
                <summary>Details</summary>
                <pre className="error-raw">{result.raw}</pre>
              </details>
            )}
          </div>
        )}
      {/* </div> */}
    </div>
  )
}
