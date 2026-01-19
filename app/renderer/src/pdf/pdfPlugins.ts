import { createPluginRegistration } from '@embedpdf/core';

import {
  DocumentManagerPluginPackage,
} from '@embedpdf/plugin-document-manager/react';

import { ViewportPluginPackage } from '@embedpdf/plugin-viewport/react';
import { ScrollPluginPackage } from '@embedpdf/plugin-scroll/react';
import { RenderPluginPackage } from '@embedpdf/plugin-render/react';

// Function to create plugins with dynamic initial documents
export function createPdfPlugins(initialDocumentUrl?: string) {
  return [
    createPluginRegistration(DocumentManagerPluginPackage, {
      initialDocuments: initialDocumentUrl ? [{ url: initialDocumentUrl }] : [],
    }),
    createPluginRegistration(ViewportPluginPackage),
    createPluginRegistration(ScrollPluginPackage, {
      direction: 'vertical',
      gap: 16,
    }),
    createPluginRegistration(RenderPluginPackage),
  ];
}

// Default plugins (no initial document)
export const pdfPlugins = createPdfPlugins();
