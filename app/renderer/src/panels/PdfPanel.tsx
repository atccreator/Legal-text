// PDF Panel - using SimplePdfViewer with SelectionLayer for text selection and drag
import { SimplePdfViewer } from '../pdf/SimplePdfViewer';

export default function PdfPanel() {
  return (
    <div className="w-full h-full overflow-hidden">
      <SimplePdfViewer />
    </div>
  );
}
