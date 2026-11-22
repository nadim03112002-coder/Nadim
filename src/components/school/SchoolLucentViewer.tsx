// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  Brain,
  Layers,
  Tv,
  FileText,
  Video,
  Headphones,
  Users,
  ChevronLeft,
  ChevronRight,
  Download,
  Volume2,
  Square,
  CheckCircle2,
  XCircle,
  RotateCcw,
  LayoutGrid,
  Printer,
  Minus,
  Plus,
  Trophy,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { ChunkedNotesReader } from '../ChunkedNotesReader';
import { UnifiedMcqPracticeView } from '../UnifiedMcqPracticeView';
import { FlashcardMcqView } from '../FlashcardMcqView';
import { SyllabusPageCard } from '../SyllabusPageCard';
import { PdfViewer } from '../PdfViewer';
import { CustomPlayer } from '../CustomPlayer';
import { ModernVideoPlayer } from '../ModernVideoPlayer';
import { ModernAudioPlayer } from '../ModernAudioPlayer';
import { formatSamsungNotesToHtml } from './ClassCurriculumNotesManager';
import { renderMathInHtml, formatExplanationHtml } from '../../utils/mathUtils';
import { downloadAsMHTML } from '../../utils/downloadUtils';
import { saveOfflineItem, getOfflineItems } from '../../utils/offlineStorage';
import { speakText, stopSpeech } from '../../utils/textToSpeech';
import { ThemeProvider } from '../../utils/themeContext';
import { TIER_THEME } from '../../utils/tierTheme';
import { getLevelFromScore } from '../../utils/levelSystem';
import {
  recordActivityOpen,
  recordActivitySeconds,
  recordMcqAnswer,
  recordMcqScore,
  getStudyActivityKey,
} from '../../utils/activityTracker';
import {
  markRoutinePageRead,
  markRoutinePageMcqDone,
  updateRoutinePageMcqScore,
  updateRoutineMcqScore,
  markRoutineMcqDone,
  getPagePointsCount,
  getPageTime,
} from '../../utils/routineAutoTrack';
import type { MCQItem, User } from '../../types';

export type LucentViewerTab =
  | 'reading'
  | 'premium'
  | 'mcq'
  | 'flashcard'
  | 'projector'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'pages';

interface NormalizedPage {
  id: string;
  pageNo: string;
  title?: string;
  topicName?: string;
  chunkNotes: string;
  htmlNotes: string;
  pdfUrl: string;
  videoUrl: string;
  audioUrl: string;
  mcqs: MCQItem[];
  htmlSections: Array<{ id: string; title?: string; html: string; chunkNotes?: string }>;
}

export interface SchoolLucentViewerProps {
  note: any;
  activeStudent?: any;
  schoolId: string;
  schoolDisplayName: string;
  classLevel: string;
  initialTab?: LucentViewerTab;
  onBack: () => void;
  onOpenStudyRoom?: () => void;
}

const stripHtmlLocal = (html: string): string =>
  String(html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const normalizeMcqItem = (raw: any, index: number, fallbackTopic: string): MCQItem => {
  const options: string[] = Array.isArray(raw?.options)
    ? raw.options.map((o: any) => String(o ?? ''))
    : [];

  let correctAnswer = 0;
  if (typeof raw?.correctAnswer === 'number' && !Number.isNaN(raw.correctAnswer)) {
    correctAnswer = raw.correctAnswer;
  } else if (typeof raw?.correctIndex === 'number' && !Number.isNaN(raw.correctIndex)) {
    correctAnswer = raw.correctIndex;
  } else if (typeof raw?.correct === 'number' && !Number.isNaN(raw.correct)) {
    correctAnswer = raw.correct;
  } else if (typeof raw?.answer === 'number' && !Number.isNaN(raw.answer)) {
    correctAnswer = raw.answer;
  } else if (typeof raw?.answer === 'string' && options.length > 0) {
    const matchedIdx = options.findIndex(
      (opt) => opt.trim().toLowerCase() === String(raw.answer).trim().toLowerCase()
    );
    if (matchedIdx >= 0) correctAnswer = matchedIdx;
    else {
      const letterIdx = ['a', 'b', 'c', 'd'].indexOf(String(raw.answer).trim().toLowerCase());
      if (letterIdx >= 0) correctAnswer = letterIdx;
    }
  }

  return {
    id: String(raw?.id || `school_q_${index}_${Date.now()}`),
    question: String(raw?.question || raw?.text || raw?.q || ''),
    options,
    correctAnswer: Math.max(0, Math.min(Math.max(0, options.length - 1), correctAnswer)),
    explanation: String(raw?.explanation || raw?.solution || ''),
    topic: String(raw?.topic || fallbackTopic || 'General'),
    subTopic: raw?.subTopic ? String(raw.subTopic) : undefined,
    imageUrl: raw?.imageUrl ? String(raw.imageUrl) : undefined,
    questionType: raw?.questionType,
  };
};

export const SchoolLucentViewer: React.FC<SchoolLucentViewerProps> = ({
  note,
  activeStudent,
  schoolId,
  schoolDisplayName,
  classLevel,
  initialTab = 'reading',
  onBack,
  onOpenStudyRoom,
}) => {
  const formatViewerClassLabel = (lvl: string) => {
    const clean = String(lvl || '').trim();
    if (/^(Nursery|Pre-?Nursery|LKG|UKG|KG|Play|Prep)/i.test(clean)) return clean;
    if (/^Class\s+/i.test(clean)) return clean;
    return `Class ${clean}`;
  };
  const displayClassLabel = formatViewerClassLabel(classLevel);
  const noteId = String(note?.id || note?.lessonTitle || note?.title || 'school_note');
  const noteTitle = String(note?.lessonTitle || note?.title || note?.chapterName || 'Class Notes');
  const subjectName = String(note?.subjectName || note?.subject || 'School');
  const bookName = String(note?.bookName || '');
  const teacherName = String(note?.teacherName || note?.schoolName || schoolDisplayName || 'School');

  // Synthesize an unlocked ULTRA User object so school students never hit NSTA coin/paywall popups
  const viewerUser: User = useMemo(() => ({
    id: String(activeStudent?.id || activeStudent?.uid || `school_${schoolId}_student`),
    uid: String(activeStudent?.uid || activeStudent?.id || `school_${schoolId}_student`),
    name: String(activeStudent?.name || 'Student'),
    email: String(activeStudent?.email || ''),
    role: 'STUDENT',
    classLevel: String(classLevel || activeStudent?.classLevel || '10') as any,
    subscriptionTier: 'ULTRA' as any,
    subscriptionLevel: 'ULTRA' as any,
    isPremium: true,
    studyMode: 'WITHOUT_CREDIT',
    credits: 9999,
    totalScore: Number(activeStudent?.totalScore || 0),
    mobile: String(activeStudent?.mobile || activeStudent?.phone || ''),
    board: String(activeStudent?.board || 'CBSE') as any,
    streak: Number(activeStudent?.streak || 0),
    lastLoginDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  } as any), [activeStudent, schoolId, classLevel]);

  // Normalize pages[] + top-level legacy fields
  const normalizedPages: NormalizedPage[] = useMemo(() => {
    const rawPages = Array.isArray(note?.pages) ? note.pages : [];
    const topLevelMcqsRaw = Array.isArray(note?.mcqs)
      ? note.mcqs
      : Array.isArray(note?.questions)
        ? note.questions
        : [];

    const extractPageHeading = (pg: any, plainText: string, idx: number, totalCount: number): string => {
      const explicit = String(pg?.topicName || pg?.title || '').trim();
      if (explicit) return explicit;
      const firstLine = (plainText || '')
        .split(/\r?\n/)
        .map((l) => l.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim())
        .find((l) => l.length > 0);
      if (firstLine) return firstLine.slice(0, 72);
      return totalCount > 1 ? `${noteTitle} · Page ${pg?.pageNo || idx + 1}` : noteTitle;
    };

    if (rawPages.length > 0) {
      return rawPages.map((pg: any, idx: number) => {
        const pageNo = String(pg?.pageNo || idx + 1);
        const rawHtml = String(pg?.htmlNotes || '').trim();
        const rawPlain = String(pg?.chunkNotes || pg?.content || '').trim();
        const derivedPlain = rawPlain || (rawHtml ? stripHtmlLocal(rawHtml) : '');
        const pageHeading = extractPageHeading(pg, derivedPlain, idx, rawPages.length);
        const pageMcqsRaw = Array.isArray(pg?.mcqs) ? pg.mcqs : [];
        const combinedRaw =
          idx === 0 && topLevelMcqsRaw.length > 0 && pageMcqsRaw.length === 0
            ? topLevelMcqsRaw
            : pageMcqsRaw;

        const sections = Array.isArray(pg?.schoolHtmlSections)
          ? pg.schoolHtmlSections
          : Array.isArray(pg?.htmlSections)
            ? pg.htmlSections
            : [];

        return {
          id: String(pg?.id || `${noteId}_p_${idx + 1}`),
          pageNo,
          title: pageHeading,
          topicName: pageHeading,
          chunkNotes: derivedPlain,
          htmlNotes: rawHtml,
          pdfUrl: String(pg?.pdfUrl || pg?.attachmentUrl || (idx === 0 ? (note?.pdfUrl || note?.attachmentUrl || '') : '')),
          videoUrl: String(pg?.videoUrl || (idx === 0 ? (note?.videoUrl || '') : '')),
          audioUrl: String(pg?.audioUrl || (idx === 0 ? (note?.audioUrl || '') : '')),
          mcqs: combinedRaw
            .filter((q: any) => q && (q.question || q.text || q.q))
            .map((q: any, qIdx: number) => normalizeMcqItem(q, qIdx, `${noteTitle} (Page ${pageNo})`)),
          htmlSections: sections,
        };
      });
    }

    // Legacy single-page note
    const rawHtml = String(note?.htmlNotes || '').trim();
    const rawPlain = String(note?.chunkNotes || note?.content || note?.description || '').trim();
    const derivedPlain = rawPlain || (rawHtml ? stripHtmlLocal(rawHtml) : '');
    const singleHeading = extractPageHeading(note, derivedPlain, 0, 1);

    return [
      {
        id: `${noteId}_p_1`,
        pageNo: '1',
        title: singleHeading,
        topicName: singleHeading,
        chunkNotes: derivedPlain,
        htmlNotes: rawHtml,
        pdfUrl: String(note?.pdfUrl || note?.attachmentUrl || ''),
        videoUrl: String(note?.videoUrl || ''),
        audioUrl: String(note?.audioUrl || ''),
        mcqs: topLevelMcqsRaw
          .filter((q: any) => q && (q.question || q.text || q.q))
          .map((q: any, qIdx: number) => normalizeMcqItem(q, qIdx, noteTitle)),
        htmlSections: Array.isArray(note?.schoolHtmlSections)
          ? note.schoolHtmlSections
          : Array.isArray(note?.htmlSections)
            ? note.htmlSections
            : [],
      },
    ];
  }, [note, noteId, noteTitle]);

  const allLessonMcqs: MCQItem[] = useMemo(() => {
    const seen = new Set<string>();
    const combined: MCQItem[] = [];
    const topRaw = Array.isArray(note?.mcqs)
      ? note.mcqs
      : Array.isArray(note?.questions)
        ? note.questions
        : [];
    topRaw.forEach((q: any, i: number) => {
      const item = normalizeMcqItem(q, i, noteTitle);
      if (item.question && !seen.has(item.question)) {
        seen.add(item.question);
        combined.push(item);
      }
    });
    normalizedPages.forEach((pg) => {
      pg.mcqs.forEach((item) => {
        if (item.question && !seen.has(item.question)) {
          seen.add(item.question);
          combined.push(item);
        }
      });
    });
    return combined;
  }, [note, normalizedPages, noteTitle]);

  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [expandedPageIdx, setExpandedPageIdx] = useState<number | null>(() =>
    normalizedPages.length > 1 ? null : 0
  );
  const safePageIndex = Math.max(0, Math.min(normalizedPages.length - 1, activePageIndex));
  const activePage = normalizedPages[safePageIndex];

  const [activeTab, setActiveTab] = useState<LucentViewerTab>(initialTab);
  const [mcqScope, setMcqScope] = useState<'page' | 'all'>(() =>
    activePage?.mcqs?.length > 0 ? 'page' : 'all'
  );
  const [mistakeOnlyIndices, setMistakeOnlyIndices] = useState<number[] | null>(null);
  const [mcqSessionKey, setMcqSessionKey] = useState<number>(1);
  const [mcqResultSummary, setMcqResultSummary] = useState<{
    score: number;
    total: number;
    attempted: number;
    answers: Record<number, number>;
    timeElapsedSeconds: number;
    questionsSnapshot: MCQItem[];
  } | null>(null);

  const tabScrollRef = useRef<HTMLDivElement | null>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const centerActiveTab = useCallback((tab: LucentViewerTab, behavior: ScrollBehavior = 'smooth') => {
    const container = tabScrollRef.current;
    const btn = tabButtonRefs.current[tab];
    if (!container || !btn) return;
    const targetLeft = Math.max(0, btn.offsetLeft - (container.clientWidth - btn.clientWidth) / 2);
    try {
      container.scrollTo({ left: targetLeft, behavior });
    } catch {
      container.scrollLeft = targetLeft;
    }
  }, []);

  useEffect(() => {
    setActivePageIndex(0);
    setExpandedPageIdx(normalizedPages.length > 1 ? null : 0);
    setActiveTab(initialTab);
    setMistakeOnlyIndices(null);
    setMcqResultSummary(null);
  }, [noteId, initialTab, normalizedPages.length]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => centerActiveTab(activeTab, 'smooth'));
    const timer = window.setTimeout(() => centerActiveTab(activeTab, 'auto'), 80);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [activeTab, centerActiveTab]);

  // Premium Notes controls
  const [premiumFontSize, setPremiumFontSize] = useState<number>(15);
  const [isSpeakingPremium, setIsSpeakingPremium] = useState<boolean>(false);

  // Starred points persisted per student + note
  const starStorageKey = `nst_school_stars_${viewerUser.id}_${noteId}`;
  const [starredSet, setStarredSet] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(starStorageKey);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const isTopicStarred = useCallback((text: string) => starredSet.has(text), [starredSet]);
  const toggleTopicStar = useCallback((text: string) => {
    setStarredSet((prev) => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      try {
        localStorage.setItem(starStorageKey, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, [starStorageKey]);

  // Offline saved check
  const [isSavedOffline, setIsSavedOffline] = useState<boolean>(false);
  useEffect(() => {
    let mounted = true;
    getOfflineItems().then((items) => {
      if (mounted) {
        setIsSavedOffline(items.some((i) => i.id === `school_note_${noteId}_p_${safePageIndex}`));
      }
    }).catch(() => {});
    return () => {
      mounted = false;
    };
  }, [noteId, safePageIndex]);

  const handleSaveOffline = useCallback(async () => {
    try {
      await saveOfflineItem({
        id: `school_note_${noteId}_p_${safePageIndex}`,
        type: 'NOTE',
        title: `${noteTitle} (Page ${activePage.pageNo})`,
        subtitle: `${subjectName} • ${displayClassLabel} • ${schoolDisplayName}`,
        data: {
          content: activePage.htmlNotes || activePage.chunkNotes,
          chunkNotes: activePage.chunkNotes,
          mcqs: activePage.mcqs,
        },
      });
      setIsSavedOffline(true);
      toast.success(`Page ${activePage.pageNo} offline save ho gaya!`);
    } catch {
      toast.error('Offline save karne me error aaya.');
    }
  }, [noteId, safePageIndex, noteTitle, activePage, subjectName, classLevel, schoolDisplayName]);

  // Keep TTS clean on tab change / unmount
  useEffect(() => {
    return () => {
      try { stopSpeech(); } catch {}
    };
  }, []);

  const handleTabSwitch = (tab: LucentViewerTab) => {
    if (tab !== activeTab) {
      try { stopSpeech(); } catch {}
      setIsSpeakingPremium(false);
    }
    setActiveTab(tab);
  };

  // Track active reading/writing time cleanly per page (local storage only, 0 Firestore billing!)
  const contentActivityKey = useMemo(
    () => getStudyActivityKey(noteId, safePageIndex),
    [noteId, safePageIndex]
  );

  useEffect(() => {
    if (activeTab !== 'reading' && activeTab !== 'premium') return;
    try {
      recordActivityOpen(
        viewerUser.id,
        contentActivityKey,
        activeTab === 'premium' ? 'WRITING' : 'READING'
      );
    } catch {}
  }, [noteId, safePageIndex, contentActivityKey, viewerUser.id, activeTab]);

  useEffect(() => {
    if (activeTab !== 'reading' && activeTab !== 'premium') return;
    const mode = activeTab === 'premium' ? 'WRITING' : 'READING';
    const pointsCount = getPagePointsCount(activePage);
    const reqSec = pointsCount * 6;
    const interval = window.setInterval(() => {
      try {
        recordActivitySeconds(viewerUser.id, contentActivityKey, mode, 5);
        const currentSecs = getPageTime(noteId, safePageIndex);
        if (currentSecs >= reqSec) {
          markRoutinePageRead(noteId, safePageIndex);
        }
      } catch {}
    }, 5000);
    return () => window.clearInterval(interval);
  }, [activeTab, viewerUser.id, contentActivityKey, activePage, noteId, safePageIndex]);

  // Reading Score Config for ChunkedNotesReader HUD
  const readingScoreConfig = useMemo(() => ({
    userId: viewerUser.id,
    userLevel: getLevelFromScore(viewerUser.totalScore || 0),
    subscriptionLevel: 'ULTRA',
    isPremium: true,
    boostPercent: 0,
    mode: 'reading' as const,
    lessonLabel: `${noteTitle} · Pg ${activePage.pageNo}`,
  }), [viewerUser.id, viewerUser.totalScore, noteTitle, activePage.pageNo]);

  // Resolve active MCQs strictly for the opened page (or full lesson only when triggered via "All MCQs")
  const activePageMcqs: MCQItem[] = useMemo(() => {
    if (mcqScope === 'all') return allLessonMcqs.length > 0 ? allLessonMcqs : activePage.mcqs;
    return activePage.mcqs;
  }, [mcqScope, activePage.mcqs, allLessonMcqs]);

  const activePracticeQuestions: MCQItem[] = useMemo(() => {
    if (mistakeOnlyIndices && mistakeOnlyIndices.length > 0) {
      const picked = mistakeOnlyIndices.map((idx) => activePageMcqs[idx]).filter(Boolean);
      if (picked.length > 0) return picked;
    }
    return activePageMcqs;
  }, [activePageMcqs, mistakeOnlyIndices]);

  // Render Styled Premium Notes HTML
  const premiumHtmlRendered = useMemo(() => {
    const rawHtml = activePage.htmlNotes?.trim();
    if (rawHtml) return renderMathInHtml(rawHtml);
    if (activePage.chunkNotes?.trim()) {
      return renderMathInHtml(formatSamsungNotesToHtml(activePage.chunkNotes));
    }
    return '';
  }, [activePage]);

  const handleTogglePremiumSpeech = () => {
    if (isSpeakingPremium) {
      stopSpeech();
      setIsSpeakingPremium(false);
      return;
    }
    const textToRead = activePage.chunkNotes || stripHtmlLocal(activePage.htmlNotes);
    if (!textToRead.trim()) {
      toast.info('Padhne ke liye notes text available nahi hai.');
      return;
    }
    setIsSpeakingPremium(true);
    speakText(textToRead, 'hi-IN', 1.0, () => {
      setIsSpeakingPremium(false);
    });
  };

  const handleDownloadMhtml = async () => {
    try {
      await downloadAsMHTML('school-notes-maker-printable', `${noteTitle}_Page_${activePage.pageNo}`, {
        appName: schoolDisplayName,
        pageTitle: `${noteTitle} - Page ${activePage.pageNo}`,
        subtitle: `${subjectName} • ${displayClassLabel}`,
      });
      toast.success('Notes file download ho gayi!');
    } catch {
      window.print();
    }
  };

  // Back from Page List exits to Lessons list; Back from an opened Page returns to Page List (if entered via Page List)
  const handleBackExit = () => {
    try { stopSpeech(); } catch {}
    setIsSpeakingPremium(false);
    if (activeTab !== 'pages' && initialTab === 'pages') {
      setActiveTab('pages');
      return;
    }
    onBack();
  };

  // Strict per-page media so opening Page X only shows Page X's PDF / Video / Audio
  const activePdfUrl = activePage.pdfUrl || '';
  const activeVideoUrl = activePage.videoUrl || '';
  const activeAudioUrl = activePage.audioUrl || '';

  const showMcqAlert = useCallback((msg: string, type?: string, title?: string) => {
    if (type === 'ERROR') toast.error(title ? `${title}: ${msg}` : msg);
    else if (type === 'SUCCESS') toast.success(title ? `${title}: ${msg}` : msg);
    else toast.info(title ? `${title}: ${msg}` : msg);
  }, []);

  // Top dark-navy tab bar matching Lucent Viewer: uniform button sizes, 3 buttons visible per viewport
  const tabBtnBase =
    'relative w-1/3 min-w-[33.3333%] max-w-[33.3333%] shrink-0 h-10 px-1.5 text-[10.5px] sm:text-xs font-extrabold tracking-tight whitespace-nowrap transition flex items-center justify-center gap-1 cursor-pointer snap-start border-r border-white/5';

  const renderTabBar = () => (
    <div
      className="shrink-0 w-full select-none shadow-md z-30"
      style={{
        background: 'linear-gradient(135deg, #0d0e26 0%, #15163B 55%, #1e1b4b 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div className="flex items-stretch">
        {/* Fixed Back Arrow */}
        <button
          type="button"
          onClick={handleBackExit}
          className="shrink-0 w-9 h-10 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer border-r border-white/10"
          title="Back to Syllabus"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Scrollable 3-per-screen equal-width tab strip (NO Pages button here!) */}
        <div
          ref={(el) => {
            tabScrollRef.current = el;
            if (el) {
              const btn = tabButtonRefs.current[activeTab];
              if (btn) {
                const targetLeft = Math.max(0, btn.offsetLeft - (el.clientWidth - btn.clientWidth) / 2);
                el.scrollLeft = targetLeft;
              }
            }
          }}
          className="flex-1 min-w-0 flex items-stretch overflow-x-auto no-scrollbar"
        >
          {/* Tab 1: Reading Mode */}
          <button
            ref={(el) => { tabButtonRefs.current.reading = el; }}
            type="button"
            onClick={() => handleTabSwitch('reading')}
            className={`${tabBtnBase} ${
              activeTab === 'reading' ? 'text-white bg-white/5' : 'text-slate-300/75 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Reading Mode</span>
            {activeTab === 'reading' && (
              <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.9)]" />
            )}
          </button>

          {/* Tab 3: Premium Notes */}
          <button
            ref={(el) => { tabButtonRefs.current.premium = el; }}
            type="button"
            onClick={() => handleTabSwitch('premium')}
            className={`${tabBtnBase} ${
              activeTab === 'premium' ? 'text-white bg-white/5' : 'text-slate-300/75 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="truncate">Premium Notes</span>
            {activeTab === 'premium' && (
              <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
            )}
          </button>

          {/* Tab 3: MCQ Practice */}
          <button
            ref={(el) => { tabButtonRefs.current.mcq = el; }}
            type="button"
            onClick={() => {
              setMcqResultSummary(null);
              handleTabSwitch('mcq');
            }}
            className={`${tabBtnBase} ${
              activeTab === 'mcq' ? 'text-white bg-white/5' : 'text-slate-300/75 hover:text-white'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span className="truncate">
              MCQ{activePageMcqs.length > 0 ? ` (${activePageMcqs.length})` : ''}
            </span>
            {activeTab === 'mcq' && (
              <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            )}
          </button>

          {/* Tab 4: Flashcard */}
          <button
            ref={(el) => { tabButtonRefs.current.flashcard = el; }}
            type="button"
            onClick={() => handleTabSwitch('flashcard')}
            className={`${tabBtnBase} ${
              activeTab === 'flashcard'
                ? 'text-white bg-white/5'
                : activePageMcqs.length > 0
                  ? 'text-slate-300/85 hover:text-white'
                  : 'text-slate-400/60 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <span className="truncate">Flashcard</span>
            {activeTab === 'flashcard' && (
              <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
            )}
          </button>

          {/* Tab 5: Projector */}
          <button
            ref={(el) => { tabButtonRefs.current.projector = el; }}
            type="button"
            onClick={() => handleTabSwitch('projector')}
            className={`${tabBtnBase} ${
              activeTab === 'projector'
                ? 'text-white bg-white/5'
                : activePageMcqs.length > 0
                  ? 'text-slate-300/85 hover:text-white'
                  : 'text-slate-400/60 hover:text-slate-200'
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-rose-300 shrink-0" />
            <span className="truncate">Projector</span>
            {activeTab === 'projector' && (
              <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]" />
            )}
          </button>

          {/* Tab 7: PDF */}
          <button
            ref={(el) => { tabButtonRefs.current.pdf = el; }}
            type="button"
            onClick={() => handleTabSwitch('pdf')}
            className={`${tabBtnBase} ${
              activeTab === 'pdf'
                ? 'text-white bg-white/5'
                : activePdfUrl
                  ? 'text-slate-300/85 hover:text-white'
                  : 'text-slate-400/60 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-orange-300 shrink-0" />
            <span className="truncate">PDF</span>
            {activePdfUrl && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
            )}
            {activeTab === 'pdf' && (
              <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-orange-400" />
            )}
          </button>

          {/* Tab 8: Video */}
          <button
            ref={(el) => { tabButtonRefs.current.video = el; }}
            type="button"
            onClick={() => handleTabSwitch('video')}
            className={`${tabBtnBase} ${
              activeTab === 'video'
                ? 'text-white bg-white/5'
                : activeVideoUrl
                  ? 'text-slate-300/85 hover:text-white'
                  : 'text-slate-400/60 hover:text-slate-200'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-red-300 shrink-0" />
            <span className="truncate">Video</span>
            {activeVideoUrl && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
            )}
            {activeTab === 'video' && (
              <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-red-400" />
            )}
          </button>

          {/* Tab 9: Audio */}
          <button
            ref={(el) => { tabButtonRefs.current.audio = el; }}
            type="button"
            onClick={() => handleTabSwitch('audio')}
            className={`${tabBtnBase} ${
              activeTab === 'audio'
                ? 'text-white bg-white/5'
                : activeAudioUrl
                  ? 'text-slate-300/85 hover:text-white'
                  : 'text-slate-400/60 hover:text-slate-200'
            }`}
          >
            <Headphones className="w-3.5 h-3.5 text-teal-300 shrink-0" />
            <span className="truncate">Audio</span>
            {activeAudioUrl && (
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
            )}
            {activeTab === 'audio' && (
              <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-teal-400" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Flashcard or Projector tab handles its own fullscreen portal/layout and embeds tabBar natively!
  if ((activeTab === 'flashcard' || activeTab === 'projector') && activePageMcqs.length > 0) {
    return (
      <ThemeProvider theme={TIER_THEME.ultra}>
        <div className="fixed inset-0 z-[120] bg-white flex flex-col overflow-hidden">
          <FlashcardMcqView
            questions={activePracticeQuestions.length > 0 ? activePracticeQuestions : activePageMcqs}
            title={noteTitle}
            subtitle={`${subjectName} • ${displayClassLabel}${normalizedPages.length > 1 ? ` • Page ${activePage.pageNo}` : ''}`}
            subject={subjectName}
            user={viewerUser}
            onBack={handleBackExit}
            startInProjectorMode={activeTab === 'projector'}
            onProjectorModeChange={(enabled) => {
              setActiveTab(enabled ? 'projector' : 'flashcard');
            }}
            tabBar={renderTabBar()}
            sourceMeta={{
              lessonTitle: noteTitle,
              subject: subjectName,
              classLevel,
            }}
            sourceKey={`school_${schoolId}_${noteId}_p${safePageIndex}`}
          />
        </div>
      </ThemeProvider>
    );
  }

  // PDF Viewer mode (uses existing full PdfViewer inside viewer container)
  if (activeTab === 'pdf' && activePdfUrl) {
    return (
      <ThemeProvider theme={TIER_THEME.ultra}>
        <div className="fixed inset-0 z-[120] bg-slate-950 flex flex-col overflow-hidden">
          {renderTabBar()}
          <div className="flex-1 min-h-0 relative">
            <PdfViewer
              url={activePdfUrl}
              title={`${noteTitle}${normalizedPages.length > 1 ? ` · Page ${activePage.pageNo}` : ''}`}
              onBack={() => handleTabSwitch('reading')}
              sessionKey={`school_${schoolId}_${noteId}_p${safePageIndex}`}
              userId={viewerUser.id}
              userLevel={getLevelFromScore(viewerUser.totalScore || 0)}
              subscriptionLevel="ULTRA"
              isPremium={true}
              boostPercent={0}
            />
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Video Player mode
  if (activeTab === 'video' && activeVideoUrl) {
    const isYt = activeVideoUrl.includes('youtube.com') || activeVideoUrl.includes('youtu.be');
    return (
      <ThemeProvider theme={TIER_THEME.ultra}>
        <div className="fixed inset-0 z-[120] bg-black flex flex-col overflow-hidden">
          {renderTabBar()}
          <div className="flex-1 min-h-0 relative flex flex-col justify-center bg-black">
            {isYt ? (
              <CustomPlayer
                videoUrl={activeVideoUrl}
                videoTitle={`${noteTitle} · ${subjectName}`}
                onBack={() => handleTabSwitch('reading')}
              />
            ) : (
              <ModernVideoPlayer
                videoUrl={activeVideoUrl}
                title={`${noteTitle} · Page ${activePage.pageNo}`}
                mediaId={`school_vid_${noteId}_p${safePageIndex}`}
                subject={subjectName}
                appName={schoolDisplayName}
                user={viewerUser}
                isFirstLesson={true}
                onBack={() => handleTabSwitch('reading')}
              />
            )}
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Audio Player mode
  if (activeTab === 'audio' && activeAudioUrl) {
    return (
      <ThemeProvider theme={TIER_THEME.ultra}>
        <div className="fixed inset-0 z-[120] bg-slate-950 flex flex-col overflow-hidden">
          {renderTabBar()}
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-xl">
              <ModernAudioPlayer
                audioUrl={activeAudioUrl}
                title={noteTitle}
                subtitle={`${subjectName} • ${displayClassLabel} • Page ${activePage.pageNo}`}
                mediaId={`school_aud_${noteId}_p${safePageIndex}`}
                appName={schoolDisplayName}
                user={viewerUser}
                onBack={() => handleTabSwitch('reading')}
              />
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={TIER_THEME.ultra}>
      <div className="fixed inset-0 z-[120] bg-white flex flex-col overflow-hidden">
        {/* Top Navy Lucent Tab Bar shown ONLY inside an opened page (never on the Page List screen) */}
        {activeTab !== 'pages' && renderTabBar()}

        {/* ── TAB: READING MODE (Full ChunkedNotesReader A-to-Z) ── */}
        {activeTab === 'reading' && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-white">
            {activePage.chunkNotes ? (
              <div className="max-w-4xl mx-auto px-3 sm:px-6 pb-20">
                <ChunkedNotesReader
                  key={`${noteId}_p_${safePageIndex}`}
                  content={activePage.chunkNotes}
                  htmlContent={activePage.htmlNotes || undefined}
                  language="hi-IN"
                  topBarLabel={
                    normalizedPages.length > 1
                      ? `Page ${activePage.pageNo}`
                      : noteTitle
                  }
                  className="bg-white pt-1 pb-8"
                  noteKey={`school_${schoolId}_${noteId}_p${safePageIndex}`}
                  isStarred={isTopicStarred}
                  onStarToggle={toggleTopicStar}
                  preferChunkMode={true}
                  hideDesktopToggle={true}
                  hideFix={true}
                  isUltraUser={true}
                  isBasicUser={true}
                  hideLockedTabs={false}
                  readingScoreConfig={readingScoreConfig}
                  onBack={handleBackExit}
                  onSaveOffline={handleSaveOffline}
                  isSavedOffline={isSavedOffline}
                  sourceMeta={{
                    lessonTitle: noteTitle,
                    pageNo: activePage.pageNo,
                    subject: subjectName,
                    classLevel,
                  }}
                />
              </div>
            ) : (
              <div className="max-w-xl mx-auto my-12 p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                <BookOpen className="w-10 h-10 text-indigo-500 mx-auto" />
                <h4 className="text-base font-black text-slate-800">
                  Is page par text notes available nahi hain
                </h4>
                <p className="text-xs text-slate-500">
                  Agar teacher ne PDF, Video, Premium HTML ya MCQ upload kiya hai toh upar wale tabs se kholen.
                </p>
                <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
                  {activePage.mcqs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleTabSwitch('mcq')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Practice MCQs ({activePage.mcqs.length})
                    </button>
                  )}
                  {activePdfUrl && (
                    <button
                      type="button"
                      onClick={() => handleTabSwitch('pdf')}
                      className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Open PDF
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EMPTY STATES FOR UN-UPLOADED FLASHCARD / PROJECTOR / PDF / VIDEO / AUDIO ── */}
        {(
          (activeTab === 'flashcard' && activePageMcqs.length === 0) ||
          (activeTab === 'projector' && activePageMcqs.length === 0) ||
          (activeTab === 'pdf' && !activePdfUrl) ||
          (activeTab === 'video' && !activeVideoUrl) ||
          (activeTab === 'audio' && !activeAudioUrl)
        ) && (
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
            <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto">
                {activeTab === 'pdf' && <FileText className="w-7 h-7" />}
                {activeTab === 'video' && <Video className="w-7 h-7" />}
                {activeTab === 'audio' && <Headphones className="w-7 h-7" />}
                {activeTab === 'flashcard' && <Layers className="w-7 h-7" />}
                {activeTab === 'projector' && <Tv className="w-7 h-7" />}
              </div>
              <h4 className="text-base font-black text-slate-900">
                {activeTab === 'pdf' && 'Is lesson me abhi PDF upload nahi hua hai'}
                {activeTab === 'video' && 'Is lesson me abhi Video upload nahi hua hai'}
                {activeTab === 'audio' && 'Is lesson me abhi Audio upload nahi hua hai'}
                {activeTab === 'flashcard' && 'Flashcard ke liye abhi MCQ upload nahi hain'}
                {activeTab === 'projector' && 'Projector mode ke liye abhi MCQ upload nahi hain'}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Teacher ya Admin jaise hi Class Notes Manager me is lesson ka{' '}
                {activeTab === 'pdf' ? 'PDF' : activeTab === 'video' ? 'Video' : activeTab === 'audio' ? 'Audio' : 'MCQ (ya Bulk MCQ)'}{' '}
                add karenge, yeh tab turant automatic chalu ho jayega!
              </p>
              <button
                type="button"
                onClick={() => handleTabSwitch('reading')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
              >
                Reading Mode par Wapas Jayein
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: PREMIUM NOTES (Styled HTML + Math + Print/Save + TTS) ── */}
        {activeTab === 'premium' && (
          <div className="flex-1 min-h-0 flex flex-col bg-slate-50">
            {/* Sub-header toolbar */}
            <div className="shrink-0 bg-white border-b border-slate-200 px-3 sm:px-5 py-2 flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                  {noteTitle} {normalizedPages.length > 1 ? `· Page ${activePage.pageNo}` : ''}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 truncate">
                  {subjectName} • {displayClassLabel} • {teacherName}{bookName ? ` • 📖 ${bookName}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setPremiumFontSize((s) => Math.max(12, s - 1))}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center cursor-pointer"
                  title="Decrease Font"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-bold text-slate-500 w-7 text-center">{premiumFontSize}px</span>
                <button
                  type="button"
                  onClick={() => setPremiumFontSize((s) => Math.min(26, s + 1))}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center cursor-pointer"
                  title="Increase Font"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleTogglePremiumSpeech}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 transition cursor-pointer ${
                    isSpeakingPremium
                      ? 'bg-rose-600 text-white'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  {isSpeakingPremium ? <Square className="w-3 h-3" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{isSpeakingPremium ? 'Stop' : 'Listen'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMhtml}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  title="Print Notes"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-6">
              <div id="school-notes-maker-printable" className="max-w-4xl mx-auto space-y-4">
                {premiumHtmlRendered ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div
                      className="notes-html-content p-4 sm:p-6 text-slate-800"
                      style={{ fontSize: `${premiumFontSize}px`, lineHeight: '1.8' }}
                      dangerouslySetInnerHTML={{ __html: premiumHtmlRendered }}
                    />
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                    Is page par Premium HTML notes abhi available nahi hain.
                  </div>
                )}

                {activePage.htmlSections.map((sec, sIdx) => (
                  <div
                    key={sec.id || sIdx}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
                  >
                    {sec.title && (
                      <div className="px-5 pt-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center">
                          {sIdx + 1}
                        </span>
                        <h4 className="text-sm font-black text-slate-800">{sec.title}</h4>
                      </div>
                    )}
                    {sec.html && (
                      <div
                        className="notes-html-content p-4 sm:p-6 text-slate-800"
                        style={{ fontSize: `${premiumFontSize}px`, lineHeight: '1.8' }}
                        dangerouslySetInnerHTML={{ __html: renderMathInHtml(sec.html) }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: MCQ PRACTICE (UnifiedMcqPracticeView + Results + Mistakes) ── */}
        {activeTab === 'mcq' && (
          <div className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
            {activePageMcqs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3 shadow-sm">
                  <Brain className="w-12 h-12 text-slate-300 mx-auto" />
                  <h4 className="text-base font-black text-slate-800">Is lesson me abhi MCQs add nahi hain</h4>
                  <p className="text-xs text-slate-500">
                    Aap Reading Mode aur Premium Notes tabs se notes padh sakte hain. Jab teacher MCQ upload karenge toh yahan practice engine chalu ho jayega.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('reading')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Back to Reading Mode
                  </button>
                </div>
              </div>
            ) : mcqResultSummary ? (
              /* Post-Submit Analysis & Mistakes Review */
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="max-w-3xl mx-auto space-y-4 pb-12">
                  <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                          <Trophy className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900">MCQ Practice Result</h3>
                          <p className="text-xs text-slate-500">{noteTitle} • {subjectName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-indigo-600">
                          {mcqResultSummary.score}/{mcqResultSummary.total}
                        </div>
                        <div className="text-[11px] font-bold text-slate-500">
                          {Math.round((mcqResultSummary.score / Math.max(1, mcqResultSummary.total)) * 100)}% Accuracy • {mcqResultSummary.timeElapsedSeconds}s
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setMistakeOnlyIndices(null);
                          setMcqResultSummary(null);
                          setMcqSessionKey((k) => k + 1);
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Re-attempt All
                      </button>

                      {(() => {
                        const wrongIdxs = mcqResultSummary.questionsSnapshot
                          .map((q, idx) =>
                            mcqResultSummary.answers[idx] !== q.correctAnswer ? idx : -1
                          )
                          .filter((idx) => idx >= 0);
                        if (wrongIdxs.length === 0) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setMistakeOnlyIndices(wrongIdxs);
                              setMcqResultSummary(null);
                              setMcqSessionKey((k) => k + 1);
                            }}
                            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                          >
                            <AlertCircle className="w-3.5 h-3.5" /> Practice Mistakes ({wrongIdxs.length})
                          </button>
                        );
                      })()}

                      <button
                        type="button"
                        onClick={() => handleTabSwitch('flashcard')}
                        className="px-4 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" /> Flashcard Review
                      </button>
                    </div>
                  </div>

                  {/* Question-by-question solution breakdown */}
                  <div className="space-y-3">
                    {mcqResultSummary.questionsSnapshot.map((q, idx) => {
                      const chosen = mcqResultSummary.answers[idx];
                      const isCorrect = chosen === q.correctAnswer;
                      return (
                        <div
                          key={q.id || idx}
                          className={`bg-white rounded-2xl border p-4 space-y-2.5 ${
                            isCorrect ? 'border-emerald-200' : 'border-rose-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className="text-sm font-bold text-slate-900"
                              dangerouslySetInnerHTML={{
                                __html: renderMathInHtml(`Q${idx + 1}. ${q.question}`),
                              }}
                            />
                            {isCorrect ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {q.options.map((opt, oIdx) => {
                              const right = oIdx === q.correctAnswer;
                              const picked = oIdx === chosen;
                              return (
                                <div
                                  key={oIdx}
                                  className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                                    right
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                      : picked
                                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                                        : 'bg-slate-50 border-slate-200 text-slate-600'
                                  }`}
                                >
                                  <span className="font-black mr-1.5">{String.fromCharCode(65 + oIdx)}.</span>
                                  <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }} />
                                </div>
                              );
                            })}
                          </div>
                          {q.explanation && (
                            <div
                              className="text-xs text-slate-600 bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 notes-html-content"
                              dangerouslySetInnerHTML={{ __html: formatExplanationHtml(q.explanation) }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Active UnifiedMcqPracticeView */
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {normalizedPages.length > 1 && (activePage.mcqs.length > 0 || allLessonMcqs.length > activePage.mcqs.length) && (
                  <div className="shrink-0 bg-white border-b border-slate-200 px-3 py-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {activePage.mcqs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setMcqScope('page');
                            setMistakeOnlyIndices(null);
                            setMcqSessionKey((k) => k + 1);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition ${
                            mcqScope === 'page'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Page {activePage.pageNo} ({activePage.mcqs.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setMcqScope('all');
                          setMistakeOnlyIndices(null);
                          setMcqSessionKey((k) => k + 1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition ${
                          mcqScope === 'all' || activePage.mcqs.length === 0
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        All Lesson ({allLessonMcqs.length})
                      </button>
                    </div>
                    {mistakeOnlyIndices && (
                      <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        Mistake Mode ({activePracticeQuestions.length})
                      </span>
                    )}
                  </div>
                )}

                <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
                  <UnifiedMcqPracticeView
                    key={`mcq_${noteId}_${mcqScope}_${safePageIndex}_${mcqSessionKey}`}
                    questions={activePracticeQuestions}
                    title={noteTitle}
                    subtitle={`${subjectName} • ${displayClassLabel}${mcqScope === 'page' && normalizedPages.length > 1 ? ` • Page ${activePage.pageNo}` : ''}`}
                    subject={subjectName}
                    accent="#4f46e5"
                    user={viewerUser}
                    onBack={() => handleTabSwitch('reading')}
                    onAnswer={(qIdx, _optIdx, isCorrect) => {
                      const q = activePracticeQuestions[qIdx];
                      if (!q) return;
                      try {
                        markRoutinePageMcqDone(noteId, safePageIndex);
                        markRoutineMcqDone(noteId);
                        recordMcqAnswer(
                          viewerUser.id,
                          contentActivityKey,
                          String(q.id || qIdx),
                          isCorrect,
                          5,
                          { subject: subjectName, chapter: noteTitle }
                        );
                      } catch {}
                    }}
                    onSubmit={(res) => {
                      try {
                        updateRoutinePageMcqScore(noteId, safePageIndex, res.score, res.total);
                        updateRoutineMcqScore(noteId, res.score, res.total);
                        recordMcqScore(
                          viewerUser.id,
                          contentActivityKey,
                          res.score,
                          res.total,
                          res.timeElapsedSeconds,
                          { subject: subjectName, chapter: noteTitle }
                        );
                      } catch {}
                      setMcqResultSummary({
                        score: res.score,
                        total: res.total,
                        attempted: res.attempted ?? Object.keys(res.answers || {}).length,
                        answers: res.answers || {},
                        timeElapsedSeconds: res.timeElapsedSeconds || 0,
                        questionsSnapshot: activePracticeQuestions,
                      });
                    }}
                    onPracticeMistakes={(wrongIdxs) => {
                      setMistakeOnlyIndices(wrongIdxs);
                      setMcqResultSummary(null);
                      setMcqSessionKey((k) => k + 1);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: ALL PAGES OVERVIEW (SyllabusPageCard A-to-Z Progress View) ── */}
        {activeTab === 'pages' && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 p-3 sm:p-6">
            <div className="max-w-3xl mx-auto space-y-3 pb-16">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleBackExit}
                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
                    title="Back to Lessons"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">{noteTitle}</h3>
                    <p className="text-xs text-slate-500">
                      {subjectName} • {displayClassLabel} • {normalizedPages.length}{' '}
                      {normalizedPages.length === 1 ? 'Page' : 'Pages'} • {allLessonMcqs.length} MCQs
                    </p>
                  </div>
                </div>
                {allLessonMcqs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMcqScope('all');
                      setMistakeOnlyIndices(null);
                      setMcqResultSummary(null);
                      handleTabSwitch('mcq');
                    }}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shrink-0 cursor-pointer"
                  >
                    All MCQs ({allLessonMcqs.length})
                  </button>
                )}
              </div>

              {normalizedPages.map((pg, idx) => (
                <SyllabusPageCard
                  key={pg.id}
                  page={pg}
                  pageIndex={idx}
                  lessonId={noteId}
                  lessonTitle={noteTitle}
                  user={viewerUser}
                  tierTheme={TIER_THEME.ultra}
                  isOpen={expandedPageIdx === idx}
                  onToggle={() => {
                    setActivePageIndex(idx);
                    setExpandedPageIdx((prev) => (prev === idx ? null : idx));
                  }}
                  onQuickOpenNotes={() => {
                    setActivePageIndex(idx);
                    setMcqScope('page');
                    handleTabSwitch('reading');
                  }}
                  onOpenReading={() => {
                    setActivePageIndex(idx);
                    setMcqScope('page');
                    handleTabSwitch('reading');
                  }}
                  onOpenWriting={
                    pg.htmlNotes || pg.chunkNotes
                      ? () => {
                          setActivePageIndex(idx);
                          setMcqScope('page');
                          handleTabSwitch('premium');
                        }
                      : undefined
                  }
                  onOpenMcq={() => {
                    setActivePageIndex(idx);
                    setMcqScope('page');
                    setMistakeOnlyIndices(null);
                    setMcqResultSummary(null);
                    handleTabSwitch('mcq');
                  }}
                  onOpenFlashcard={
                    pg.mcqs.length > 0
                      ? () => {
                          setActivePageIndex(idx);
                          setMcqScope('page');
                          handleTabSwitch('flashcard');
                        }
                      : undefined
                  }
                  onOpenProjector={
                    pg.mcqs.length > 0
                      ? () => {
                          setActivePageIndex(idx);
                          setMcqScope('page');
                          handleTabSwitch('projector');
                        }
                      : undefined
                  }
                  onOpenPdf={
                    pg.pdfUrl
                      ? () => {
                          setActivePageIndex(idx);
                          setMcqScope('page');
                          handleTabSwitch('pdf');
                        }
                      : undefined
                  }
                  onOpenVideo={
                    pg.videoUrl
                      ? () => {
                          setActivePageIndex(idx);
                          setMcqScope('page');
                          handleTabSwitch('video');
                        }
                      : undefined
                  }
                  onOpenAudio={
                    pg.audioUrl
                      ? () => {
                          setActivePageIndex(idx);
                          setMcqScope('page');
                          handleTabSwitch('audio');
                        }
                      : undefined
                  }
                  showAlert={showMcqAlert}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
};
