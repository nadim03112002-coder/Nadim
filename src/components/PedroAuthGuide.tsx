import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Volume2, VolumeX, Sparkles, 
  User as UserIcon, KeyRound, X, ArrowRight, 
  ChevronLeft, RotateCcw, CheckCircle2
} from 'lucide-react';
import { Pedro3DMascot, type PedroMascotPose, type PedroColorScheme } from './Pedro3DMascot';
import { pedroSpeak, stopPedroVoice, getPedroVoiceMuted, setPedroVoiceMuted } from '../utils/pedroVoiceManager';

export interface PedroAuthGuideProps {
  mode: 'LOGIN' | 'SIGNUP' | 'RECOVERY';
  onSwitchMode: (mode: 'LOGIN' | 'SIGNUP' | 'RECOVERY') => void;
  highlightedField?: string | null;
  onSelectFieldHighlight?: (field: string | null) => void;
  isPasswordFocused?: boolean;
  showPassword?: boolean;
  trackingLength?: number;
  onOpenHelpGuide?: () => void;
}

export interface TourStep {
  field: string;
  label: string;
  speech: string;
  pose: PedroMascotPose;
  isPointing: boolean;
}

const LOGIN_TOUR_STEPS: TourStep[] = [
  {
    field: 'id',
    label: '1. Mobile, Email ya Student ID',
    speech: 'Pehle yahan apna Mobile number, Email address ya Student ID enter karein!',
    pose: 'pointing',
    isPointing: true,
  },
  {
    field: 'password',
    label: '2. Secret Password',
    speech: 'Phir yahan apna secret password enter kijiye!',
    pose: 'pointing',
    isPointing: true,
  },
  {
    field: 'login_btn',
    label: '3. SIGN IN Button',
    speech: 'Dono likhne ke baad, is SIGN IN button par click karke login ho jayein!',
    pose: 'celebrating',
    isPointing: true,
  },
  {
    field: 'recovery',
    label: '4. Recovery',
    speech: 'Agar kabhi password bhool jayein, toh yahan Recovery dabakar bina password ke login kar sakte hain!',
    pose: 'pointing',
    isPointing: true,
  },
  {
    field: 'signup',
    label: '5. Sign Up',
    speech: 'Aur agar aap naye student hain, toh yahan Sign Up par click karke naya account banayein!',
    pose: 'wave',
    isPointing: true,
  },
];

const SIGNUP_TOUR_STEPS: TourStep[] = [
  {
    field: 'signup_name',
    label: '1. Pura Naam',
    speech: 'Sabse pehle yahan apna pura Naam enter karein!',
    pose: 'pointing',
    isPointing: true,
  },
  {
    field: 'signup_mobile',
    label: '2. Mobile Number',
    speech: 'Yahan apna 10-digit mobile number daalein taaki OTP aur updates mil sakein!',
    pose: 'pointing',
    isPointing: true,
  },
  {
    field: 'signup_email',
    label: '3. Email Address',
    speech: 'Yahan apna active email address enter karein!',
    pose: 'pointing',
    isPointing: true,
  },
  {
    field: 'signup_password',
    label: '4. Naya Password',
    speech: 'Yahan apna strong password banayein jo kam se kam 6 aksharon ka ho!',
    pose: 'pointing',
    isPointing: true,
  },
  {
    field: 'signup_question',
    label: '5. Security Question',
    speech: 'Yahan ek simple security question select karein!',
    pose: 'pointing',
    isPointing: true,
  },
  {
    field: 'signup_answer',
    label: '6. Security Answer',
    speech: 'Aur yahan uska secret answer likhein. Password bhoolne par ye answer aapka account turant open kar dega!',
    pose: 'pointing',
    isPointing: true,
  },
  {
    field: 'signup_btn',
    label: '7. CREATE ACCOUNT',
    speech: 'Ab CREATE ACCOUNT button dabayein aur 50 bonus credits ke saath padhai shuru karein!',
    pose: 'celebrating',
    isPointing: true,
  },
];

const RECOVERY_TOUR_STEPS: TourStep[] = [
  {
    field: 'recovery_id',
    label: '1. Registered ID / Mobile',
    speech: 'Yahan apna registered Mobile number, Email ya Student ID enter karein aur FIND ACCOUNT dabayein!',
    pose: 'pointing',
    isPointing: true,
  },
  {
    field: 'recovery_answer',
    label: '2. Security Answer',
    speech: 'Security question ka sahi answer yahan enter karein aur VERIFY & LOGIN dabakar direct login ho jayein!',
    pose: 'celebrating',
    isPointing: true,
  }
];

export const PedroAuthGuide: React.FC<PedroAuthGuideProps> = ({
  mode,
  onSwitchMode,
  highlightedField,
  onSelectFieldHighlight,
  isPasswordFocused = false,
  showPassword = false,
  trackingLength = 0,
  onOpenHelpGuide,
}) => {
  const [isMuted, setIsMuted] = useState<boolean>(getPedroVoiceMuted());
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentSpeech, setCurrentSpeech] = useState<string>('Bataiye dost! Main Pedro 🤖. Kahan kya bharna hai, main bolkar aur highlight karke batata hoon!');
  const [pose, setPose] = useState<PedroMascotPose>('idle');
  const [isPointing, setIsPointing] = useState<boolean>(false);
  const [isWinking, setIsWinking] = useState<boolean>(false);
  const [showOptionsModal, setShowOptionsModal] = useState<boolean>(false);

  // Active tour state
  const [activeTour, setActiveTour] = useState<'LOGIN' | 'SIGNUP' | 'RECOVERY' | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const tourAutoAdvanceTimerRef = useRef<any>(null);

  const clearAutoAdvanceTimer = () => {
    if (tourAutoAdvanceTimerRef.current) {
      clearTimeout(tourAutoAdvanceTimerRef.current);
      tourAutoAdvanceTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearAutoAdvanceTimer();
    };
  }, []);

  // Saved Pedro level & color scheme
  const savedPedroLevel = (() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('pedro_level');
        if (stored) {
          const val = parseInt(stored, 10);
          if (!isNaN(val) && val >= 1) return Math.min(8, val);
        }
      }
    } catch {}
    return 1;
  })();

  const savedColorScheme: PedroColorScheme = (() => {
    try {
      if (typeof window !== 'undefined') {
        const sc = localStorage.getItem('pedro_color_scheme');
        if (sc === 'cyber') return 'cyber';
      }
    } catch {}
    return 'classic';
  })();

  // Sync mute state
  useEffect(() => {
    const handleMuteChange = (e: any) => {
      setIsMuted(!!e?.detail?.isMuted);
    };
    window.addEventListener('nst-pedro-muted-change', handleMuteChange);
    return () => window.removeEventListener('nst-pedro-muted-change', handleMuteChange);
  }, []);

  // Listen to speaking events
  useEffect(() => {
    const handleSpeechBubble = (e: any) => {
      if (e?.detail?.text) {
        setCurrentSpeech(e.detail.text);
        setIsSpeaking(true);
      }
    };
    const handleSpeechEnd = () => {
      setIsSpeaking(false);
      if (!activeTour) {
        setIsPointing(false);
        setPose('idle');
      }
    };

    window.addEventListener('nst_pedro_speech_bubble', handleSpeechBubble);
    window.addEventListener('nst_pedro_speaking_end', handleSpeechEnd);
    return () => {
      window.removeEventListener('nst_pedro_speech_bubble', handleSpeechBubble);
      window.removeEventListener('nst_pedro_speaking_end', handleSpeechEnd);
    };
  }, [activeTour]);

  // Password focus reaction
  useEffect(() => {
    if (activeTour) return;
    if (isPasswordFocused && !showPassword) {
      setPose('smile_wink');
      setIsWinking(true);
      setCurrentSpeech('Secret password likh rahe hain, main nahi dekh raha! 🙈');
    } else if (isPasswordFocused && showPassword) {
      setPose('idle');
      setIsWinking(false);
      setCurrentSpeech('Password visible hai! Dhyan se check karein.');
    } else if (!isSpeaking) {
      setIsWinking(false);
      setPose('idle');
    }
  }, [isPasswordFocused, showPassword, isSpeaking, activeTour]);

  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setPedroVoiceMuted(nextMuted);
    if (nextMuted) {
      stopPedroVoice();
      setIsSpeaking(false);
    } else {
      speak('Aawaz on ho gayi hai! Bataiye dost, kya highlight karke bataun?');
    }
  };

  const speak = useCallback((text: string, newPose: PedroMascotPose = 'idle', point = false) => {
    setCurrentSpeech(text);
    setPose(newPose);
    setIsPointing(point);
    setIsSpeaking(true);
    pedroSpeak(text, {
      isAutomated: false,
      showBubble: true,
      onEnd: () => {
        setIsSpeaking(false);
        if (!activeTour) {
          setIsPointing(false);
          setPose('idle');
        }
      }
    });
  }, [activeTour]);

  // Get current tour steps
  const getTourSteps = useCallback((tourType: 'LOGIN' | 'SIGNUP' | 'RECOVERY'): TourStep[] => {
    if (tourType === 'LOGIN') return LOGIN_TOUR_STEPS;
    if (tourType === 'SIGNUP') return SIGNUP_TOUR_STEPS;
    return RECOVERY_TOUR_STEPS;
  }, []);

  // Run a tour step with automatic advance
  const runTourStep = useCallback((tourType: 'LOGIN' | 'SIGNUP' | 'RECOVERY', index: number) => {
    clearAutoAdvanceTimer();
    const steps = getTourSteps(tourType);
    if (index < 0 || index >= steps.length) return;
    const step = steps[index];

    setActiveTour(tourType);
    setActiveStepIndex(index);
    onSelectFieldHighlight?.(step.field);

    // Scroll highlighted field into view smoothly
    try {
      const el = document.getElementById(`field-${step.field}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch {}

    setCurrentSpeech(step.speech);
    setPose(step.pose);
    setIsPointing(step.isPointing);
    setIsSpeaking(true);

    const onStepEnd = () => {
      setIsSpeaking(false);
      clearAutoAdvanceTimer();
      // Automatic next step after 1.5s delay
      tourAutoAdvanceTimerRef.current = setTimeout(() => {
        if (index < steps.length - 1) {
          runTourStep(tourType, index + 1);
        } else {
          // Completed all steps!
          pedroSpeak('Shabash! Sabhi fields explain ho gayi hain. Ab aap bina kisi pareshani ke login ya account create kar sakte hain!', {
            isAutomated: false,
            showBubble: true,
            onEnd: () => {
              clearAutoAdvanceTimer();
              stopTour();
            }
          });
          setPose('celebrating');
          setIsPointing(false);
        }
      }, 1500);
    };

    pedroSpeak(step.speech, {
      isAutomated: false,
      showBubble: true,
      onEnd: onStepEnd
    });

    // Fallback if audio cannot play or is muted
    if (isMuted) {
      tourAutoAdvanceTimerRef.current = setTimeout(() => {
        onStepEnd();
      }, 3500);
    }
  }, [getTourSteps, onSelectFieldHighlight, isMuted]);

  // Start Tour
  const startTour = useCallback((tourType: 'LOGIN' | 'SIGNUP' | 'RECOVERY') => {
    clearAutoAdvanceTimer();
    setShowOptionsModal(false);
    if (mode !== tourType) {
      onSwitchMode(tourType);
    }
    setTimeout(() => {
      runTourStep(tourType, 0);
    }, 200);
  }, [mode, onSwitchMode, runTourStep]);

  // Next Step
  const nextTourStep = () => {
    clearAutoAdvanceTimer();
    if (!activeTour) return;
    const steps = getTourSteps(activeTour);
    if (activeStepIndex < steps.length - 1) {
      runTourStep(activeTour, activeStepIndex + 1);
    } else {
      speak('Shabash! Ab aapko pata chal gaya kahan kya bharna hai. All the best dost!', 'celebrating', false);
      stopTour();
    }
  };

  // Prev Step
  const prevTourStep = () => {
    clearAutoAdvanceTimer();
    if (!activeTour || activeStepIndex <= 0) return;
    runTourStep(activeTour, activeStepIndex - 1);
  };

  // Repeat Step
  const repeatCurrentStep = () => {
    clearAutoAdvanceTimer();
    if (!activeTour) return;
    runTourStep(activeTour, activeStepIndex);
  };

  // Stop Tour
  const stopTour = () => {
    clearAutoAdvanceTimer();
    setActiveTour(null);
    onSelectFieldHighlight?.(null);
    setIsPointing(false);
    setPose('idle');
    stopPedroVoice();
    setIsSpeaking(false);
  };

  // Tap on Pedro Mascot
  const handlePedroClick = () => {
    setShowOptionsModal(true);
    speak('Haan dost! Main Pedro hoon. Login, Sign Up ya Recovery chunein, main khud ba khud ek-ek field highlight karke samjha dunga!', 'wave');
  };

  const currentTourSteps = activeTour ? getTourSteps(activeTour) : [];
  const currentStep = activeTour ? currentTourSteps[activeStepIndex] : null;

  return (
    <>
      {/* ── PEDRO COMPACT HEADER BUTTON (Replaces ? Button in Top-Right) ── */}
      <div className="relative flex items-center select-none">
        <div
          onClick={handlePedroClick}
          className="group flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
          title="Pedro Assistant - Tap for Voice & Highlighting Guide"
        >
          {/* Mini 3D Pedro Mascot Avatar */}
          <div className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
            <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xs group-hover:bg-blue-500/20 transition-all" />
            <Pedro3DMascot
              size={36}
              level={savedPedroLevel}
              pose={pose}
              isSpeaking={isSpeaking}
              isPointing={isPointing}
              isWinking={isWinking}
              headOnly={false}
              autoSpin360={false}
              colorScheme={savedColorScheme}
            />
            {isSpeaking && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white animate-ping" />
            )}
          </div>

          {/* Pedro Label & Status Badge */}
          <div className="flex flex-col items-start leading-none text-left">
            <div className="flex items-center gap-1">
              <span className="text-xs font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                Pedro
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <span className="text-[9px] font-semibold text-slate-400 group-hover:text-slate-600 mt-0.5">
              Help &amp; Guide
            </span>
          </div>

          {/* Mini Mute/Unmute Icon */}
          <button
            type="button"
            onClick={toggleMute}
            className="ml-0.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title={isMuted ? 'Unmute voice' : 'Mute voice'}
          >
            {isMuted ? <VolumeX size={13} className="text-rose-400" /> : <Volume2 size={13} className={isSpeaking ? 'text-emerald-500 animate-pulse' : 'text-slate-400'} />}
          </button>
        </div>
      </div>

      {/* ── ACTIVE STEP-BY-STEP TOUR BAR (Floats cleanly when tour is active) ── */}
      {activeTour && currentStep && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[60] w-full max-w-sm px-3 pointer-events-auto">
          <div className="p-3 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-2xl shadow-slate-950/50 border border-amber-400/50 flex flex-col gap-2 animate-in fade-in slide-in-from-top-3 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  {activeTour} GUIDE • STEP {activeStepIndex + 1}/{currentTourSteps.length} (AUTO)
                </span>
              </div>
              <button 
                type="button" 
                onClick={stopTour}
                className="text-slate-400 hover:text-white text-xs p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="End Tour"
              >
                <X size={14} />
              </button>
            </div>

            {/* Current Step Instruction with pointer */}
            <div className="flex items-start gap-2 bg-white/10 rounded-xl p-2 border border-white/10">
              <span className="text-base shrink-0 animate-bounce">👇</span>
              <p className="text-xs font-bold text-amber-200 leading-snug">
                {currentStep.label}: <span className="text-white font-normal">{currentStep.speech}</span>
              </p>
            </div>

            {/* Controls: Prev, Repeat, Next */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={prevTourStep}
                disabled={activeStepIndex === 0}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft size={13} />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={repeatCurrentStep}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Repeat</span>
              </button>

              <button
                type="button"
                onClick={nextTourStep}
                className="text-[11px] font-black px-3.5 py-1 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 flex items-center gap-1 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <span>{activeStepIndex === currentTourSteps.length - 1 ? 'Finish 🎉' : 'Next Step 👉'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSIENT FLOATING SPEECH BUBBLE WHEN PEDRO SPEAKS (Outside Tour) ── */}
      {isSpeaking && !activeTour && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[60] w-full max-w-sm px-3 pointer-events-auto">
          <div 
            onClick={() => speak(currentSpeech)}
            className="w-full px-3 py-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-md text-white shadow-2xl border border-amber-400/40 flex items-start gap-2.5 animate-in fade-in zoom-in-95 duration-200 cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 text-xs font-black mt-0.5 shadow">
              🤖
            </div>
            <p className="flex-1 text-xs font-bold text-slate-100 leading-snug">
              {currentSpeech}
            </p>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); stopPedroVoice(); setIsSpeaking(false); }}
              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── PEDRO INTERACTIVE OPTIONS MODAL (When Pedro is tapped) ── */}
      {showOptionsModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowOptionsModal(false)}
        >
          <div 
            className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 flex items-center justify-center text-lg text-white shadow-md shadow-blue-500/25">
                  🤖
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    Pedro Live Assistant
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500">
                    Aapko kya seekhna hai? Ek click karein:
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                    isMuted ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                  title={isMuted ? 'Unmute voice' : 'Mute voice'}
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOptionsModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Guided Tours List */}
            <div className="py-3 space-y-2.5">
              {/* Tour 1: Login Guide */}
              <button
                type="button"
                onClick={() => startTour('LOGIN')}
                className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200/80 hover:border-blue-300 text-left transition-all group flex items-center gap-3.5 cursor-pointer shadow-sm hover:shadow"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                  <UserIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-black text-slate-900 group-hover:text-blue-900">
                      Log In
                    </span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 border border-blue-200">
                      Auto Highlight
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Pedro automatically Mobile, Password aur Sign In button ko screen par highlight karke bolkar samjhaye ga.
                  </p>
                </div>
                <ArrowRight size={16} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* Tour 2: Sign Up Guide */}
              <button
                type="button"
                onClick={() => startTour('SIGNUP')}
                className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-purple-50/70 border border-slate-200/80 hover:border-purple-300 text-left transition-all group flex items-center gap-3.5 cursor-pointer shadow-sm hover:shadow"
              >
                <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-sm">
                  <Sparkles size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-black text-slate-900 group-hover:text-purple-900">
                      Sign Up
                    </span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200">
                      +50 Bonus Credits
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Pura Naam, Mobile, Email, Password aur Security Answer har box ko khud ba khud highlight karega.
                  </p>
                </div>
                <ArrowRight size={16} className="text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              {/* Tour 3: Recovery */}
              <button
                type="button"
                onClick={() => startTour('RECOVERY')}
                className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-rose-50/70 border border-slate-200/80 hover:border-rose-300 text-left transition-all group flex items-center gap-3.5 cursor-pointer shadow-sm hover:shadow"
              >
                <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors shadow-sm">
                  <KeyRound size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-black text-slate-900 group-hover:text-rose-900">
                      Recovery
                    </span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                      Bina Password
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Bina password ke security question answer se turant account find aur verify karke login karne ka live tour.
                  </p>
                </div>
                <ArrowRight size={16} className="text-slate-400 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            </div>

            {/* Note */}
            <div className="pt-2 text-center border-t border-slate-100">
              <p className="text-[11px] font-bold text-indigo-600 flex items-center justify-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>Kisi bhi option par click karein, Pedro khud ba khud sab samjha dega!</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PedroAuthGuide;
