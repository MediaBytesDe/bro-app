'use client';

import { lazy, Suspense } from 'react';

const ModelViewer3D = lazy(() => import('./model-viewer-3d').then(mod => ({ default: mod.ModelViewer3D })));

interface LazyModelViewerProps {
  src: string;
  alt?: string;
  poster?: string;
  className?: string;
}

export default function LazyModelViewer({ src, alt, poster, className }: LazyModelViewerProps) {
  return (
    <Suspense
      fallback={
        <div className={`w-full bg-neutral-800 rounded-lg flex items-center justify-center ${className}`}>
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="ml-4 text-neutral-400">Lade 3D-Viewer...</p>
          </div>
        </div>
      }
    >
      <ModelViewer3D src={src} alt={alt} poster={poster} className={className} />
    </Suspense>
  );
}
