import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

export default function Home() {
  const [tab, setTab] = useState('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [allFloorplans, setAllFloorplans] = useState([])
  const [loadingAll, setLoadingAll] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState([])
  const [selectedFloorplan, setSelectedFloorplan] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (tab === 'library') loadAllFloorplans()
  }, [tab])

  const loadAllFloorplans = async () => {
    setLoadingAll(true)
    const res = await fetch('/api/list')
    const data = await res.json()
    setAllFloorplans(data.floorplans || [])
    setLoadingAll(false)
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearched(false)
    setSearchResults([])
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      })
      const data = await res.json()
      setSearchResults(data.results || [])
      setSearched(true)
    } catch (err) {
      alert('Search failed: ' + err.message)
    }
    setSearching(false)
  }

  const handleUpload = async (files) => {
    const fileArray = Array.from(files)
    setUploading(true)
    const progress = fileArray.map(f => ({ name: f.name, status: 'pending' }))
    setUploadProgress(progress)

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      setUploadProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'uploading' } : p))

      try {
        const base64 = await fileToBase64(file)
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileBase64: base64,
            fileType: file.type
          })
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setUploadProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'done' } : p))
      } catch (err) {
        setUploadProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error', error: err.message } : p))
      }
    }
    setUploading(false)
  }

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const handleDelete = async (fp) => {
    if (!confirm(`Delete "${fp.file_name}"?`)) return
    await fetch('/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fp.id, file_path: fp.file_path })
    })
    loadAllFloorplans()
  }

  const FloorplanCard = ({ fp, score }) => (
    <div className="fp-card" onClick={() => setSelectedFloorplan(fp)}>
      <div className="fp-thumb">
        {fp.file_url ? (
          <img src={fp.file_url} alt={fp.file_name} />
        ) : (
          <div className="fp-thumb-placeholder">📐</div>
        )}
        {score !== undefined && <div className="fp-score">Match</div>}
      </div>
      <div className="fp-info">
        <div className="fp-name">{fp.file_name.replace(/\.[^/.]+$/, '')}</div>
        {fp.vehicle_type && <div className="fp-type">{fp.vehicle_type}</div>}
        <div className="fp-tags">
          {fp.bedroom && <span className="tag">{fp.bedroom}</span>}
          {fp.bathroom && <span className="tag">{fp.bathroom}</span>}
          {fp.slides && <span className="tag">{fp.slides}</span>}
        </div>
        <div className="fp-desc">{fp.description?.substring(0, 100)}...</div>
      </div>
    </div>
  )

  return (
    <>
      <Head>
        <title>FloorPlan Finder — BSI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="header-inner">
            <div className="logo">
              <span className="logo-icon">⬡</span>
              <span className="logo-text">FloorPlan<em>Finder</em></span>
            </div>
            <nav className="nav">
              <button className={tab === 'search' ? 'nav-btn active' : 'nav-btn'} onClick={() => setTab('search')}>Search</button>
              <button className={tab === 'upload' ? 'nav-btn active' : 'nav-btn'} onClick={() => setTab('upload')}>Upload</button>
              <button className={tab === 'library' ? 'nav-btn active' : 'nav-btn'} onClick={() => setTab('library')}>Library</button>
            </nav>
          </div>
        </header>

        <main className="main">

          {/* SEARCH TAB */}
          {tab === 'search' && (
            <div className="tab-content">
              <div className="search-hero">
                <h1>Find the <em>perfect</em> floorplan</h1>
                <p>Describe what you're looking for in plain English</p>
                <form onSubmit={handleSearch} className="search-form">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="e.g. rear bath, two slides, bunk beds, outdoor kitchen..."
                    className="search-input"
                    disabled={searching}
                  />
                  <button type="submit" className="search-btn" disabled={searching}>
                    {searching ? <span className="spinner" /> : '→'}
                  </button>
                </form>
              </div>

              {searching && (
                <div className="loading-state">
                  <div className="loading-dots"><span /><span /><span /></div>
                  <p>Searching through floorplans...</p>
                </div>
              )}

              {searched && !searching && (
                <div className="results-section">
                  <div className="results-header">
                    <h2>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found</h2>
                    {searchResults.length === 0 && <p className="no-results">No floorplans match your description. Try different keywords or upload more floorplans.</p>}
                  </div>
                  <div className="fp-grid">
                    {searchResults.map(fp => <FloorplanCard key={fp.id} fp={fp} score={fp.score} />)}
                  </div>
                </div>
              )}

              {!searched && !searching && (
                <div className="search-tips">
                  <h3>Search tips</h3>
                  <div className="tips-grid">
                    {[
                      ['🛏', 'Bedroom location', '"front bedroom", "rear bedroom", "bunk beds"'],
                      ['🚿', 'Bathroom style', '"rear bath", "split bath", "outdoor shower"'],
                      ['📐', 'Slides', '"two slides", "three slides", "no slides"'],
                      ['🍳', 'Kitchen', '"island kitchen", "outdoor kitchen", "galley"'],
                      ['🚐', 'Vehicle type', '"Class A", "fifth wheel", "toy hauler"'],
                      ['✨', 'Special features', '"fireplace", "washer dryer", "murphy bed"'],
                    ].map(([icon, title, example]) => (
                      <div key={title} className="tip-card" onClick={() => setSearchQuery(example.replace(/"/g, '').split(',')[0])}>
                        <span className="tip-icon">{icon}</span>
                        <div>
                          <div className="tip-title">{title}</div>
                          <div className="tip-example">{example}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* UPLOAD TAB */}
          {tab === 'upload' && (
            <div className="tab-content">
              <div className="upload-hero">
                <h1>Upload <em>floorplans</em></h1>
                <p>Claude will analyze each image and make it searchable</p>
              </div>

              <div
                className="drop-zone"
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
                onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('drag-over')
                  if (!uploading) handleUpload(e.dataTransfer.files)
                }}
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={e => handleUpload(e.target.files)}
                />
                <div className="drop-zone-inner">
                  <div className="drop-icon">📁</div>
                  <div className="drop-title">Drop floorplan images here</div>
                  <div className="drop-subtitle">or click to browse — JPG, PNG, PDF supported</div>
                  <div className="drop-note">You can upload multiple files at once</div>
                </div>
              </div>

              {uploadProgress.length > 0 && (
                <div className="upload-progress">
                  <h3>Upload Progress</h3>
                  {uploadProgress.map((p, i) => (
                    <div key={i} className={`progress-item status-${p.status}`}>
                      <span className="progress-name">{p.name}</span>
                      <span className="progress-status">
                        {p.status === 'pending' && '⏳ Waiting'}
                        {p.status === 'uploading' && <><span className="spinner-sm" /> Analyzing...</>}
                        {p.status === 'done' && '✅ Done'}
                        {p.status === 'error' && `❌ ${p.error}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LIBRARY TAB */}
          {tab === 'library' && (
            <div className="tab-content">
              <div className="library-hero">
                <h1>Your <em>library</em></h1>
                <p>{allFloorplans.length} floorplan{allFloorplans.length !== 1 ? 's' : ''} stored</p>
              </div>

              {loadingAll ? (
                <div className="loading-state">
                  <div className="loading-dots"><span /><span /><span /></div>
                  <p>Loading library...</p>
                </div>
              ) : (
                <div className="fp-grid">
                  {allFloorplans.map(fp => (
                    <div key={fp.id} className="fp-card-wrapper">
                      <FloorplanCard fp={fp} />
                      <button className="delete-btn" onClick={() => handleDelete(fp)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Modal */}
        {selectedFloorplan && (
          <div className="modal-overlay" onClick={() => setSelectedFloorplan(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedFloorplan(null)}>✕</button>
              <div className="modal-content">
                <div className="modal-image">
                  <img src={selectedFloorplan.file_url} alt={selectedFloorplan.file_name} />
                </div>
                <div className="modal-details">
                  <h2>{selectedFloorplan.file_name.replace(/\.[^/.]+$/, '')}</h2>
                  {selectedFloorplan.vehicle_type && <div className="detail-badge">{selectedFloorplan.vehicle_type}</div>}
                  <p className="modal-desc">{selectedFloorplan.description}</p>
                  <div className="detail-grid">
                    {selectedFloorplan.bedroom && <div className="detail-item"><span>🛏 Bedroom</span><p>{selectedFloorplan.bedroom}</p></div>}
                    {selectedFloorplan.bathroom && <div className="detail-item"><span>🚿 Bathroom</span><p>{selectedFloorplan.bathroom}</p></div>}
                    {selectedFloorplan.kitchen && <div className="detail-item"><span>🍳 Kitchen</span><p>{selectedFloorplan.kitchen}</p></div>}
                    {selectedFloorplan.living_area && <div className="detail-item"><span>🛋 Living</span><p>{selectedFloorplan.living_area}</p></div>}
                    {selectedFloorplan.slides && <div className="detail-item"><span>↔ Slides</span><p>{selectedFloorplan.slides}</p></div>}
                    {selectedFloorplan.special_features && <div className="detail-item"><span>✨ Features</span><p>{selectedFloorplan.special_features}</p></div>}
                  </div>
                  {selectedFloorplan.search_tags?.length > 0 && (
                    <div className="modal-tags">
                      {selectedFloorplan.search_tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
                    </div>
                  )}
                  <a href={selectedFloorplan.file_url} target="_blank" rel="noopener noreferrer" className="view-btn">
                    View Full Size ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        
        :root {
          --black: #0f0f0f;
          --dark: #1a1a1a;
          --card: #222222;
          --border: #333;
          --muted: #666;
          --text: #e8e8e8;
          --accent: #4CB245;
          --accent2: #34AA49;
          --white: #f5f5f5;
        }

        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--black);
          color: var(--text);
          min-height: 100vh;
        }

        em { font-family: 'DM Serif Display', serif; font-style: italic; }

        .app { min-height: 100vh; display: flex; flex-direction: column; }

        .header {
          background: var(--dark);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 100;
        }
        .header-inner {
          max-width: 1200px; margin: 0 auto;
          padding: 0 24px;
          height: 60px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .logo { display: flex; align-items: center; gap: 10px; }
        .logo-icon { color: var(--accent); font-size: 20px; }
        .logo-text { font-size: 18px; font-weight: 600; letter-spacing: -0.5px; }
        .logo-text em { font-size: 20px; }

        .nav { display: flex; gap: 4px; }
        .nav-btn {
          background: none; border: none; color: var(--muted);
          padding: 6px 16px; border-radius: 6px; cursor: pointer;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
          transition: all 0.15s;
        }
        .nav-btn:hover { color: var(--text); background: var(--card); }
        .nav-btn.active { color: var(--accent); background: rgba(76,178,69,0.1); }

        .main { flex: 1; max-width: 1200px; margin: 0 auto; padding: 40px 24px; width: 100%; }
        .tab-content { }

        /* HERO */
        .search-hero, .upload-hero, .library-hero {
          margin-bottom: 40px;
        }
        h1 { font-size: 42px; font-weight: 300; letter-spacing: -1px; line-height: 1.1; margin-bottom: 8px; }
        h1 em { font-size: 46px; color: var(--accent); }
        .search-hero p, .upload-hero p, .library-hero p { color: var(--muted); font-size: 16px; }

        /* SEARCH */
        .search-form { display: flex; gap: 8px; margin-top: 24px; max-width: 700px; }
        .search-input {
          flex: 1; background: var(--card); border: 1px solid var(--border);
          color: var(--text); padding: 14px 18px; border-radius: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 16px;
          transition: border-color 0.15s;
          outline: none;
        }
        .search-input:focus { border-color: var(--accent); }
        .search-input::placeholder { color: var(--muted); }
        .search-btn {
          background: var(--accent); border: none; color: white;
          width: 52px; height: 52px; border-radius: 10px; font-size: 22px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s; flex-shrink: 0;
        }
        .search-btn:hover { background: var(--accent2); }
        .search-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* SPINNER */
        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        .spinner-sm {
          width: 12px; height: 12px;
          border: 2px solid rgba(76,178,69,0.3);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block; vertical-align: middle; margin-right: 4px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* LOADING */
        .loading-state { text-align: center; padding: 60px 0; color: var(--muted); }
        .loading-dots { display: flex; gap: 8px; justify-content: center; margin-bottom: 16px; }
        .loading-dots span {
          width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
          animation: pulse 1.2s ease-in-out infinite;
        }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }

        /* RESULTS */
        .results-header { margin-bottom: 24px; }
        .results-header h2 { font-size: 20px; font-weight: 500; }
        .no-results { color: var(--muted); margin-top: 8px; }

        /* GRID */
        .fp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .fp-card-wrapper { position: relative; }
        .fp-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 12px; overflow: hidden; cursor: pointer;
          transition: all 0.2s; 
        }
        .fp-card:hover { border-color: var(--accent); transform: translateY(-2px); }
        .fp-thumb {
          height: 180px; overflow: hidden; background: #111; position: relative;
          display: flex; align-items: center; justify-content: center;
        }
        .fp-thumb img { width: 100%; height: 100%; object-fit: contain; }
        .fp-thumb-placeholder { font-size: 48px; opacity: 0.3; }
        .fp-score {
          position: absolute; top: 8px; right: 8px;
          background: var(--accent); color: white;
          font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
        }
        .fp-info { padding: 14px; }
        .fp-name { font-weight: 500; font-size: 14px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fp-type { font-size: 12px; color: var(--accent); margin-bottom: 8px; }
        .fp-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
        .tag {
          background: rgba(76,178,69,0.1); border: 1px solid rgba(76,178,69,0.2);
          color: var(--accent); font-size: 11px; padding: 2px 8px; border-radius: 20px;
        }
        .fp-desc { font-size: 12px; color: var(--muted); line-height: 1.5; }

        .delete-btn {
          position: absolute; top: 8px; right: 8px; z-index: 10;
          background: rgba(0,0,0,0.7); border: 1px solid var(--border);
          color: var(--muted); width: 24px; height: 24px; border-radius: 50%;
          cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.15s;
        }
        .fp-card-wrapper:hover .delete-btn { opacity: 1; }
        .delete-btn:hover { background: #c00; color: white; border-color: #c00; }

        /* SEARCH TIPS */
        .search-tips { margin-top: 48px; }
        .search-tips h3 { font-size: 14px; font-weight: 500; color: var(--muted); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px; }
        .tips-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
        .tip-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 10px; padding: 14px; display: flex; gap: 12px; align-items: flex-start;
          cursor: pointer; transition: all 0.15s;
        }
        .tip-card:hover { border-color: var(--accent); }
        .tip-icon { font-size: 20px; flex-shrink: 0; }
        .tip-title { font-size: 13px; font-weight: 500; margin-bottom: 2px; }
        .tip-example { font-size: 11px; color: var(--muted); }

        /* UPLOAD */
        .drop-zone {
          border: 2px dashed var(--border); border-radius: 16px;
          padding: 60px 40px; text-align: center; cursor: pointer;
          transition: all 0.2s; background: var(--card);
        }
        .drop-zone:hover, .drop-zone.drag-over {
          border-color: var(--accent);
          background: rgba(76,178,69,0.05);
        }
        .drop-icon { font-size: 48px; margin-bottom: 16px; }
        .drop-title { font-size: 20px; font-weight: 500; margin-bottom: 8px; }
        .drop-subtitle { color: var(--muted); margin-bottom: 8px; }
        .drop-note { font-size: 13px; color: var(--muted); opacity: 0.6; }

        .upload-progress { margin-top: 32px; }
        .upload-progress h3 { font-size: 16px; font-weight: 500; margin-bottom: 16px; }
        .progress-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 16px; background: var(--card); border: 1px solid var(--border);
          border-radius: 8px; margin-bottom: 8px; font-size: 14px;
        }
        .progress-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 16px; }
        .progress-status { color: var(--muted); flex-shrink: 0; }
        .status-done .progress-status { color: var(--accent); }
        .status-error .progress-status { color: #e55; }

        /* MODAL */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 20px;
        }
        .modal {
          background: var(--dark); border: 1px solid var(--border);
          border-radius: 16px; max-width: 900px; width: 100%;
          max-height: 90vh; overflow-y: auto; position: relative;
        }
        .modal-close {
          position: absolute; top: 16px; right: 16px;
          background: var(--card); border: 1px solid var(--border);
          color: var(--text); width: 32px; height: 32px; border-radius: 50%;
          cursor: pointer; font-size: 14px; z-index: 10;
          display: flex; align-items: center; justify-content: center;
        }
        .modal-content { display: grid; grid-template-columns: 1fr 1fr; min-height: 400px; }
        @media (max-width: 600px) { .modal-content { grid-template-columns: 1fr; } }
        .modal-image {
          background: #111; border-radius: 16px 0 0 16px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
        }
        .modal-image img { width: 100%; height: 100%; object-fit: contain; }
        .modal-details { padding: 28px; }
        .modal-details h2 { font-size: 22px; font-weight: 500; margin-bottom: 8px; }
        .detail-badge {
          display: inline-block; background: rgba(76,178,69,0.1);
          border: 1px solid rgba(76,178,69,0.3); color: var(--accent);
          font-size: 12px; padding: 3px 12px; border-radius: 20px; margin-bottom: 16px;
        }
        .modal-desc { font-size: 14px; color: var(--muted); line-height: 1.6; margin-bottom: 20px; }
        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .detail-item span { font-size: 11px; color: var(--muted); display: block; margin-bottom: 2px; }
        .detail-item p { font-size: 13px; }
        .modal-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
        .view-btn {
          display: inline-block; background: var(--accent); color: white;
          padding: 10px 20px; border-radius: 8px; text-decoration: none;
          font-size: 14px; font-weight: 500; transition: background 0.15s;
        }
        .view-btn:hover { background: var(--accent2); }
      `}</style>
    </>
  )
}
