/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  AlertTriangle,
  RotateCcw,
  Upload,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface QrCameraScannerProps {
  onScan: (scannedText: string) => void;
  onCancel: () => void;
}

type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'permission_denied'
  | 'not_found'
  | 'error'
  | 'scanned';

export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({
  onScan,
  onCancel,
}) => {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [scannedCode, setScannedCode] = useState<string>('');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment'
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Play audio beep feedback on successful scan
  const playBeep = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // AudioContext might be blocked before user interaction; ignore silently
    }
  };

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Handle successful QR detection
  const handleDetected = useCallback(
    (codeText: string) => {
      const clean = codeText.trim();
      if (!clean) return;
      stopCamera();
      playBeep();
      if (navigator.vibrate) {
        try {
          navigator.vibrate(100);
        } catch {
          // ignore
        }
      }
      setScannedCode(clean);
      setStatus('scanned');

      // Short delay so the user sees the confirmation pulse
      setTimeout(() => {
        onScan(clean);
      }, 750);
    },
    [onScan, stopCamera]
  );

  // Continuous frame scanning loop
  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (qrCode && qrCode.data) {
        handleDetected(qrCode.data);
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleDetected]);

  // Request camera access and start stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setStatus('requesting');
    setErrorMessage('');

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setStatus('error');
      setErrorMessage(
        'A API de câmera não é suportada ou está indisponível neste navegador/ambiente.'
      );
      return;
    }

    try {
      // Check multiple video devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch {
        // ignore device enumeration errors
      }

      // Request camera stream (triggers browser permission prompt)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setStatus('active');
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: unknown) {
      console.warn('Erro ao solicitar acesso à câmera:', err);
      const error = err as Error;

      if (
        error.name === 'NotAllowedError' ||
        error.name === 'PermissionDeniedError'
      ) {
        setStatus('permission_denied');
        setErrorMessage(
          'Permissão de acesso à câmera negada. Clique no ícone de cadeado na barra de endereço do seu navegador para permitir a câmera.'
        );
      } else if (
        error.name === 'NotFoundError' ||
        error.name === 'DevicesNotFoundError'
      ) {
        setStatus('not_found');
        setErrorMessage('Nenhuma câmera foi encontrada conectada ao dispositivo.');
      } else {
        setStatus('error');
        setErrorMessage(
          error.message ||
            'Não foi possível inicializar a câmera do dispositivo.'
        );
      }
    }
  }, [facingMode, scanFrame, stopCamera]);

  // Initial startup on mount and cleanup on unmount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Toggle between front and back camera
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Handle image upload with QR code (fallback for devices without camera)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
          if (qrCode && qrCode.data) {
            handleDetected(qrCode.data);
          } else {
            alert(
              'Nenhum QR Code legível foi encontrado nesta imagem. Tente uma foto mais nítida ou aproximada.'
            );
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Test simulator trigger
  const handleSimulate = (code: string) => {
    handleDetected(code);
  };

  return (
    <div className="border border-slate-300 rounded-2xl p-6 sm:p-12 flex flex-col items-center justify-center min-h-[420px] bg-white">
      {/* Viewfinder box matching MacBook Air - 34 with live video */}
      <div className="relative w-80 h-56 sm:w-96 sm:h-64 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
        {/* Live video feed */}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            status === 'active' ? 'opacity-100' : 'opacity-0'
          }`}
          playsInline
          muted
          autoPlay
        />

        {/* Viewfinder Red Corner brackets (Figma style) */}
        <div className="absolute top-2 left-2 w-7 h-7 border-t-3 border-l-3 border-red-600 rounded-tl-sm pointer-events-none z-20" />
        <div className="absolute top-2 right-2 w-7 h-7 border-t-3 border-r-3 border-red-600 rounded-tr-sm pointer-events-none z-20" />
        <div className="absolute bottom-2 left-2 w-7 h-7 border-b-3 border-l-3 border-red-600 rounded-bl-sm pointer-events-none z-20" />
        <div className="absolute bottom-2 right-2 w-7 h-7 border-b-3 border-r-3 border-red-600 rounded-br-sm pointer-events-none z-20" />

        {/* Laser scan line overlay when active */}
        {status === 'active' && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
            <div className="w-full h-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse" />
          </div>
        )}

        {/* STATUS: REQUESTING PERMISSION */}
        {status === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white p-6 text-center z-10">
            <RefreshCw className="w-9 h-9 text-red-500 animate-spin mb-3" />
            <p className="text-sm font-bold text-white mb-1">
              Acessando a câmera...
            </p>
            <p className="text-xs text-slate-300 max-w-xs">
              Por favor, confirme a <strong>permissão de acesso à câmera</strong> na mensagem do seu navegador.
            </p>
          </div>
        )}

        {/* STATUS: PERMISSION DENIED */}
        {status === 'permission_denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 text-white p-6 text-center z-10">
            <AlertTriangle className="w-10 h-10 text-amber-400 mb-2" />
            <p className="text-sm font-bold text-white mb-1">
              Permissão de Câmera Negada
            </p>
            <p className="text-xs text-slate-300 max-w-xs mb-3">
              O navegador bloqueou o acesso à câmera. Permita o uso da câmera nas permissões do site para continuar.
            </p>
            <button
              type="button"
              onClick={startCamera}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Tentar novamente
            </button>
          </div>
        )}

        {/* STATUS: CAMERA NOT FOUND OR ERROR */}
        {(status === 'not_found' || status === 'error') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 text-white p-6 text-center z-10">
            <CameraOff className="w-10 h-10 text-slate-400 mb-2" />
            <p className="text-sm font-bold text-white mb-1">
              Câmera Indisponível
            </p>
            <p className="text-xs text-slate-300 max-w-xs mb-3">
              {errorMessage || 'Não foi possível detectar uma câmera ativa no dispositivo.'}
            </p>
            <button
              type="button"
              onClick={startCamera}
              className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reconectar
            </button>
          </div>
        )}

        {/* STATUS: SCANNED SUCCESS */}
        {status === 'scanned' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/90 text-white p-6 text-center z-30 animate-fadeIn">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
            <p className="text-sm font-bold text-emerald-200">
              QR Code Identificado!
            </p>
            <p className="text-xs text-white font-mono bg-emerald-900/80 px-3 py-1 rounded-md mt-1 border border-emerald-500/40">
              {scannedCode}
            </p>
          </div>
        )}

        {/* Helper text badge when active */}
        {status === 'active' && (
          <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none z-20">
            <span className="bg-black/60 backdrop-blur-xs text-[11px] font-medium text-white px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
              <Camera className="w-3 h-3 text-red-400" />
              Posicione o QR Code no quadro
            </span>
          </div>
        )}
      </div>

      {/* Camera Controls & Utilities */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-xs">
        {hasMultipleCameras && status === 'active' && (
          <button
            type="button"
            onClick={toggleFacingMode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Alternar câmera ({facingMode === 'environment' ? 'Traseira' : 'Frontal'})
          </button>
        )}

        {/* Upload QR image fallback */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-all"
          title="Carregar uma foto ou arquivo com QR Code"
        >
          <Upload className="w-3.5 h-3.5 text-slate-500" />
          Carregar imagem com QR Code
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>

      {/* Simulator helper for testing without physical extinguisher tag */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-2">
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          Testar leitura rápida:
        </span>
        <button
          type="button"
          onClick={() => handleSimulate('SENAI-EXT-009555')}
          className="px-2.5 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-mono"
        >
          009555 (Água 10L - Térreo)
        </button>
        <button
          type="button"
          onClick={() => handleSimulate('SENAI-EXT-045621')}
          className="px-2.5 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-mono"
        >
          045621 (ABC 6kg - Térreo)
        </button>
        <button
          type="button"
          onClick={() => handleSimulate('SENAI-EXT-009640')}
          className="px-2.5 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-mono"
        >
          009640 (CO2 6kg - 1º andar)
        </button>
      </div>

      {/* Bottom Action buttons matching MacBook Air - 34 */}
      <div className="flex items-center gap-4 mt-8">
        <button
          type="button"
          onClick={onCancel}
          className="px-8 py-2.5 bg-white border border-slate-400 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
        >
          Cancelar escaneamento
        </button>
      </div>
    </div>
  );
};
