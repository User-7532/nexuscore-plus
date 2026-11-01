import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { applyAppearance, loadAppearance } from '@/lib/appearance'

// 保存された見た目を、最初の描画の前に当てる
applyAppearance(loadAppearance())

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
