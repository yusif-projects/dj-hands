import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initSupportWidget } from './support'
import './styles.css'

initSupportWidget()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
