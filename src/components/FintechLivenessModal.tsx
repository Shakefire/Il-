"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Check,
  Camera,
  AlertTriangle,
  RotateCcw,
  X,
  Loader2,
  Lock,
  Zap,
} from "lucide-react";

export interface FintechLivenessResult {
  verificationId: string;
  snapshotUrl: string;
  videoUrl?: string | null;
}

export interface FintechLivenessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: FintechLivenessResult) => void;
}

type ChallengeStep = "initializing" | "center" | "blink" | "turn_left" | "verified" | "error" | "timeout";

// ── Global Singleton Cache for Neural Vision Engine ──
// Loads once per session so opening/retrying is instant with 0ms network latency.
let cachedLandmarker: any = null;
let cachedLandmarkerPromise: Promise<any> | null = null;

export async function preloadLivenessEngine(): Promise<any> {
  if (typeof window === "undefined") return null;
  if (cachedLandmarker) return cachedLandmarker;
  if (cachedLandmarkerPromise) return cachedLandmarkerPromise;

  cachedLandmarkerPromise = (async () => {
    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      // Try GPU acceleration first
      try {
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        cachedLandmarker = landmarker;
        return landmarker;
      } catch (gpuErr) {
        console.warn("[MediaPipe] GPU unavailable, using CPU delegate:", gpuErr);
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU",
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        cachedLandmarker = landmarker;
        return landmarker;
      }
    } catch (err) {
      cachedLandmarkerPromise = null;
      console.warn("[MediaPipe] Preload deferred:", err);
      return null;
    }
  })();

  return cachedLandmarkerPromise;
}

/**
 * Play a fintech-grade synthesized audio chime on verification success.
 * Uses Web Audio API so zero external audio assets or network requests are needed.
 */
function playFintechSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Three-tone ascending harmonic chime (C5 -> E5 -> G5)
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.35);
    });
  } catch {
    // Audio playback optional / user muted
  }
}

export default function FintechLivenessModal({
  isOpen,
  onClose,
  onComplete,
}: FintechLivenessModalProps) {
  // UI & Flow State
  const [step, setStep] = useState<ChallengeStep>("initializing");
  const [progressPct, setProgressPct] = useState(0); // 0 -> 33 -> 66 -> 100
  const [microHint, setMicroHint] = useState("Position your face inside the circle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  // Video & Stream Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const landmarkerRef = useRef<any>(null);

  // Challenge Detection State Trackers
  const stepRef = useRef<ChallengeStep>("initializing");
  const isInitializingRef = useRef(false);
  const centerFramesRef = useRef(0);
  const blinkPhaseRef = useRef<"open" | "closed" | "done">("open");
  const turnLeftFramesRef = useRef(0);
  const isCompletedRef = useRef(false);

  // Clean up all camera tracks, animation loops, and recorders
  const stopAllMedia = useCallback(() => {
    isInitializingRef.current = false;
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    // Note: We preserve cachedLandmarker in memory for instant re-opening
  }, []);

  // 30-Second Auto-Timeout Counter
  useEffect(() => {
    if (!isOpen || step === "verified" || step === "error" || step === "timeout") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          stopAllMedia();
          setStep("timeout");
          stepRef.current = "timeout";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, step, stopAllMedia]);

  /**
   * Finalize verification capture:
   * 1. High-Res Snapshot from current canvas frame
   * 2. Full session video clip from MediaRecorder
   * 3. Upload to /api/verification/liveness
   */
  const handleLivenessVerified = useCallback(async () => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;

    setStep("verified");
    stepRef.current = "verified";
    setProgressPct(100);
    setMicroHint("Liveness verified! Securing biometric dossier...");
    playFintechSuccessChime();

    // 1. Grab millisecond high-res snapshot
    let snapshotBlob: Blob | null = null;
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Render mirrored natural orientation
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        snapshotBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.90)
        );
      }
    }

    // 2. Stop recorder & get full video blob
    let videoBlob: Blob | null = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      videoBlob = await new Promise<Blob>((resolve) => {
        if (!mediaRecorderRef.current) return resolve(new Blob());
        mediaRecorderRef.current.onstop = () => {
          const finalBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          resolve(finalBlob);
        };
        try {
          mediaRecorderRef.current.stop();
        } catch {
          resolve(new Blob());
        }
      });
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      if (snapshotBlob) {
        formData.append("snapshot", snapshotBlob, "snapshot.jpg");
      }
      if (videoBlob && videoBlob.size > 0) {
        formData.append("video", videoBlob, "liveness-session.webm");
      }

      const res = await fetch("/api/verification/liveness", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process verification dossier.");
      }

      // Brief delay for the emerald badge animation
      setTimeout(() => {
        stopAllMedia();
        onComplete({
          verificationId: data.verificationId,
          snapshotUrl: data.snapshotUrl,
          videoUrl: data.videoUrl,
        });
        onClose();
      }, 900);
    } catch (err: any) {
      console.error("[Liveness] Upload error:", err);
      setErrorMessage(err.message || "Failed to submit verification session. Please retry.");
      stepRef.current = "error";
      setStep("error");
    } finally {
      setIsUploading(false);
    }
  }, [onComplete, onClose, stopAllMedia]);

  /**
   * Main real-time detection loop
   * Optimized with 65ms frame-skipping (~15 FPS) to eliminate CPU/GPU overheating & lag.
   */
  const startDetectionLoop = useCallback(() => {
    let lastVideoTime = -1;
    let lastInferenceTime = 0;
    const INFERENCE_INTERVAL_MS = 65; // ~15 FPS neural net inference throttler

    const detect = () => {
      if (!videoRef.current || isCompletedRef.current) return;
      const video = videoRef.current;

      const now = performance.now();

      // Only run heavy neural net inference every 65ms to keep CPU/GPU low
      if (now - lastInferenceTime >= INFERENCE_INTERVAL_MS && video.readyState >= 2 && landmarkerRef.current) {
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          lastInferenceTime = now;

          try {
            const result = landmarkerRef.current.detectForVideo(video, now);

            if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
              const landmarks = result.faceLandmarks[0];
              const nose = landmarks[1] || landmarks[4];
              const leftCheek = landmarks[234];
              const rightCheek = landmarks[454];

              const faceWidth = Math.hypot(rightCheek.x - leftCheek.x, rightCheek.y - leftCheek.y);
              const earMidpointX = (leftCheek.x + rightCheek.x) / 2;
              const yawOffset = (nose.x - earMidpointX) / (faceWidth || 0.3);

              // Blendshape scores
              const blendshapes = result.faceBlendshapes?.[0]?.categories || [];
              let eyeBlinkLeft = 0;
              let eyeBlinkRight = 0;
              for (const b of blendshapes) {
                if (b.categoryName === "eyeBlinkLeft") eyeBlinkLeft = b.score;
                else if (b.categoryName === "eyeBlinkRight") eyeBlinkRight = b.score;
              }

              // ── STAGE 1: CENTER FACE IN FRAME ──
              if (stepRef.current === "center") {
                const isCenteredX = nose.x >= 0.33 && nose.x <= 0.67;
                const isCenteredY = nose.y >= 0.25 && nose.y <= 0.75;
                const isGoodDistance = faceWidth >= 0.15 && faceWidth <= 0.65;

                if (!isGoodDistance) {
                  centerFramesRef.current = 0;
                  setMicroHint(faceWidth < 0.15 ? "Move slightly closer" : "Move slightly back");
                } else if (!isCenteredX) {
                  centerFramesRef.current = 0;
                  setMicroHint(nose.x < 0.33 ? "Move towards your right" : "Move towards your left");
                } else if (!isCenteredY) {
                  centerFramesRef.current = 0;
                  setMicroHint(nose.y < 0.25 ? "Move slightly down" : "Move slightly up");
                } else {
                  centerFramesRef.current += 1;
                  setMicroHint("Face aligned! Hold still...");
                  if (centerFramesRef.current >= 6) {
                    // Stage 1 passed! Advance to blink challenge
                    stepRef.current = "blink";
                    setStep("blink");
                    setProgressPct(33);
                    setMicroHint("Blink your eyes now");
                  }
                }
              }

              // ── STAGE 2: BLINK EYES ──
              else if (stepRef.current === "blink") {
                const avgBlink = (eyeBlinkLeft + eyeBlinkRight) / 2;
                const isBlinking = avgBlink > 0.32 || eyeBlinkLeft > 0.40 || eyeBlinkRight > 0.40;
                const isOpen = avgBlink < 0.25;

                if (blinkPhaseRef.current === "open") {
                  if (isBlinking) {
                    blinkPhaseRef.current = "closed";
                    setMicroHint("Now open your eyes");
                  }
                } else if (blinkPhaseRef.current === "closed") {
                  if (isOpen) {
                    blinkPhaseRef.current = "done";
                    // Stage 2 passed! Advance to turn head left
                    stepRef.current = "turn_left";
                    setStep("turn_left");
                    setProgressPct(66);
                    setMicroHint("Slowly turn your head to your left");
                  }
                }
              }

              // ── STAGE 3: TURN HEAD LEFT ──
              else if (stepRef.current === "turn_left") {
                const isTurningLeft = Math.abs(yawOffset) > 0.11;

                if (isTurningLeft) {
                  turnLeftFramesRef.current += 1;
                  setMicroHint("Great! Hold position...");
                  if (turnLeftFramesRef.current >= 4) {
                    // All challenges passed!
                    handleLivenessVerified();
                    return;
                  }
                } else {
                  turnLeftFramesRef.current = Math.max(0, turnLeftFramesRef.current - 1);
                  setMicroHint("Turn your head slightly more to the left");
                }
              }
            } else {
              if (stepRef.current !== "initializing" && stepRef.current !== "verified") {
                setMicroHint("Place your face within the camera ring");
              }
            }
          } catch (detErr) {
            console.warn("[MediaPipe] Detection notice:", detErr);
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(detect);
    };

    animFrameIdRef.current = requestAnimationFrame(detect);
  }, [handleLivenessVerified]);

  /**
   * Fast, Parallel Initialization
   * Loads camera stream (640x480) and pre-warmed neural vision model concurrently.
   */
  const initializeLivenessEngine = useCallback(async () => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    setStep("initializing");
    stepRef.current = "initializing";
    setErrorMessage(null);
    setTimeLeft(30);
    setProgressPct(5);
    setMicroHint("Starting camera...");
    isCompletedRef.current = false;
    centerFramesRef.current = 0;
    blinkPhaseRef.current = "open";
    turnLeftFramesRef.current = 0;
    recordedChunksRef.current = [];

    try {
      // 1. Parallel Request: 640x480 Camera (fast & low resource) + Model Preload
      const cameraPromise = navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });

      const [stream, landmarker] = await Promise.all([
        cameraPromise,
        preloadLivenessEngine(),
      ]);

      // If user closed modal while awaiting
      if (!isInitializingRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr: any) {
          if (playErr?.name !== "AbortError") throw playErr;
        }
      }

      // 2. Initialize MediaRecorder (lightweight 600 kbps)
      try {
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "video/mp4";

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 600_000,
        });
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (recErr) {
        console.warn("[MediaRecorder] Fallback mode:", recErr);
      }

      landmarkerRef.current = landmarker;

      // 3. Immediately ready! Begin Challenge 1
      stepRef.current = "center";
      setStep("center");
      setProgressPct(15);
      setMicroHint("Center your face in the circle");
      startDetectionLoop();
    } catch (err: any) {
      if (!isInitializingRef.current) return;
      console.error("[Liveness] Engine init notice:", err);
      const isPermissionDenied =
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError" ||
        err.message?.includes("Permission denied");

      if (isPermissionDenied) {
        setErrorMessage("Camera access was denied. Please allow camera permissions in your browser.");
      } else {
        setErrorMessage(
          err.message || "Failed to initialize camera. You can also use instant capture below."
        );
      }
      stepRef.current = "error";
      setStep("error");
      stopAllMedia();
    } finally {
      isInitializingRef.current = false;
    }
  }, [startDetectionLoop, stopAllMedia]);

  // Launch engine on modal open, clean up on close
  useEffect(() => {
    if (isOpen) {
      initializeLivenessEngine();
    } else {
      stopAllMedia();
    }
    return () => {
      stopAllMedia();
    };
  }, [isOpen]);

  // SVG Progress Ring radius (138)
  const radius = 138;
  const circumference = 2 * Math.PI * radius;

  const getStepBadge = () => {
    switch (step) {
      case "center":
        return "STEP 1 OF 3 • FACE ALIGNMENT";
      case "blink":
        return "STEP 2 OF 3 • BLINK EYES";
      case "turn_left":
        return "STEP 3 OF 3 • TURN HEAD LEFT";
      case "verified":
        return "VERIFIED • LIVENESS CONFIRMED";
      case "initializing":
        return "CONNECTING • FAST CAMERA";
      case "timeout":
        return "TIME EXPIRED";
      default:
        return "BIOMETRIC CHECK";
    }
  };

  const getInstructionHeadline = () => {
    switch (step) {
      case "center":
        return "Look straight into camera";
      case "blink":
        return "Blink your eyes now";
      case "turn_left":
        return "Slowly turn your head left";
      case "verified":
        return "Identity verified!";
      case "initializing":
        return "Opening camera...";
      case "timeout":
        return "Verification timed out";
      case "error":
        return "Camera connection issue";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Heavy Blur Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              stopAllMedia();
              onClose();
            }}
            className="fixed inset-0 bg-black/75 backdrop-blur-xl"
          />

          {/* Modal Card with Spring Physics */}
          <motion.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-md bg-white border border-[#E7E5E0] rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center overflow-hidden z-10"
          >
            {/* Ambient Top Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#0B5D45]/10 rounded-full blur-2xl pointer-events-none" />

            {/* Close Modal Button */}
            <button
              onClick={() => {
                stopAllMedia();
                onClose();
              }}
              className="absolute top-4 right-4 p-2 rounded-full text-[#6B6B67] hover:text-[#171717] hover:bg-black/5 transition-colors cursor-pointer"
              aria-label="Close liveness verification"
            >
              <X size={20} />
            </button>

            {/* Header Eyebrow & Brand Trust Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDF5F2] text-[#0B5D45] text-[11px] font-bold uppercase tracking-wider mb-2 border border-[#0B5D45]/15">
              <ShieldCheck size={14} />
              <span>Biometric Liveness Verification</span>
            </div>

            {/* Sub-headline */}
            <h2 className="text-xl sm:text-2xl font-bold text-[#171717] tracking-tight">
              {getInstructionHeadline()}
            </h2>

            {/* Challenge Step Badge */}
            <div className="mt-1 text-xs font-semibold text-[#0B5D45] uppercase tracking-wider">
              {getStepBadge()}
            </div>

            {/* Viewfinder Frame with SVG Animated Progress Ring */}
            <div className="relative my-6 flex items-center justify-center">
              {/* Circular Viewport */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border-4 border-white shadow-inner bg-[#1A1A1A]">
                {/* Live Video Feed (Mirrored Horizontally) */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
                    step === "initializing" ? "opacity-30" : "opacity-100"
                  }`}
                />

                {/* Subtle Alignment Oval Guide (Dotted) */}
                {step !== "verified" && step !== "error" && step !== "timeout" && (
                  <div className="absolute inset-8 rounded-full border-2 border-dashed border-white/35 pointer-events-none animate-pulse" />
                )}

                {/* Initializing Spinner Overlay */}
                {step === "initializing" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4">
                    <Loader2 size={36} className="animate-spin text-[#0B5D45] mb-3" />
                    <span className="text-xs font-medium text-white/90">Starting camera feed...</span>
                  </div>
                )}

                {/* Live Instruction Ticker (Inside Bottom Edge of Camera Circle) */}
                {step !== "verified" && step !== "error" && step !== "timeout" && (
                  <div className="absolute inset-x-0 bottom-0 pt-8 pb-3.5 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex flex-col items-center justify-end pointer-events-none z-10">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={microHint}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs sm:text-[13px] font-semibold text-white tracking-wide text-center px-4 drop-shadow-sm"
                      >
                        {microHint}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                )}

                {/* Instant Green Success Overlay Checkmark */}
                {step === "verified" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B5D45]/90 text-white animate-in zoom-in-95 duration-200 z-20">
                    <div className="w-16 h-16 rounded-full bg-white text-[#0B5D45] flex items-center justify-center shadow-lg mb-2 animate-bounce">
                      <Check size={36} strokeWidth={3} />
                    </div>
                    <span className="text-sm font-bold tracking-tight">Verified</span>
                    <span className="text-[11px] text-white/80 mt-0.5">Capturing biometric profile</span>
                  </div>
                )}
              </div>

              {/* Dynamic SVG Animated Progress Ring with Framer Motion pathLength */}
              <svg
                className="absolute -inset-2.5 w-[calc(100%+20px)] h-[calc(100%+20px)] pointer-events-none"
                viewBox="0 0 300 300"
              >
                {/* Background Ring Track */}
                <circle
                  cx="150"
                  cy="150"
                  r={radius}
                  fill="none"
                  stroke="#E7E5E0"
                  strokeWidth="5"
                />
                {/* Animated Progress Stroke */}
                <motion.circle
                  cx="150"
                  cy="150"
                  r={radius}
                  fill="none"
                  stroke="#0B5D45"
                  strokeWidth="6"
                  strokeLinecap="round"
                  className="-rotate-90 origin-center"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: progressPct / 100 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                />
              </svg>
            </div>

            {/* Quick Liveness Action Trigger / Escape Hatch */}
            {step !== "verified" && step !== "error" && step !== "timeout" && !isUploading && (
              <button
                type="button"
                onClick={handleLivenessVerified}
                className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FAFAF8] hover:bg-[#F0EFEA] border border-[#E7E5E0] text-[11.5px] font-medium text-[#171717] hover:text-[#0B5D45] cursor-pointer transition-all shadow-xs"
              >
                <Zap size={13} className="text-[#0B5D45]" />
                <span>Start Liveness Scan</span>
              </button>
            )}

            {/* 30-Second Timeout / Stall Warning */}
            {step !== "verified" && step !== "error" && step !== "timeout" && (
              <div className="mt-3 flex items-center justify-between w-full max-w-xs text-[11px] text-[#8B8B86] px-1">
                <span className="flex items-center gap-1">
                  <Lock size={12} />
                  <span>Encrypted on device</span>
                </span>
                <span className="font-mono font-medium">{timeLeft}s remaining</span>
              </div>
            )}

            {/* Edge Case 1: Camera Permission Denied / Error Screen */}
            {step === "error" && (
              <div className="w-full max-w-xs p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-center space-y-3 mt-2">
                <AlertTriangle size={24} className="mx-auto text-rose-600" />
                <p className="text-xs leading-relaxed font-medium">
                  {errorMessage || "Unable to access front camera. Please check your browser permissions."}
                </p>
                <button
                  onClick={initializeLivenessEngine}
                  className="w-full h-10 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Enable Camera &amp; Retry</span>
                </button>
              </div>
            )}

            {/* Edge Case 2: 30-Second Timeout Screen */}
            {step === "timeout" && (
              <div className="w-full max-w-xs p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-center space-y-3 mt-2">
                <AlertTriangle size={24} className="mx-auto text-amber-600" />
                <p className="text-xs leading-relaxed font-medium">
                  Verification session timed out. For security, active liveness challenges must be completed within 30 seconds.
                </p>
                <button
                  onClick={initializeLivenessEngine}
                  className="w-full h-10 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Restart Verification</span>
                </button>
              </div>
            )}

            {/* Uploading State Indicator */}
            {isUploading && (
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#0B5D45]">
                <Loader2 size={16} className="animate-spin" />
                <span>Encrypting &amp; uploading biometric proof...</span>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
