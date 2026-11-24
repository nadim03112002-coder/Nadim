// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Volume2, VolumeX, Sparkles, Globe, LayoutGrid } from 'lucide-react';
import { getOptimizedVideoUrl } from '../services/cloudinaryService';
import { DEFAULT_LIFE_MAKER_SCHOOL, getLocalSchools } from '../school-firebase';
import { getSavedSchoolLogo } from '../utils/schoolLogoUtils';

export type SplashTransitionMode = 'boot' | 'to_app' | 'to_website';

interface AppLoadingScreenProps {
  onComplete: () => void;
  onBack?: () => void;
  onApply?: () => void;
  isPreview?: boolean;
  previewStyleVariant?: number;
  transitionMode?: SplashTransitionMode;
  isPremium?: boolean;
  subscriptionLevel?: 'FREE' | 'BASIC' | 'ULTRA';
  userId?: string;
  userRole?: string;
  loadingScreenSlotAssignments?: Record<string, number>;
  loadingScreenSlotUnlocks?: Record<string, boolean>;
  loadingScreenUnlocks?: Record<string, number>;
  loadingScreenVideoUrl?: string;
  schoolId?: string;
  schoolName?: string;
  schoolLogoUrl?: string;
  schoolTagline?: string;
  schoolCode?: string;
  schoolAddress?: string;
}

const BRAND_LETTERS = ['S', 'C', 'H', 'O', 'O', 'L'] as const;

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  onComplete,
  onBack,
  onApply,
  isPreview = false,
  transitionMode = 'boot',
  loadingScreenVideoUrl,
  schoolId,
  schoolName,
  schoolLogoUrl,
}) => {
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [logoImgFailed, setLogoImgFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  const resolvedVideoUrl = (() => {
    if (transitionMode !== 'boot') return '';
    if (loadingScreenVideoUrl && loadingScreenVideoUrl.trim()) return loadingScreenVideoUrl.trim();
    try {
      const enabled = localStorage.getItem('nst_loading_screen_video_enabled');
      if (enabled === 'false') return '';
      return localStorage.getItem('nst_loading_screen_video_url') || '';
    } catch {
      return '';
    }
  })();
  const hasActiveVideo = Boolean(resolvedVideoUrl && !videoFailed);

  // Optional active school chip shown subtly below the SCHOOL+ brand lockup
  const resolvedSchool = useMemo(() => {
    try {
      const cached = getLocalSchools();
      const selectedId = schoolId || localStorage.getItem('selectedPublicSchoolId') || '';
      const matched =
        (selectedId && cached.find((s) => s.id === selectedId || s.code === selectedId)) ||
        cached.find((s) => s.isDefaultPublicWebsite) ||
        cached[0] ||
        DEFAULT_LIFE_MAKER_SCHOOL;

      const finalId = schoolId || matched?.id || DEFAULT_LIFE_MAKER_SCHOOL.id;
      const finalName = (schoolName || matched?.name || '').trim();
      const rawLogo = schoolLogoUrl || matched?.logoUrl || DEFAULT_LIFE_MAKER_SCHOOL.logoUrl;
      const savedLogo = getSavedSchoolLogo(rawLogo, finalId) || rawLogo || '';

      return { name: finalName, logoUrl: savedLogo };
    } catch {
      return { name: (schoolName || '').trim(), logoUrl: schoolLogoUrl || '' };
    }
  }, [schoolId, schoolName, schoolLogoUrl]);

  const statusText = useMemo(() => {
    if (transitionMode === 'to_app') {
      return progress < 55 ? 'Switching to SCHOOL+ App...' : 'Opening Smart Portal...';
    }
    if (transitionMode === 'to_website') {
      return progress < 55 ? 'Switching to Campus Website...' : 'Loading Public Showcase...';
    }
    if (progress < 30) return 'Starting SCHOOL+...';
    if (progress < 65) return 'Connecting Digital Campus...';
    if (progress < 92) return 'Syncing Classes, Attendance & Fees...';
    return 'Welcome to SCHOOL+';
  }, [transitionMode, progress]);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setProgress(0);
    setIsExiting(false);

    const totalDuration = transitionMode === 'boot' ? 420 : 320;
    const intervalMs = 18;
    const steps = Math.max(1, Math.round(totalDuration / intervalMs));
    let currentStep = 0;
    let exitTimer: ReturnType<typeof setTimeout> | null = null;
    let doneTimer: ReturnType<typeof setTimeout> | null = null;

    const timer = setInterval(() => {
      currentStep += 1;
      const pct = Math.min(Math.round((currentStep / steps) * 100), 100);
      setProgress(pct);

      if (currentStep >= steps) {
        clearInterval(timer);
        if (!isPreview) {
          exitTimer = setTimeout(() => setIsExiting(true), 20);
          doneTimer = setTimeout(() => onCompleteRef.current(), 110);
        }
      }
    }, intervalMs);

    return () => {
      clearInterval(timer);
      if (exitTimer) clearTimeout(exitTimer);
      if (doneTimer) clearTimeout(doneTimer);
    };
  }, [isPreview, transitionMode]);

  const ModeIcon = transitionMode === 'to_website' ? Globe : transitionMode === 'to_app' ? LayoutGrid : Sparkles;

  return (
    <div
      className={`fixed inset-0 z-[99999] w-screen h-screen min-h-[100dvh] flex flex-col items-center justify-between px-6 py-10 select-none overflow-hidden font-sans transition-all duration-200 ${
        isExiting ? 'opacity-0 scale-[1.02]' : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'radial-gradient(circle at 50% 24%, #172554 0%, #090d26 48%, #020617 100%)',
      }}
    >
      <style>{`
        @keyframes spLetterDrop {
          0% {
            opacity: 0;
            transform: translateY(28px) scale(0.76);
            filter: blur(6px);
          }
          65% {
            opacity: 1;
            transform: translateY(-4px) scale(1.06);
            filter: blur(0px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0px);
          }
        }
        @keyframes spPlusPop {
          0% {
            opacity: 0;
            transform: scale(0.2) rotate(-75deg);
          }
          65% {
            opacity: 1;
            transform: scale(1.22) rotate(8deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes spPlusGlow {
          0%, 100% {
            box-shadow: 0 0 18px rgba(251, 191, 36, 0.55), 0 0 42px rgba(245, 158, 11, 0.28);
          }
          50% {
            box-shadow: 0 0 28px rgba(251, 191, 36, 0.9), 0 0 60px rgba(56, 189, 248, 0.4);
          }
        }
        @keyframes spUnderlineExpand {
          0% {
            opacity: 0;
            transform: scaleX(0);
          }
          100% {
            opacity: 1;
            transform: scaleX(1);
          }
        }
        @keyframes spSweep {
          0% { transform: translateX(-140%) skewX(-18deg); }
          100% { transform: translateX(260%) skewX(-18deg); }
        }
        @keyframes spSubFade {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Ambient Backdrop Glows */}
      <div
        className="absolute top-[22%] left-1/2 -translate-x-1/2 w-[500px] h-[340px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, rgba(245, 158, 11, 0.14) 45%, transparent 72%)',
          filter: 'blur(65px)',
        }}
      />
      <div
        className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[420px] h-[240px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 72%)',
          filter: 'blur(65px)',
        }}
      />

      {/* Top Mode Pill */}
      <div className="relative z-10 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-sky-400/25 backdrop-blur-md">
        <ModeIcon className="w-3.5 h-3.5 text-amber-300" />
        <span className="text-[11px] font-extrabold tracking-[0.16em] uppercase text-sky-200">
          {transitionMode === 'to_website'
            ? 'Campus Website'
            : transitionMode === 'to_app'
            ? 'SCHOOL+ App'
            : 'Official Digital Campus'}
        </span>
      </div>

      {/* Center Animated SCHOOL+ Lockup */}
      <div className="relative z-10 w-full max-w-lg my-auto flex flex-col items-center text-center">
        {hasActiveVideo && (
          <div className="relative w-full max-w-[320px] aspect-video rounded-2xl overflow-hidden border-2 border-amber-400/40 shadow-[0_0_32px_rgba(245,158,11,0.28)] bg-black mb-6">
            <video
              src={getOptimizedVideoUrl(resolvedVideoUrl)}
              autoPlay
              muted={isVideoMuted}
              loop
              playsInline
              onError={() => setVideoFailed(true)}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => setIsVideoMuted((prev) => !prev)}
              className="absolute bottom-2.5 right-2.5 z-20 p-2 rounded-full bg-black/65 hover:bg-black/80 text-white border border-white/20 backdrop-blur-md transition-all active:scale-95"
              title={isVideoMuted ? 'Unmute Video' : 'Mute Video'}
            >
              {isVideoMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          </div>
        )}

        {/* Staggered Letter-by-Letter SCHOOL+ Wordmark */}
        <div className="relative inline-flex items-center justify-center px-4 py-2 overflow-visible">
          <div className="flex items-center gap-1 sm:gap-1.5">
            {BRAND_LETTERS.map((char, idx) => (
              <span
                key={`${char}-${idx}`}
                className="inline-block text-[2.6rem] sm:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-sky-300"
                style={{
                  opacity: 0,
                  animation: `spLetterDrop 0.42s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 55}ms forwards`,
                }}
              >
                {char}
              </span>
            ))}

            {/* Animated '+' Badge */}
            <span
              className="ml-1 inline-flex items-center justify-center w-10 h-10 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-slate-950 text-3xl sm:text-5xl font-black leading-none border border-amber-200/80 shadow-[0_0_20px_rgba(251,191,36,0.45)]"
              style={{
                opacity: 0,
                animation: `spPlusPop 0.48s cubic-bezier(0.34, 1.56, 0.64, 1) ${
                  BRAND_LETTERS.length * 55 + 40
                }ms forwards`,
              }}
            >
              +
            </span>
          </div>
        </div>

        {/* Glowing Accent Bar */}
        <div
          className="mt-1.5 h-[3px] w-40 sm:w-52 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent origin-center"
          style={{
            opacity: 0,
            animation: `spUnderlineExpand 0.45s ease-out ${BRAND_LETTERS.length * 55 + 80}ms forwards`,
          }}
        />

        <p
          className="mt-2.5 text-[11px] sm:text-xs font-extrabold tracking-[0.22em] uppercase text-sky-300/95"
          style={{
            opacity: 0,
            animation: `spSubFade 0.4s ease-out ${BRAND_LETTERS.length * 55 + 140}ms forwards`,
          }}
        >
          Smart School ERP · Learn · Grow
        </p>

        {/* Navy-Gold SCHOOL+ Emblem Below Animated Wordmark */}
        <div
          className="mt-5 flex items-center justify-center"
          style={{
            opacity: 0,
            animation: `spSubFade 0.45s ease-out ${BRAND_LETTERS.length * 55 + 160}ms forwards`,
          }}
        >
          <img
            src="/branding/schoolplus-splash-logo.png"
            alt="SCHOOL+ Logo"
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-[26px] object-contain drop-shadow-[0_14px_32px_rgba(245,158,11,0.28)]"
          />
        </div>

        {/* Subtle Active School Context Pill */}
        {resolvedSchool.name && (
          <div
            className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-sm max-w-xs"
            style={{
              opacity: 0,
              animation: `spSubFade 0.4s ease-out ${BRAND_LETTERS.length * 55 + 200}ms forwards`,
            }}
          >
            {resolvedSchool.logoUrl && !logoImgFailed && (
              <img
                src={resolvedSchool.logoUrl}
                alt={resolvedSchool.name}
                onError={() => setLogoImgFailed(true)}
                className="w-5 h-5 rounded-md object-contain bg-white/95 p-0.5 shrink-0"
              />
            )}
            <span className="text-[11px] font-bold text-slate-200 truncate">
              {resolvedSchool.name}
            </span>
          </div>
        )}

        {/* Smooth Progress Indicator */}
        <div className="w-full max-w-[260px] mt-7 flex flex-col items-center gap-2">
          <div className="text-xs font-semibold text-slate-300">{statusText}</div>
          <div className="w-full flex items-center gap-2.5">
            <div className="flex-1 h-1.5 bg-slate-900/90 rounded-full border border-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 via-amber-300 to-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.7)] transition-all duration-75"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] font-extrabold text-amber-200 tabular-nums min-w-8 text-right">
              {progress}%
            </span>
          </div>
        </div>
      </div>

      {isPreview && (
        <div className="relative z-10 w-full max-w-sm flex items-center gap-3 px-3 pb-2">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-black text-slate-200 active:scale-95 transition-transform"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 py-2.5 text-xs font-black text-white shadow-lg active:scale-95 transition-transform"
          >
            ✓ Apply
          </button>
        </div>
      )}

      {/* Bottom Brand Footer */}
      <div className="relative z-10 flex flex-col items-center gap-1 text-center">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>SCHOOL+ Android &amp; Campus Engine</span>
        </div>
        <div className="text-[10px] font-semibold tracking-wider uppercase text-slate-500">
          Admissions · Attendance · Fees · Results
        </div>
      </div>
    </div>
  );
};

export default AppLoadingScreen;
