import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import BackupJobs from './pages/BackupJobs'
import CreateBackup from './pages/CreateBackup'
import Restore from './pages/Restore'
import Connectors from './pages/Connectors'
import History from './pages/History'
import Settings from './pages/Settings'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="jobs" element={<BackupJobs />} />
          <Route path="create" element={<CreateBackup />} />
          <Route path="restore" element={<Restore />} />
          <Route path="connectors" element={<Connectors />} />
          <Route path="history" element={<History />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
