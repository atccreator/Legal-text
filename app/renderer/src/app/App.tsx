import { useState, useEffect } from 'react'
import Layout from './Layout'

export default function App() {
  const [hasError, setHasError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      console.error('[App] Global error:', e.error)
      setHasError(true)
      setErrorMsg(e.message || 'Unknown error')
    }
    
    const handleRejection = (e: PromiseRejectionEvent) => {
      console.error('[App] Unhandled rejection:', e.reason)
      setHasError(true)
      setErrorMsg(e.reason?.message || 'Unhandled promise rejection')
    }
    
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    
    console.log('[App] Component mounted successfully')
    
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])
  
  if (hasError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-red-50 p-8">
        <div className="max-w-lg bg-white p-6 rounded-lg shadow-lg border border-red-200">
          <h1 className="text-xl font-bold text-red-700 mb-2">Application Error</h1>
          <p className="text-red-600">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
  
  return <Layout />
}
