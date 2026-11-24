import React, { useState } from 'react';
import { Shield, Sparkles, X, CheckCircle2, ArrowRight, Loader2, Mail } from 'lucide-react';
import { logoutUser } from '../firebase';
import { User } from '../types';

export interface GuestRestrictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUserUpdated: (updatedUser: User) => void;
  featureName?: string;
  customMessage?: string;
}

export const GuestRestrictionModal: React.FC<GuestRestrictionModalProps> = ({
  isOpen,
  onClose,
  customMessage,
}) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleOpenAccountAuth = async () => {
    setLoading(true);
    try {
      await logoutUser().catch(() => {});
      localStorage.removeItem('nst_current_user');
      localStorage.removeItem('nsta_cached_user');
      localStorage.removeItem('nst_is_guest');
      localStorage.setItem('nst_logged_out', 'true');
    } catch {}
    onClose();
    window.location.href = '/login';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden relative text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Header */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/20 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10"
        >
          <X size={16} />
        </button>

        <div className="p-6 sm:p-7 flex flex-col items-center text-center relative z-10">
          {/* Shield Badge */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-amber-500/10 border border-amber-500/40 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
            <Shield size={32} className="text-amber-400" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-2">
            <Sparkles size={12} />
            <span>Guest Account Limitation</span>
          </div>

          <h3 className="text-lg sm:text-xl font-black text-white leading-tight mb-2">
            {customMessage ? (
              <span>Guest Account Limitation</span>
            ) : (
              <span>Guest Account me Subscription aur Paid features available nahi hain.</span>
            )}
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5">
            {customMessage || "Apne Email, Mobile Number, Face ID ya QR Code account se Login ya naya Account Create karein taaki aapka progress, streak aur payment safe rahein."}
          </p>

          {/* Perks list */}
          <div className="w-full bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5 mb-5 text-left space-y-2 text-xs">
            <div className="flex items-center gap-2.5 text-slate-200">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span>Aapka Streak, XP aur Coins hamesha cloud me save rahenge</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-200">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span>VIP / PRO Membership aur Paid locked notes unlock honge</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-200">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span>Community me questions poochna, post likhna aur likes dena allow hoga</span>
            </div>
          </div>

          <div className="w-full space-y-2.5">
            <button
              type="button"
              onClick={handleOpenAccountAuth}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-black text-sm rounded-2xl shadow-xl shadow-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-slate-900" />
                  <span>Opening Login...</span>
                </>
              ) : (
                <>
                  <Mail size={18} className="text-indigo-600 shrink-0" />
                  <span>Email / Mobile se Login Karein</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Abhi Nahi (Continue as Guest)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
