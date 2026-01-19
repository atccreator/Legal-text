// export default function PdfPanel() {
//   return (
//     <div className="h-full flex items-center justify-center text-gray-500">
//       PDF Panel
//     </div>
//   )
// }


import { PdfViewer } from '../pdf/PdfViewer';

export default function PdfPanel() {
  return (
    <div className="w-full h-full overflow-hidden">
      <PdfViewer />
    </div>
  );
}
