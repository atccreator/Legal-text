import { UploadButton } from './UploadZone'
import { DocumentTabs } from './DocumentTabs'
import { useLinkStore } from '../store/linkStore'

export function Toolbar() {
  const linksCount = useLinkStore((s) => s.links.length)
  const clearLinks = useLinkStore((s) => s.clearLinks)

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
      {/* Left side - Logo and tabs */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <span className="font-semibold text-gray-800">LegalText</span>
        </div>
        
        <div className="h-6 w-px bg-gray-200" />
        
        <DocumentTabs />
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-3">
        {linksCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {linksCount} link{linksCount !== 1 ? 's' : ''}
            </span>
            <button
              onClick={clearLinks}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
        
        <UploadButton />
      </div>
    </header>
  )
}
