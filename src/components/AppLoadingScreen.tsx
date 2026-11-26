// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { getOptimizedVideoUrl } from '../services/cloudinaryService';
import { DEFAULT_LIFE_MAKER_SCHOOL, getLocalSchools } from '../school-firebase';
import { getSavedSchoolLogo, isAppLogo } from '../utils/schoolLogoUtils';
import { resolveActiveSchoolBrand } from '../utils/activeSchoolBrand';
import { TypewriterSchoolTitle } from './school/PremiumLoadingState';

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

const BOOT_TOTAL_MS = 1900;
const SWITCH_TOTAL_MS = 1200;

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
  schoolTagline,
}) => {
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [logoImgFailed, setLogoImgFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [typingCompleted, setTypingCompleted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isUnmounted, setIsUnmounted] = useState(false);
  const [useOledBlack, setUseOledBlack] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nst_splash_oled_black') !== 'false';
    } catch {
      return true;
    }
  });

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
      const quickBrand = resolveActiveSchoolBrand({
        schoolId,
        schoolName,
        schoolLogoUrl,
        schoolTagline,
      });
      if (quickBrand.name) {
        return quickBrand;
      }

      const cached = getLocalSchools();
      const selectedId = schoolId || localStorage.getItem('selectedPublicSchoolId') || '';
      const matched =
        (selectedId && cached.find((s) => s.id === selectedId || s.code === selectedId)) ||
        cached.find((s) => s.isDefaultPublicWebsite) ||
        cached[0] ||
        (isPreview ? DEFAULT_LIFE_MAKER_SCHOOL : null);

      if (!matched) {
        return {
          schoolId: '',
          name: '',
          tagline: '',
          logoUrl: '/branding/schoolplus-splash-logo.png?v=7',
          hasCustomLogo: false,
        };
      }

      const finalId = schoolId || matched.id || '';
      const finalName = (schoolName || matched.name || '').trim();
      const finalTagline = (
        schoolTagline ||
        matched.tagline ||
        matched.websiteConfig?.heroSubheadline ||
        ''
      ).trim();
      const rawLogo = schoolLogoUrl || matched.logoUrl || '';
      const savedLogo = getSavedSchoolLogo(rawLogo, finalId) || rawLogo || '';
      const hasCustom = Boolean(savedLogo && !isAppLogo(savedLogo));

      return {
        schoolId: finalId,
        name: finalName,
        tagline: finalTagline,
        logoUrl: hasCustom ? savedLogo : '/branding/schoolplus-splash-logo.png?v=7',
        hasCustomLogo: hasCustom,
      };
    } catch {
      return {
        schoolId: '',
        name: (schoolName || '').trim(),
        tagline: (schoolTagline || '').trim(),
        logoUrl: schoolLogoUrl || '/branding/schoolplus-splash-logo.png?v=7',
        hasCustomLogo: Boolean(schoolLogoUrl && !isAppLogo(schoolLogoUrl)),
      };
    }
  }, [schoolId, schoolName, schoolLogoUrl, schoolTagline, isPreview]);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const typingCompletedRef = useRef(false);
  const typingCompletedAtRef = useRef<number | null>(null);

  useEffect(() => {
    typingCompletedRef.current = typingCompleted;
    if (typingCompleted && typingCompletedAtRef.current === null) {
      typingCompletedAtRef.current = performance.now();
    }
  }, [typingCompleted]);

  useEffect(() => {
    setProgress(0);
    setTypingCompleted(false);
    typingCompletedRef.current = false;
    typingCompletedAtRef.current = null;
    setIsExiting(false);
    setIsUnmounted(false);

    const fadeDurationMs = 280;
    const minHoldAfterTypeMs = 380;
    const hardMaxDuration = totalDuration + 900;
    const startTime = performance.now();
    let rafId = 0;
    let exitStartedAt: number | null = null;
    let finished = false;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(Math.round((elapsed / totalDuration) * 100), 100);
      setProgress(pct);

      if (!isPreview && !finished) {
        const typeDoneAt = typingCompletedAtRef.current;
        const readyToFadeByTime = elapsed >= totalDuration - fadeDurationMs;
        const readyToFadeByTyping =
          typingCompletedRef.current &&
          typeDoneAt !== null &&
          now - typeDoneAt >= minHoldAfterTypeMs;
        const safetyForceFade = elapsed >= hardMaxDuration - fadeDurationMs;

        if (exitStartedAt === null && ((readyToFadeByTime && readyToFadeByTyping) || safetyForceFade)) {
          exitStartedAt = now;
          setIsExiting(true);
        }

        if (exitStartedAt !== null && now - exitStartedAt >= fadeDurationMs) {
          finished = true;
          setIsUnmounted(true);
          onCompleteRef.current();
          return;
        }
      }

      if (!finished) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPreview, totalDuration]);

  if (isUnmounted && !isPreview) {
    return null;
  }

  const hasCustomSchoolAvatar =
    Boolean(resolvedSchool.name) &&
    Boolean(resolvedSchool.hasCustomLogo) &&
    !logoImgFailed;

  const displayTitle = resolvedSchool.name || 'SCHOOL+';

  const toggleOledTheme = () => {
    setUseOledBlack((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nst_splash_oled_black', next ? 'true' : 'false');
      } catch {}
      return next;
    });
  };

  return (
    <div
      className={`nst-isolated-modal fixed inset-0 z-[99999] w-screen h-screen min-h-[100dvh] flex flex-col items-center justify-between px-6 py-8 sm:py-10 select-none overflow-hidden font-sans transition-opacity duration-300 ease-out ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background: useOledBlack
          ? 'radial-gradient(circle at 50% 34%, #110d04 0%, #000000 58%, #000000 100%)'
          : 'radial-gradient(circle at 50% 30%, #162244 0%, #0B1120 55%, #070C18 100%)',
        backgroundColor: useOledBlack ? '#000000' : '#0B1120',
      }}
    >
      <style>{`
        @keyframes spLogoReveal {
          0% { opacity: 0.4; transform: translateY(6px) scale(0.94); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spHeroFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
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
        @media (prefers-reduced-motion: reduce) {
          .sp-splash-anim {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Soft Stage Glow — Clean Atmospheric Depth Without Circles */}
      <div
        className="absolute top-[36%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[360px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(56, 189, 248, 0.14) 0%, rgba(245, 158, 11, 0.1) 45%, transparent 74%)',
          filter: 'blur(72px)',
        }}
      />

      {/* Top Spacer to keep center composition optically balanced */}
      <div className="h-4" aria-hidden="true" />

      {/* Center Flagship Stage: Large Logo + Looping Letter-by-Letter School Name + Minimal Track */}
      <div className="relative z-10 w-full max-w-xl my-auto flex flex-col items-center text-center">
        {hasActiveVideo && (
          <div className="relative w-full max-w-[320px] aspect-video rounded-2xl overflow-hidden border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.65)] bg-black mb-6">
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

        {/* Hero Logo — Large, Crisp, Zero Spinning Circles */}
        {!hasActiveVideo && (
          <div
            className="relative mb-6 sm:mb-7 flex items-center justify-center sp-splash-anim"
            style={{
              animation: 'spLogoReveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            }}
          >
            {hasCustomSchoolAvatar ? (
              <div
                className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-[32px] p-3.5 bg-white border border-white/25 shadow-[0_28px_68px_rgba(0,0,0,0.58)] flex items-center justify-center sp-splash-anim"
                style={{ animation: 'spHeroFloat 4.2s ease-in-out infinite' }}
              >
                <img
                  src={resolvedSchool.logoUrl}
                  alt={resolvedSchool.name}
                  onError={() => setLogoImgFailed(true)}
                  className="w-full h-full object-contain rounded-[22px]"
                />
              </div>
            ) : (
              <img
                src="/branding/schoolplus-splash-logo.png?v=7"
                alt="SCHOOL+"
                width={512}
                height={512}
                loading="eager"
                decoding="sync"
                className="relative w-44 h-44 sm:w-56 sm:h-56 object-contain rounded-[22%] drop-shadow-[0_30px_64px_rgba(0,0,0,0.65)] sp-splash-anim"
                style={{ animation: 'spHeroFloat 4.2s ease-in-out infinite' }}
              />
            )}
          </div>
        )}

        {/* Looping Letter-by-Letter School Name */}
        <div className="px-4 max-w-lg min-h-[3.5rem] sm:min-h-[4.25rem] flex items-center justify-center">
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-wide leading-tight text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.45)]" style={{ textWrap: 'balance' }}>
            <TypewriterSchoolTitle
              text={displayTitle}
              caretClassName="bg-amber-300"
              onTypingComplete={() => setTypingCompleted(true)}
            />
          </h1>
        </div>

        {/* Single Minimal Hairline Progress Bar */}
        <div className="w-48 sm:w-56 mt-6">
          <div className="w-full h-[2.5px] bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-amber-300 to-amber-400 transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {isPreview ? (
        <div className="relative z-10 w-full max-w-sm space-y-2 px-3 pb-2">
          <button
            type="button"
            onClick={toggleOledTheme}
            className="w-full rounded-xl border border-amber-400/35 bg-white/5 hover:bg-white/10 py-2 text-[11px] font-bold text-amber-300 cursor-pointer transition-colors"
          >
            Theme: {useOledBlack ? 'Pure OLED Black (#000000)' : 'Deep Navy Slate'} (Tap to Switch)
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-black text-slate-200 active:scale-95 transition-transform cursor-pointer"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={onApply}
              className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 py-2.5 text-xs font-black text-white shadow-lg active:scale-95 transition-transform cursor-pointer"
            >
              ✓ Apply
            </button>
          </div>
        </div>
      ) : (
        <div className="relative z-10 min-h-[3.75rem] flex flex-col items-center justify-center text-center pt-2">
          {isBootMode && (
            <>
              <div
                className="w-24 h-[1px] mb-2.5 bg-gradient-to-r from-transparent via-amber-400/75 to-transparent origin-center sp-splash-anim"
                style={{
                  opacity: 0,
                  animation: 'spCreditHairline 260ms ease-out 140ms forwards',
                }}
              />
              <div className="flex items-center justify-center text-[10px] font-bold tracking-[0.38em] uppercase text-slate-400">
                {CREDIT_PREFIX.map((ch, idx) => (
                  <span
                    key={`cp-${idx}`}
                    className="inline-block sp-splash-anim"
                    style={{
                      width: ch === ' ' ? '0.45em' : undefined,
                      opacity: 0,
                      animation: `spCreditLetterIn 180ms ease-out ${180 + idx * 28}ms forwards`,
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
                    className={`inline-block sp-splash-anim ${
                      idx < 5
                        ? 'text-slate-100 drop-shadow-[0_2px_10px_rgba(255,255,255,0.22)]'
                        : 'text-amber-300 drop-shadow-[0_2px_12px_rgba(251,191,36,0.35)]'
                    }`}
                    style={{
                      width: ch === ' ' ? '0.45em' : undefined,
                      opacity: 0,
                      animation: `spCreditLetterIn 200ms cubic-bezier(0.22, 1, 0.36, 1) ${520 + idx * 45}ms forwards`,
                    }}
                  >
                    {ch === ' ' ? '\u00A0' : ch}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AppLoadingScreen;
