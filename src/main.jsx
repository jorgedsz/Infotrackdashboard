import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import InfoTrackDashboard from './pages/InfoTrackDashboard.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/infotrack-dashboard" replace />} />
        <Route path="/infotrack-dashboard" element={<InfoTrackDashboard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
