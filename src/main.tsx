import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import { initInstallCapture } from './lib/install'
initInstallCapture()

const container = document.getElementById('root')!
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
