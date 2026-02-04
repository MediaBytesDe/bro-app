"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Minimize2, RotateCcw } from "lucide-react";

interface ModelViewer3DProps {
  src: string;
  alt?: string;
  poster?: string;
  className?: string;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          poster?: string;
          'camera-controls'?: boolean;
          'auto-rotate'?: boolean;
          'shadow-intensity'?: string;
          'environment-image'?: string;
          'exposure'?: string;
          'tone-mapping'?: string;
          loading?: string;
          reveal?: string;
          orientation?: string;
          'min-camera-orbit'?: string;
          'max-camera-orbit'?: string;
          'camera-target'?: string;
          'interpolation-decay'?: string;
          'orbit-sensitivity'?: string;
          'disable-pan'?: boolean;
        },
        HTMLElement
      >;
    }
  }
}

export function ModelViewer3D({ src, alt = "3D Model", poster, className = "" }: ModelViewer3DProps) {
  const [loaded, setLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Dynamically import model-viewer (client-side only)
    import("@google/model-viewer").then(() => {
      setLoaded(true);
    });
  }, []);

  // Rotation is now handled via orientation attribute (quaternion: -90deg X axis)

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const resetCamera = () => {
    if (modelRef.current) {
      // @ts-ignore - model-viewer methods
      modelRef.current.resetTurntableRotation?.();
      // @ts-ignore
      modelRef.current.jumpCameraToGoal?.();
    }
  };

  if (!loaded) {
    return (
      <div className={`bg-[#111] rounded-xl flex items-center justify-center ${className}`}>
        <div className="text-center text-neutral-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-sm">3D-Modell wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] rounded-xl overflow-hidden ${className} ${isFullscreen ? 'rounded-none' : ''}`}
    >
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <button
          onClick={resetCamera}
          className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white/70 hover:text-white transition-colors"
          title="Kamera zurücksetzen"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white/70 hover:text-white transition-colors"
          title={isFullscreen ? "Vollbild beenden" : "Vollbild"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Help Text */}
      <div className="absolute bottom-3 left-3 z-10 text-xs text-white/50 pointer-events-none">
        Ziehen zum Drehen • Scrollen zum Zoomen
      </div>

      {/* Model Viewer */}
      <model-viewer
        ref={modelRef as any}
        src={src}
        alt={alt}
        poster={poster}
        camera-controls
        shadow-intensity="1"
        exposure="0.8"
        tone-mapping="commerce"
        loading="eager"
        reveal="auto"
        camera-orbit="180deg 45deg auto"
        style={{ 
          width: "100%", 
          height: "100%",
          minHeight: isFullscreen ? "100vh" : "300px",
          "--poster-color": "transparent",
        } as React.CSSProperties}
      />
    </div>
  );
}
