"use client";

import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Eraser, Check } from "lucide-react";

interface SignaturePadProps {
  width?: number;
  height?: number;
  onSave?: (dataUrl: string) => void;
  className?: string;
}

export interface SignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ width = 400, height = 200, onSave, className = "" }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    useImperativeHandle(ref, () => ({
      clear: clearCanvas,
      isEmpty: () => !hasSignature,
      toDataURL: () => canvasRef.current?.toDataURL("image/png") || "",
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set up canvas
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Fill with transparent background
      ctx.fillStyle = "transparent";
      ctx.fillRect(0, 0, width, height);
    }, [width, height]);

    function getCoordinates(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if ("touches" in e) {
        const touch = e.touches[0];
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }

      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function startDrawing(e: React.MouseEvent | React.TouchEvent) {
      const coords = getCoordinates(e);
      if (!coords) return;

      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;

      setIsDrawing(true);
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    }

    function draw(e: React.MouseEvent | React.TouchEvent) {
      if (!isDrawing) return;

      const coords = getCoordinates(e);
      if (!coords) return;

      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;

      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      setHasSignature(true);
    }

    function stopDrawing() {
      setIsDrawing(false);
    }

    function clearCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);
      setHasSignature(false);
    }

    function handleSave() {
      if (!hasSignature || !onSave) return;
      const dataUrl = canvasRef.current?.toDataURL("image/png");
      if (dataUrl) {
        onSave(dataUrl);
      }
    }

    return (
      <div className={`space-y-2 ${className}`}>
        <div className="relative border-2 border-dashed border-[#333] rounded-lg overflow-hidden bg-[#111]">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full touch-none cursor-crosshair"
            style={{ maxWidth: width, height: "auto", aspectRatio: `${width}/${height}` }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          
          {/* Signature line */}
          <div className="absolute bottom-8 left-4 right-4 border-b border-neutral-700" />
          <span className="absolute bottom-2 left-4 text-xs text-neutral-600">Unterschrift</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={clearCanvas}
            className="btn btn-ghost btn-sm flex-1"
          >
            <Eraser className="w-4 h-4" />
            Löschen
          </button>
          {onSave && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasSignature}
              className="btn btn-primary btn-sm flex-1"
            >
              <Check className="w-4 h-4" />
              Übernehmen
            </button>
          )}
        </div>
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";
