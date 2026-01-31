import { createRoot } from 'react-dom/client'
import { enableMapSet } from 'immer'
import App from './src/app/App'
import './src/index.css'

// Enable Immer's MapSet plugin for Map/Set support in Zustand stores
enableMapSet()

console.log('[main.tsx] Starting React application...')

const rootElement = document.getElementById('root')
if (!rootElement) {
  console.error('[main.tsx] Root element not found!')
} else {
  console.log('[main.tsx] Root element found, creating React root...')
  try {
    const root = createRoot(rootElement)
    console.log('[main.tsx] React root created, rendering App...')
    root.render(<App />)
    console.log('[main.tsx] App rendered successfully')
  } catch (error) {
    console.error('[main.tsx] Error rendering App:', error)
    rootElement.innerHTML = `<div style="padding: 20px; color: red;"><h1>Failed to render</h1><pre>${error}</pre></div>`
  }
}