import { useDocumentStore } from '../store/documentStore'

interface DocumentTabsProps {
  className?: string
}

export function DocumentTabs({ className = '' }: DocumentTabsProps) {
  const { documents, activeDocumentId, setActiveDocument, removeDocument } = useDocumentStore()

  if (documents.length === 0) return null

  return (
    <div className={`flex items-center gap-1 overflow-x-auto ${className}`}>
      {documents.map((doc) => (
        <div
          key={doc.id}
          className={`
            group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer
            transition-all duration-150 min-w-0 max-w-[200px]
            ${activeDocumentId === doc.id
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }
          `}
          onClick={() => setActiveDocument(doc.id)}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          
          <span className="truncate text-sm font-medium">
            {doc.name.replace('.pdf', '')}
          </span>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeDocument(doc.id)
            }}
            className={`
              p-0.5 rounded opacity-0 group-hover:opacity-100 
              transition-opacity duration-150
              hover:bg-gray-300/50
            `}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
