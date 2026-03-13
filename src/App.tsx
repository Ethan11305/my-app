import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, SunDim, Moon, CheckCircle2, BarChart3, Clock, Sparkles, PartyPopper, Calendar, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
type Slot = 'Morning' | 'Afternoon' | 'Evening';

interface Selection {
  day: Day;
  slot: Slot;
}

interface VoteCount {
  day: Day;
  slot: Slot;
  count: number;
}

const DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS: Record<Day, string> = {
  Mon: '星期一',
  Tue: '星期二',
  Wed: '星期三',
  Thu: '星期四',
  Fri: '星期五',
  Sat: '星期六',
  Sun: '星期日'
};

const SLOTS: Slot[] = ['Morning', 'Afternoon', 'Evening'];
const SLOT_CONFIG = {
  Morning: { label: '早上', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50' },
  Afternoon: { label: '中午', icon: SunDim, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  Evening: { label: '晚上', icon: Moon, color: 'text-indigo-500', bg: 'bg-indigo-50' }
};

export default function App() {
  const [selections, setSelections] = useState<Selection[]>([]);
  const [voted, setVoted] = useState(false);
  const [results, setResults] = useState<VoteCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showResultsOnly, setShowResultsOnly] = useState(false);

  useEffect(() => {
    fetchResults();
    if (localStorage.getItem('hasVotedWeekly')) {
      setVoted(true);
    }
  }, []);

  const fetchResults = async () => {
    try {
      const res = await fetch('/api/votes');
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error('Failed to fetch results:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerCelebration = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#6366F1', '#10B981', '#F59E0B']
    });
  };

  const toggleSelection = (day: Day, slot: Slot) => {
    setSelections(prev => {
      const exists = prev.find(s => s.day === day && s.slot === slot);
      if (exists) {
        return prev.filter(s => !(s.day === day && s.slot === slot));
      }
      return [...prev, { day, slot }];
    });
  };

  const handleVote = async () => {
    if (selections.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      });

      if (res.ok) {
        triggerCelebration();
        setVoted(true);
        localStorage.setItem('hasVotedWeekly', 'true');
        fetchResults();
      }
    } catch (err) {
      console.error('Vote failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const maxCount = Math.max(...results.map(r => r.count), 1);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans selection:bg-indigo-100 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Calendar className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">週時段偏好調查</h1>
          </div>
          {voted && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full text-sm font-bold">
              <CheckCircle2 className="w-4 h-4" />
              已完成投票
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <AnimatePresence mode="wait">
          {(!voted && !showResultsOnly) ? (
            <motion.div
              key="voting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-10"
            >
              <div className="text-center space-y-6">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">
                    3～5人自主學習讀書會
                  </h2>
                  <div className="max-w-2xl mx-auto p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100/50">
                    <p className="text-indigo-900 font-bold mb-2 flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-500" />
                      讀書會目標
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      上半場分享 AWS、Linux、C++、專案或資料分析等學習內容；<br />
                      下半場進行模擬面試，透過表達、交流與實戰練習，持續提升能力與成長。
                    </p>
                  </div>
                </div>
                
                <div className="pt-4">
                  <h3 className="text-2xl font-bold text-slate-800">請選擇您方便的時段</h3>
                  <p className="text-slate-500 mt-2">
                    您可以自由勾選多個時段（複選）。我們將根據大家的選擇來安排最合適的時間。
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="p-6 text-left text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">時間 / 星期</th>
                        {DAYS.map(day => (
                          <th key={day} className="p-6 text-center border-b border-slate-100">
                            <span className="text-sm font-bold text-slate-900">{DAY_LABELS[day]}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SLOTS.map(slot => {
                        const config = SLOT_CONFIG[slot];
                        const Icon = config.icon;
                        return (
                          <tr key={slot} className="group">
                            <td className="p-6 border-b border-slate-100 bg-slate-50/30">
                              <div className="flex items-center gap-3">
                                <Icon className={cn("w-5 h-5", config.color)} />
                                <span className="font-bold text-slate-700">{config.label}</span>
                              </div>
                            </td>
                            {DAYS.map(day => {
                              const isSelected = selections.some(s => s.day === day && s.slot === slot);
                              return (
                                <td key={day} className="p-2 border-b border-slate-100">
                                  <button
                                    onClick={() => toggleSelection(day, slot)}
                                    className={cn(
                                      "w-full aspect-square rounded-2xl flex items-center justify-center transition-all duration-200 relative group/btn",
                                      isSelected 
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-95" 
                                        : "bg-white hover:bg-slate-50 border-2 border-slate-100 hover:border-indigo-200"
                                    )}
                                  >
                                    {isSelected ? (
                                      <Check className="w-6 h-6 stroke-[3px]" />
                                    ) : (
                                      <div className="w-2 h-2 rounded-full bg-slate-200 group-hover/btn:bg-indigo-200 transition-colors" />
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col items-center gap-6">
                <div className="text-slate-500 font-medium">
                  已選擇 <span className="text-indigo-600 font-black text-xl">{selections.length}</span> 個時段
                </div>
                <div className="flex flex-col w-full max-w-sm gap-4">
                  <button
                    disabled={selections.length === 0 || isSubmitting}
                    onClick={handleVote}
                    className={cn(
                      "w-full py-5 rounded-full font-black text-xl transition-all duration-300 shadow-2xl relative overflow-hidden group",
                      selections.length > 0
                        ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    )}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      {isSubmitting ? "提交中..." : "確認提交投票"}
                      <Sparkles className="w-6 h-6" />
                    </span>
                    {selections.length > 0 && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    )}
                  </button>

                  <button
                    onClick={() => setShowResultsOnly(true)}
                    className="w-full py-4 rounded-full font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                  >
                    <BarChart3 className="w-5 h-5" />
                    直接查看目前統計結果
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-12"
            >
              <div className="text-center space-y-4">
                <div className={cn(
                  "inline-flex items-center justify-center w-24 h-24 rounded-full shadow-2xl mb-4",
                  voted ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-indigo-500 text-white shadow-indigo-200"
                )}>
                  {voted ? <PartyPopper className="w-12 h-12" /> : <BarChart3 className="w-12 h-12" />}
                </div>
                <h2 className="text-4xl font-black text-slate-900">
                  {voted ? "投票成功！" : "目前統計結果"}
                </h2>
                <p className="text-slate-500 text-lg">顏色越深代表該時段越多人選擇。</p>
              </div>

              <div className="bg-white p-8 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
                <div className="overflow-x-auto">
                  <div className="min-w-[800px] grid grid-cols-[120px_repeat(7,1fr)] gap-4">
                    <div />
                    {DAYS.map(day => (
                      <div key={day} className="text-center py-4 font-black text-slate-400 uppercase tracking-widest text-xs">
                        {DAY_LABELS[day]}
                      </div>
                    ))}
                    
                    {SLOTS.map(slot => (
                      <React.Fragment key={slot}>
                        <div className="flex items-center gap-2 font-bold text-slate-700">
                          {React.createElement(SLOT_CONFIG[slot].icon, { className: cn("w-4 h-4", SLOT_CONFIG[slot].color) })}
                          {SLOT_CONFIG[slot].label}
                        </div>
                        {DAYS.map(day => {
                          const vote = results.find(r => r.day === day && r.slot === slot);
                          const count = vote ? vote.count : 0;
                          const intensity = count / maxCount;
                          return (
                            <div 
                              key={day}
                              className="aspect-square rounded-2xl flex flex-col items-center justify-center relative group transition-transform hover:scale-105"
                              style={{ 
                                backgroundColor: count > 0 ? `rgba(99, 102, 241, ${0.1 + intensity * 0.9})` : '#F8FAFC',
                                color: intensity > 0.5 ? 'white' : '#1E293B'
                              }}
                            >
                              <span className="text-xl font-black">{count}</span>
                              <span className="text-[10px] font-bold uppercase opacity-60">Votes</span>
                              
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                                {DAY_LABELS[day]} {SLOT_CONFIG[slot].label}: {count} 票
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                {!voted && (
                  <button
                    onClick={() => setShowResultsOnly(false)}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-lg hover:bg-indigo-700 transition-all"
                  >
                    返回投票頁面
                  </button>
                )}
                
                <button
                  onClick={() => {
                    localStorage.removeItem('hasVotedWeekly');
                    setVoted(false);
                    setShowResultsOnly(false);
                    setSelections([]);
                  }}
                  className="text-slate-400 hover:text-indigo-600 font-bold transition-colors flex items-center gap-2"
                >
                  <div className="w-8 h-px bg-slate-200" />
                  清除紀錄並重新投票
                  <div className="w-8 h-px bg-slate-200" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
