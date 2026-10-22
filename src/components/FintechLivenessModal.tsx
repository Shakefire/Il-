"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  AlertTriangle,
  X,
  Loader2,
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

type ChallengeStep =
  | "initializing"
  | "center"
  | "blink"
  | "turn_left"
  | "uploading"
  | "verified"
  | "error"
  | "timeout";

// ── Global Singleton Cache for Neural Vision Engine ──
// Loads once per session so opening/retrying is fast
let cachedLandmarker: any = null;
let cachedLandmarkerPromise: Promise<any> | null = null;

export async function preloadLivenessEngine(): Promise<any> {
  if (typeof window === "undefined") return null;
  if (cachedLandmarker) return cachedLandmarker;
  if (cachedLandmarkerPromise) return cachedLandmarkerPromise;

  cachedLandmarkerPromise = (async () => {
    try {
      // Dynamic runtime import prevents bundlers from analyzing internal worker paths
      const loadTasksVision = new Function("url", "return import(url);");
      const { FaceLandmarker, FilesetResolver } = await loadTasksVision(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs"
      );
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
 * Ascending harmonic chime on verification success.
 */
function playSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const freqs = [523.25, 659.25, 783.99]; // C5 -> E5 -> G5
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.16, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.35);
    });
  } catch {
    // Audio optional
  }
}

export default function FintechLivenessModal({
  isOpen,
  onClose,
  onComplete,
}: FintechLivenessModalProps) {
  // Verification State
  const [step, setStep] = useState<ChallengeStep>("initializing");
  const [progressPct, setProgressPct] = useState(0); // 0 -> 33 -> 66 -> 100
  const [statusMessage, setStatusMessage] = useState("Opening your camera…");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stored result for final continue action
  const [completedResult, setCompletedResult] = useState<FintechLivenessResult | null>(null);

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
  }, []);

  const handleClose = useCallback(() => {
    stopAllMedia();
    onClose();
  }, [stopAllMedia, onClose]);

  // 30-Second Auto-Timeout Counter
  useEffect(() => {
    if (!isOpen || step === "verified" || step === "error" || step === "timeout" || step === "uploading") {
      return;
    }

    const timer = setTimeout(() => {
      stopAllMedia();
      setStep("timeout");
      stepRef.current = "timeout";
    }, 30000);

    return () => clearTimeout(timer);
  }, [isOpen, step, stopAllMedia]);

  /**
   * Finalize verification capture & upload
   */
  const handleLivenessVerified = useCallback(async () => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;

    setStep("uploading");
    stepRef.current = "uploading";
    setProgressPct(100);
    setStatusMessage("Verifying identity…");

    // 1. Grab snapshot from video
    let snapshotBlob: Blob | null = null;
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        snapshotBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.90)
        );
      }
    }

    // 2. Stop recorder & get video blob
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
        throw new Error(data.error || "Failed to process verification.");
      }

      // Stop camera and release resources immediately on success
      stopAllMedia();
      playSuccessChime();

      setCompletedResult({
        verificationId: data.verificationId,
        snapshotUrl: data.snapshotUrl,
        videoUrl: data.videoUrl,
      });

      setStep("verified");
      stepRef.current = "verified";
    } catch (err: any) {
      console.error("[Liveness] Upload error:", err);
      stopAllMedia();
      setErrorMessage(err.message || "Failed to submit verification session. Please retry.");
      stepRef.current = "error";
      setStep("error");
    }
  }, [stopAllMedia]);

  /**
   * Main real-time face detection loop
   */
  const startDetectionLoop = useCallback(() => {
    let lastVideoTime = -1;
    let lastInferenceTime = 0;
    const INFERENCE_INTERVAL_MS = 65; // ~15 FPS throttler

    const detect = () => {
      if (!videoRef.current || isCompletedRef.current) return;
      const video = videoRef.current;
      const now = performance.now();

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

              // ── STEP 1: KEEP FACE CENTRED ──
              if (stepRef.current === "center") {
                const isCenteredX = nose.x >= 0.30 && nose.x <= 0.70;
                const isCenteredY = nose.y >= 0.20 && nose.y <= 0.80;
                const isGoodDistance = faceWidth >= 0.16 && faceWidth <= 0.65;

                if (!isGoodDistance) {
                  centerFramesRef.current = 0;
                  setStatusMessage(faceWidth < 0.16 ? "Move a little closer." : "Move a little back.");
                } else if (!isCenteredX || !isCenteredY) {
                  centerFramesRef.current = 0;
                  setStatusMessage("Keep your face centred.");
                } else {
                  centerFramesRef.current += 1;
                  setStatusMessage("Face detected.");
                  if (centerFramesRef.current >= 5) {
                    stepRef.current = "blink";
                    setStep("blink");
                    setProgressPct(33);
                    setStatusMessage("Blink your eyes naturally.");
                  }
                }
              }

              // ── STEP 2: BLINK EYES ──
              else if (stepRef.current === "blink") {
                const avgBlink = (eyeBlinkLeft + eyeBlinkRight) / 2;
                const isBlinking = avgBlink > 0.32 || eyeBlinkLeft > 0.40 || eyeBlinkRight > 0.40;
                const isOpen = avgBlink < 0.25;

                if (blinkPhaseRef.current === "open") {
                  if (isBlinking) {
                    blinkPhaseRef.current = "closed";
                    setStatusMessage("Blink detected.");
                  }
                } else if (blinkPhaseRef.current === "closed") {
                  if (isOpen) {
                    blinkPhaseRef.current = "done";
                    stepRef.current = "turn_left";
                    setStep("turn_left");
                    setProgressPct(66);
                    setStatusMessage("Slowly turn your head to your left.");
                  }
                }
              }

              // ── STEP 3: TURN HEAD LEFT ──
              else if (stepRef.current === "turn_left") {
                const isTurningLeft = Math.abs(yawOffset) > 0.10;

                if (isTurningLeft) {
                  turnLeftFramesRef.current += 1;
                  setStatusMessage("Holding position…");
                  if (turnLeftFramesRef.current >= 4) {
                    handleLivenessVerified();
                    return;
                  }
                } else {
                  turnLeftFramesRef.current = Math.max(0, turnLeftFramesRef.current - 1);
                  setStatusMessage("Slowly turn your head to your left.");
                }
              }
            } else {
              // No face detected in frame
              if (stepRef.current === "center") {
                setStatusMessage("Move into the camera view.");
              } else if (stepRef.current === "blink" || stepRef.current === "turn_left") {
                setStatusMessage("Keep your face in view.");
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
   * Initialize Camera & Neural Vision Engine
   */
  const initializeLivenessEngine = useCallback(async () => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    setStep("initializing");
    stepRef.current = "initializing";
    setErrorMessage(null);
    setProgressPct(0);
    setStatusMessage("Opening your camera…");
    isCompletedRef.current = false;
    centerFramesRef.current = 0;
    blinkPhaseRef.current = "open";
    turnLeftFramesRef.current = 0;
    recordedChunksRef.current = [];
    setCompletedResult(null);

    try {
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

      // Initialize MediaRecorder
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

      // Camera & Model ready: start verification automatically
      stepRef.current = "center";
      setStep("center");
      setStatusMessage("Move into the camera view.");
      startDetectionLoop();
    } catch (err: any) {
      if (!isInitializingRef.current) return;
      console.error("[Liveness] Initialization error:", err);
      const isPermissionDenied =
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError" ||
        err.message?.includes("Permission denied");

      if (isPermissionDenied) {
        setErrorMessage("Camera access was denied. Please allow camera permissions in your browser settings and try again.");
      } else {
        setErrorMessage("We couldn't connect to your camera. Please check your camera settings and try again.");
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

  const handleFinalizeSuccess = () => {
    if (completedResult) {
      onComplete(completedResult);
    }
    handleClose();
  };

  // SVG Progress Ring calculations
  const ringRadius = 138;
  const ringCircumference = 2 * Math.PI * ringRadius;

  // Primary dynamic instruction above camera frame
  const getDynamicInstruction = () => {
    switch (step) {
      case "center":
        return "Keep your face centred.";
      case "blink":
        return "Blink your eyes.";
      case "turn_left":
        return "Turn your head to the left.";
      case "uploading":
        return "Verifying…";
      case "initializing":
      default:
        return "Position your face in the frame.";
    }
  };

  // Step badge label
  const getStepLabel = () => {
    switch (step) {
      case "center":
        return "Step 1 of 3";
      case "blink":
        return "Step 2 of 3";
      case "turn_left":
        return "Step 3 of 3";
      default:
        return null;
    }
  };

  const isScanningActive =
    step === "initializing" ||
    step === "center" ||
    step === "blink" ||
    step === "turn_left" ||
    step === "uploading";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Subtle Dim Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col items-center text-center overflow-hidden z-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="liveness-modal-heading"
          >
            {/* Top Close Control */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full text-[#64748B] hover:text-[#111827] hover:bg-stone-100 transition-colors cursor-pointer"
              aria-label="Close verification modal"
            >
              <X size={19} />
            </button>

            {/* ────────────────────────────────────────────────────────── */}
            {/* ACTIVE SCANNING / INITIALIZING STATE                       */}
            {/* ────────────────────────────────────────────────────────── */}
            {isScanningActive && (
              <div className="w-full flex flex-col items-center">
                {/* 1. Heading */}
                <h2
                  id="liveness-modal-heading"
                  className="font-serif text-2xl sm:text-[26px] font-normal tracking-tight text-[#111827]"
                >
                  Verify your identity
                </h2>

                {/* 2. One Dynamic Instruction (above camera frame) */}
                <div className="mt-2 min-h-[36px] flex flex-col items-center justify-center">
                  {getStepLabel() && (
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-0.5">
                      {getStepLabel()}
                    </span>
                  )}
                  <p className="text-sm font-medium text-[#111827]">
                    {getDynamicInstruction()}
                  </p>
                </div>

                {/* 3. Circular Camera Frame with Progress Ring */}
                <div className="relative my-5 flex items-center justify-center">
                  {/* Circular Viewport (Unobstructed Face Feed) */}
                  <div className="relative w-60 h-60 sm:w-68 sm:h-68 rounded-full overflow-hidden bg-slate-900 border border-slate-200/80 shadow-inner">
                    {/* Live Video Feed (Mirrored Horizontally) */}
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
                        step === "initializing" ? "opacity-20" : "opacity-100"
                      }`}
                    />

                    {/* Camera Opening Spinner (only during init) */}
                    {step === "initializing" && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white p-4">
                        <Loader2 size={30} className="animate-spin text-slate-300 mb-2" />
                      </div>
                    )}
                  </div>

                  {/* Circular Progress Ring (Thin, precise SVG) */}
                  <svg
                    className="absolute -inset-2.5 w-[calc(100%+20px)] h-[calc(100%+20px)] pointer-events-none"
                    viewBox="0 0 300 300"
                  >
                    {/* Background Ring Track (Neutral slate) */}
                    <circle
                      cx="150"
                      cy="150"
                      r={ringRadius}
                      fill="none"
                      stroke="#E2E8F0"
                      strokeWidth="3.5"
                    />

                    {/* Progress Ring Segment (Transitions to deep emerald #065F46) */}
                    <motion.circle
                      cx="150"
                      cy="150"
                      r={ringRadius}
                      fill="none"
                      stroke={step === "initializing" ? "#94A3B8" : "#065F46"}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      className="-rotate-90 origin-center"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: progressPct / 100 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                    />
                  </svg>
                </div>

                {/* 4. One Concise Status Message Below Frame */}
                <div className="min-h-[24px] flex items-center justify-center">
                  <p className="text-xs text-[#64748B] font-normal transition-opacity duration-200" role="status">
                    {statusMessage}
                  </p>
                </div>
              </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* SUCCESS STATE                                              */}
            {/* ────────────────────────────────────────────────────────── */}
            {step === "verified" && (
              <div className="w-full py-4 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#EDF5F2] border border-[#065F46]/20 text-[#065F46] flex items-center justify-center">
                  <Check size={32} strokeWidth={2.5} />
                </div>

                <div>
                  <h2
                    id="liveness-modal-heading"
                    className="font-serif text-2xl sm:text-[26px] font-normal tracking-tight text-[#111827]"
                  >
                    Identity check complete.
                  </h2>
                  <p className="text-sm text-[#64748B] mt-1.5 max-w-xs leading-relaxed">
                    You can continue setting up your host profile.
                  </p>
                </div>

                <div className="pt-3 w-full">
                  <button
                    type="button"
                    onClick={handleFinalizeSuccess}
                    className="w-full h-11 rounded-lg bg-[#065F46] hover:bg-[#044e39] text-white text-sm font-medium transition-colors shadow-xs cursor-pointer"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* FAILURE & TIMEOUT RECOVERY STATE                           */}
            {/* ────────────────────────────────────────────────────────── */}
            {(step === "error" || step === "timeout") && (
              <div className="w-full py-4 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 text-[#B45309] flex items-center justify-center">
                  <AlertTriangle size={28} />
                </div>

                <div>
                  <h2
                    id="liveness-modal-heading"
                    className="font-serif text-2xl sm:text-[26px] font-normal tracking-tight text-[#111827]"
                  >
                    We couldn&apos;t verify your face.
                  </h2>
                  <p className="text-sm text-[#64748B] mt-2 max-w-xs leading-relaxed">
                    {step === "timeout"
                      ? "The check took too long. Find a well-lit place and try again."
                      : errorMessage || "We couldn't connect to your camera. Please check your camera settings and try again."}
                  </p>
                </div>

                <div className="pt-3 w-full space-y-2.5">
                  <button
                    type="button"
                    onClick={initializeLivenessEngine}
                    className="w-full h-11 rounded-lg bg-[#065F46] hover:bg-[#044e39] text-white text-sm font-medium transition-colors shadow-xs cursor-pointer"
                  >
                    Try again
                  </button>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full h-10 rounded-lg text-sm font-medium text-[#64748B] hover:text-[#111827] hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
