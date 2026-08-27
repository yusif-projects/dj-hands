import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { trackSupportWidget } from './support'
import './styles.css'

trackSupportWidget()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
