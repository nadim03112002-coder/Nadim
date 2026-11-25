// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Volume2, VolumeX, Globe, LayoutGrid, Sparkles } from 'lucide-react';
import { getOptimizedVideoUrl } from '../services/cloudinaryService';
import { DEFAULT_LIFE_MAKER_SCHOOL, getLocalSchools } from '../school-firebase';
import { getSavedSchoolLogo, isAppLogo } from '../utils/schoolLogoUtils';

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

const CREDIT_PREFIX = 'DEVELOPED BY'.split('');
const CREDIT_AUTHOR = 'NADIM ANWAR'.split('');

const BOOT_TOTAL_MS = 3000;
const SWITCH_TOTAL_MS = 1800;

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

  const isBootMode = transitionMode === 'boot';
  const totalDuration = isBootMode ? BOOT_TOTAL_MS : SWITCH_TOTAL_MS;

  const resolvedVideoUrl = (() => {
    if (!isBootMode) return '';
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
      return progress < 55 ? 'Switching to Campus Website...' : 'Opening Campus Website...';
    }
    if (progress < 45) return 'Starting SCHOOL+...';
    if (progress < 80) return 'Loading Smart Portal...';
    return 'Welcome to SCHOOL+';
  }, [transitionMode, progress]);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setProgress(0);
    setIsExiting(false);

    const fadeOutLead = 180;
    const startTime = performance.now();
    let rafId = 0;
    let finished = false;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(Math.round((elapsed / totalDuration) * 100), 100);
      setProgress(pct);

      if (!isPreview && !finished) {
        if (elapsed >= totalDuration - fadeOutLead) {
          setIsExiting(true);
        }
        if (elapsed >= totalDuration) {
          finished = true;
          onCompleteRef.current();
          return;
        }
      }

      if (elapsed < totalDuration) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPreview, totalDuration]);

  const ModeIcon = transitionMode === 'to_website' ? Globe : transitionMode === 'to_app' ? LayoutGrid : Sparkles;
  const hasCustomSchoolAvatar =
    Boolean(resolvedSchool.name) &&
    Boolean(resolvedSchool.logoUrl) &&
    !isAppLogo(resolvedSchool.logoUrl) &&
    !logoImgFailed;

  return (
    <div
      className={`fixed inset-0 z-[99999] w-screen h-screen min-h-[100dvh] flex flex-col items-center justify-between px-5 py-6 sm:py-8 select-none overflow-hidden font-sans transition-all duration-200 ${
        isExiting ? 'opacity-0 scale-[1.015]' : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'radial-gradient(circle at 50% 28%, #172554 0%, #090d26 50%, #020617 100%)',
      }}
    >
      <style>{`
        @keyframes spLogoReveal {
          0% { opacity: 0.45; transform: scale(0.92); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes spCreditLetterIn {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.86);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes spCreditHairline {
          0% { opacity: 0; transform: scaleX(0); }
          100% { opacity: 1; transform: scaleX(1); }
        }
      `}</style>

      {/* Ambient Royal Navy & Amber Glows */}
      <div
        className="absolute top-[28%] left-1/2 -translate-x-1/2 w-[480px] h-[340px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, rgba(245, 158, 11, 0.12) 45%, transparent 72%)',
          filter: 'blur(65px)',
        }}
      />

      {/* Top Clean Mode Label */}
      <div className="relative z-10 flex items-center gap-2 text-[11px] font-extrabold tracking-[0.2em] uppercase text-sky-200/90">
        <ModeIcon className="w-3.5 h-3.5 text-amber-300" />
        <span>
          {transitionMode === 'to_website'
            ? 'Campus Website'
            : transitionMode === 'to_app'
            ? 'SCHOOL+ App'
            : 'SCHOOL+ Official'}
        </span>
      </div>

      {/* Center Official 512x512 Transparent Emblem + Progress */}
      <div className="relative z-10 w-full max-w-xl my-auto flex flex-col items-center text-center">
        {hasActiveVideo && (
          <div className="relative w-full max-w-[300px] aspect-video rounded-2xl overflow-hidden border-2 border-amber-400/40 shadow-[0_0_32px_rgba(245,158,11,0.28)] bg-black mb-4">
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

        {/* 512x512 Transparent-Corner SCHOOL+ Logo (Zero White Corners) */}
        {!hasActiveVideo && (
          <div
            className="mb-3 sm:mb-4 flex items-center justify-center"
            style={{
              animation: 'spLogoReveal 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            }}
          >
            <img
              src="/branding/schoolplus-splash-logo.png?v=7"
              alt="SCHOOL+ Logo"
              width={512}
              height={512}
              loading="eager"
              decoding="sync"
              className="w-[min(78vw,46dvh,512px)] h-[min(78vw,46dvh,512px)] sm:w-[min(48dvh,512px)] sm:h-[min(48dvh,512px)] object-contain bg-transparent drop-shadow-[0_20px_48px_rgba(56,189,248,0.26)]"
            />
          </div>
        )}

        {/* Glowing Accent Bar */}
        <div className="h-[2.5px] w-44 sm:w-56 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        <p className="mt-2.5 text-[11px] sm:text-xs font-extrabold tracking-[0.24em] uppercase text-sky-300/95">
          Smart School ERP · Learn · Grow
        </p>

        {/* Clean Unboxed Active School Line */}
        {resolvedSchool.name && (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-slate-200/90 max-w-xs">
            {hasCustomSchoolAvatar && (
              <img
                src={resolvedSchool.logoUrl}
                alt={resolvedSchool.name}
                onError={() => setLogoImgFailed(true)}
                className="w-5 h-5 rounded object-contain shrink-0"
              />
            )}
            <span className="truncate">{resolvedSchool.name}</span>
          </div>
        )}

        {/* Smooth Progress Indicator */}
        <div className="w-full max-w-[260px] mt-5 flex flex-col items-center gap-1.5">
          <div className="text-xs font-semibold text-slate-300">{statusText}</div>
          <div className="w-full flex items-center gap-2.5">
            <div className="flex-1 h-1.5 bg-slate-900/90 rounded-full border border-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 via-amber-300 to-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.65)] transition-[width] duration-75"
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

      {/* Bottom Premium Signature — Animated Letter-by-Letter Across Every Loading Screen */}
      <div className="relative z-10 flex flex-col items-center text-center pt-2">
        {!isBootMode && (
          <div className="mb-2 text-[10px] font-semibold tracking-[0.22em] uppercase text-slate-500">
            Admissions · Attendance · Fees · Results
          </div>
        )}
        <div
          className="w-20 h-[1px] mb-2.5 bg-gradient-to-r from-transparent via-amber-400/75 to-transparent origin-center"
          style={{
            opacity: 0,
            animation: `spCreditHairline ${isBootMode ? 320 : 240}ms ease-out ${isBootMode ? 180 : 60}ms forwards`,
          }}
        />
        <div className="flex items-center justify-center text-[10px] font-bold tracking-[0.38em] uppercase text-slate-400">
          {CREDIT_PREFIX.map((ch, idx) => (
            <span
              key={`cp-${idx}`}
              className="inline-block"
              style={{
                width: ch === ' ' ? '0.45em' : undefined,
                opacity: 0,
                animation: `spCreditLetterIn ${isBootMode ? 220 : 160}ms ease-out ${(isBootMode ? 240 : 100) + idx * (isBootMode ? 52 : 24)}ms forwards`,
              }}
            >
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-center text-sm sm:text-base font-black tracking-[0.26em] uppercase">
          {CREDIT_AUTHOR.map((ch, idx) => (
            <span
              key={`ca-${idx}`}
              className={`inline-block ${
                idx < 5
                  ? 'text-slate-100 drop-shadow-[0_2px_10px_rgba(255,255,255,0.22)]'
                  : 'text-amber-300 drop-shadow-[0_2px_12px_rgba(251,191,36,0.35)]'
              }`}
              style={{
                width: ch === ' ' ? '0.45em' : undefined,
                opacity: 0,
                animation: `spCreditLetterIn ${isBootMode ? 240 : 180}ms cubic-bezier(0.22, 1, 0.36, 1) ${(isBootMode ? 920 : 380) + idx * (isBootMode ? 92 : 42)}ms forwards`,
              }}
            >
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AppLoadingScreen;
