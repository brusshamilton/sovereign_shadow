import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Shield, 
  Zap, 
  Radio, 
  TrendingUp, 
  AlertTriangle, 
  Globe, 
  Database, 
  DollarSign, 
  CheckCircle2, 
  XCircle,
  Play,
  Pause,
  RotateCcw,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GameState, 
  Project, 
  PROJECTS, 
  INITIAL_FUNDS, 
  INITIAL_RESOURCES, 
  INITIAL_FUNDS_GEN,
  INITIAL_RESOURCES_GEN,
  MAX_SUSPICION, 
  TICK_RATE,
  NewsItem
} from './types';

const STORAGE_KEY = 'sovereign_shadow_state';

export default function App() {
  const [state, setState] = useState<GameState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration: ensure new properties exist
        if (parsed.fundsGeneration === undefined) parsed.fundsGeneration = INITIAL_FUNDS_GEN;
        if (parsed.resourceGeneration === undefined) parsed.resourceGeneration = INITIAL_RESOURCES_GEN;
        if (parsed.prMultiplier === undefined) parsed.prMultiplier = 1.0;
        if (parsed.researchMultiplier === undefined) parsed.researchMultiplier = 1.0;
        if (parsed.passiveSuspicionRate === undefined) parsed.passiveSuspicionRate = 0.15;
        return parsed;
      } catch (e) {
        console.error("Failed to load state", e);
      }
    }
    return {
      funds: INITIAL_FUNDS,
      resources: INITIAL_RESOURCES,
      fundsGeneration: INITIAL_FUNDS_GEN,
      resourceGeneration: INITIAL_RESOURCES_GEN,
      prMultiplier: 1.0,
      researchMultiplier: 1.0,
      passiveSuspicionRate: 0.15,
      suspicion: 50, // Start under sanctions
      day: 1,
      projects: { ...PROJECTS },
      news: [
        { id: 'start', text: 'MODERATE sanctions in effect. National economy restricted by 50%.', type: 'WARNING', timestamp: Date.now(), day: 1 },
        { id: 'start-2', text: 'New administration takes office. National survival is the priority.', type: 'NEUTRAL', timestamp: Date.now(), day: 1 }
      ],
      isGameOver: false,
      winConditionMet: false,
      hasSeenIntro: false,
    };
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [speed, setSpeed] = useState(1);
  const lastTickRef = useRef<number>(Date.now());

  // Save game state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addNews = useCallback((text: string, type: NewsItem['type'] = 'NEUTRAL') => {
    setState(prev => ({
      ...prev,
      news: [{ id: Math.random().toString(36).substr(2, 9), text, type, timestamp: Date.now(), day: prev.day }, ...prev.news].slice(0, 50)
    }));
  }, []);

  const dismissIntro = () => {
    setState(prev => ({ ...prev, hasSeenIntro: true }));
    setIsPaused(true);
  };

  const checkProjectUnlocks = useCallback((projects: Record<string, Project>) => {
    const updated = { ...projects };
    let changed = false;

    Object.values(updated).forEach(p => {
      if (!p.isUnlocked && p.requirements) {
        const allMet = p.requirements.every(reqId => {
          const req = updated[reqId];
          return req.progress >= 100 || (req.isRepeatable && (req.repeatCount || 0) > 0);
        });
        if (allMet) {
          updated[p.id].isUnlocked = true;
          changed = true;
        }
      }
    });

    return changed ? updated : projects;
  }, []);

  const tick = useCallback(() => {
    if (state.isGameOver || isPaused) return;

    setState(prev => {
      // 0. Calculate Sanction Multiplier
      const getLevel = (susp: number) => {
        if (susp >= 80) return 'SEVERE';
        if (susp >= 50) return 'MODERATE';
        return 'NONE';
      };

      const prevLevel = getLevel(prev.suspicion);
      
      let sanctionMultiplier = 1.0;
      if (prev.suspicion >= 80) {
        sanctionMultiplier = 0.1; // 90% reduction
      } else if (prev.suspicion >= 50) {
        sanctionMultiplier = 0.5; // 50% reduction
      }

      // 1. Resource Generation
      let nextFunds = prev.funds + (prev.fundsGeneration * sanctionMultiplier);
      let nextResources = prev.resources + prev.resourceGeneration;
      let nextSuspicion = prev.suspicion;
      let nextProjects = { ...prev.projects };
      let nextDay = prev.day + 1;
      let nextFundsGen = prev.fundsGeneration;
      let nextResourceGen = prev.resourceGeneration;
      let nextPrMultiplier = prev.prMultiplier;
      let nextResearchMultiplier = prev.researchMultiplier;
      let nextPassiveSuspicionRate = prev.passiveSuspicionRate;
      let nextNews = [...prev.news];

      const addNewsToState = (text: string, type: NewsItem['type'] = 'NEUTRAL') => {
        nextNews = [{ id: Math.random().toString(36).substr(2, 9), text, type, timestamp: Date.now(), day: prev.day }, ...nextNews].slice(0, 50);
      };

      // 2. Project Progress
      if (activeProjectId && nextProjects[activeProjectId]) {
        const p = nextProjects[activeProjectId];
        const baseProgressGain = p.progressGain || 5;
        const progressGain = baseProgressGain * nextResearchMultiplier;
        const duration = 100.0/progressGain;

        // Check if we can afford the tick (cost per day)
        const dailyCost = p.cost / duration;
        const dailyResource = p.resourceCost / duration;

        // Check if it takes less than a day.
        const newProgress = Math.min(100, p.progress + progressGain);
        const actualProgress = newProgress-p.progress;

        const actualCost = dailyCost*actualProgress/progressGain;
        const actualResource = dailyResource*actualProgress/progressGain;

        if (nextFunds >= actualCost && nextResources >= actualResource) {
          nextFunds -= actualCost;
          nextResources -= actualResource;
          
          const newProgress = Math.min(100, p.progress + progressGain);
          nextProjects[activeProjectId].progress = newProgress;

          // Suspicion impact
          // Only apply suspicion when progressing
          let suspicionImpact = p.suspicionImpact;
          if (suspicionImpact < 0) {
            suspicionImpact *= nextPrMultiplier;
          }
          nextSuspicion = Math.max(0, Math.min(MAX_SUSPICION, nextSuspicion + (suspicionImpact / 20)));

          if (newProgress >= 100) {
            addNewsToState(`Project Complete: ${p.name}`, 'SUCCESS');
            
            // Apply Permanent Bonuses
            if (p.incomeBonus) {
              nextFundsGen += p.incomeBonus;
              addNewsToState(`Daily revenue increased by $${p.incomeBonus.toLocaleString()}`, 'SUCCESS');
            }
            if (p.resourceBonus) {
              nextResourceGen += p.resourceBonus;
              addNewsToState(`Daily resource production increased by ${p.resourceBonus} MT`, 'SUCCESS');
            }

            // New Project Bonuses
            if (p.id === 'global_lobbying') {
              nextPrMultiplier += 0.5;
              addNewsToState('PR effectiveness increased by 50%.', 'SUCCESS');
            }
            if (p.id === 'automated_research') {
              nextResearchMultiplier += 0.25;
              addNewsToState('Research speed increased by 25%.', 'SUCCESS');
            }
            if (p.id === 'diplomatic_backchannel') {
              nextPassiveSuspicionRate = Math.max(0.05, nextPassiveSuspicionRate - 0.05);
              addNewsToState('Passive suspicion growth reduced.', 'SUCCESS');
            }

            // Apply One-Time Rewards
            if (p.oneTimeFunds) {
              nextFunds += p.oneTimeFunds;
              addNewsToState(`Received $${p.oneTimeFunds.toLocaleString()} from ${p.name}`, 'SUCCESS');
            }
            if (p.oneTimeResources) {
              nextResources += p.oneTimeResources;
              addNewsToState(`Received ${p.oneTimeResources} MT from ${p.name}`, 'SUCCESS');
            }

            // Handle Repeatable
            if (p.isRepeatable) {
              const repeatCount = (p.repeatCount || 0) + 1;
              nextProjects[activeProjectId] = {
                ...p,
                progress: 0,
                repeatCount: repeatCount,
                cost: Math.floor(p.cost * 1.3), // 30% increase each time
                resourceCost: Math.floor(p.resourceCost * 1.3), // 30% increase each time
              };
            }

            setActiveProjectId(null);
            setIsPaused(true); // Pause on completion
          }
        } else {
          // Insufficient resources to continue project
          setActiveProjectId(null);
          addNewsToState(`Project Halted: ${p.name} (Insufficient resources)`, 'WARNING');
          setIsPaused(true); // Pause on halt
        }
      }

      // 3. Passive Suspicion Increase (Slowly increases even if idle)
      nextSuspicion = Math.max(0, Math.min(MAX_SUSPICION, nextSuspicion + nextPassiveSuspicionRate));

      // 3a. Random Events (2% chance per day)
      if (Math.random() < 0.02) {
        const eventRoll = Math.random();
        if (eventRoll < 0.5) {
          // Positive Event: Crisis elsewhere
          const reduction = 5 + Math.random() * 10;
          nextSuspicion = Math.max(0, nextSuspicion - reduction);
          addNewsToState('INTEL: Major regional conflict distracts world powers. Global suspicion has decreased.', 'SUCCESS');
        } else {
          // Negative Event: Popular movie
          const increase = 3 + Math.random() * 7;
          nextSuspicion = Math.min(MAX_SUSPICION, nextSuspicion + increase);
          addNewsToState('INTEL: Popular foreign film portrays our nation as a rogue state. Global suspicion has increased.', 'WARNING');
        }
      }

      // 3b. Detect Sanction Level Change
      const nextLevel = getLevel(nextSuspicion);
      if (nextLevel !== prevLevel) {
        if (nextLevel === 'SEVERE') {
          addNewsToState('CRITICAL: International community imposes SEVERE sanctions. Income reduced by 90%.', 'CRITICAL');
        } else if (nextLevel === 'MODERATE') {
          if (prevLevel === 'SEVERE') {
            addNewsToState('Sanctions downgraded to MODERATE. Economic pressure easing.', 'WARNING');
          } else {
            addNewsToState('WARNING: International community imposes MODERATE sanctions. Income reduced by 50%.', 'WARNING');
          }
        } else if (nextLevel === 'NONE') {
          addNewsToState('International sanctions lifted. Economy returning to normal.', 'SUCCESS');
        }
      }

      // 4. Check Game Over Conditions
      let isGameOver = false;
      let winConditionMet = false;
      let gameOverReason = '';

      if (nextSuspicion >= MAX_SUSPICION) {
        isGameOver = true;
        gameOverReason = 'International coalition has launched a preemptive strike. Your regime has fallen.';
      }

      // Win Condition: ICBM Assembly + Warhead Design complete
      if (nextProjects['icbm_assembly'].progress >= 100 && nextProjects['warhead_design'].progress >= 100) {
        isGameOver = true;
        winConditionMet = true;
        gameOverReason = 'You have successfully developed a nuclear deterrent. Your nation is now a global power.';
      }

      return {
        ...prev,
        funds: nextFunds,
        resources: nextResources,
        fundsGeneration: nextFundsGen,
        resourceGeneration: nextResourceGen,
        prMultiplier: nextPrMultiplier,
        researchMultiplier: nextResearchMultiplier,
        passiveSuspicionRate: nextPassiveSuspicionRate,
        suspicion: nextSuspicion,
        day: nextDay,
        projects: checkProjectUnlocks(nextProjects),
        news: nextNews,
        isGameOver,
        winConditionMet,
        gameOverReason
      };
    });
  }, [activeProjectId, state.isGameOver, isPaused, addNews, checkProjectUnlocks]);

  useEffect(() => {
    const interval = setInterval(tick, TICK_RATE / speed);
    return () => clearInterval(interval);
  }, [tick, speed]);

  const startProject = (id: string) => {
    if (state.isGameOver) return;
    setActiveProjectId(id);
    setIsPaused(false);
    addNews(`Initiating: ${state.projects[id].name}`, 'NEUTRAL');
  };

  const resetGame = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const getSuspicionColor = (val: number) => {
    if (val < 30) return 'text-emerald-500';
    if (val < 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getSuspicionLabel = (val: number) => {
    if (val < 20) return 'Negligible';
    if (val < 40) return 'Low';
    if (val < 60) return 'Moderate';
    if (val < 80) return 'High';
    return 'Critical';
  };

  if (state.isGameOver) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-black">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass-panel p-8 text-center space-y-6 border-2 border-zinc-800"
        >
          {state.winConditionMet ? (
            <CheckCircle2 className="w-20 h-20 mx-auto text-emerald-500" />
          ) : (
            <XCircle className="w-20 h-20 mx-auto text-rose-500 animate-pulse-danger" />
          )}
          
          <h1 className={`text-3xl font-bold uppercase tracking-tighter ${state.winConditionMet ? 'text-emerald-500' : 'text-rose-500'}`}>
            {state.winConditionMet ? 'Strategic Victory' : 'Regime Collapse'}
          </h1>
          
          <p className="text-zinc-400 leading-relaxed">
            {state.gameOverReason}
          </p>

          <div className="pt-4">
            <button 
              onClick={resetGame}
              className="w-full py-3 px-6 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              Restart Simulation
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!state.hasSeenIntro) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-black">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full glass-panel p-8 space-y-8 border-2 border-zinc-800"
        >
          <div className="text-center space-y-2">
            <Shield className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
            <h1 className="text-4xl font-bold tracking-tighter uppercase">Sovereign Shadow</h1>
            <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase">Strategic Defense Initiative Briefing</p>
          </div>

          <div className="space-y-6 text-zinc-300">
            <section className="space-y-2">
              <h2 className="text-emerald-500 font-bold uppercase text-sm flex items-center gap-2">
                <Globe size={16} /> The Situation
              </h2>
              <p className="text-sm leading-relaxed">
                Your nation is already under <span className="text-rose-400 font-bold">Moderate International Sanctions</span>. The world powers have cornered you, and your economy is bleeding. To survive, you must develop a nuclear deterrent to force them to the negotiating table.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-emerald-500 font-bold uppercase text-sm flex items-center gap-2">
                <AlertTriangle size={16} /> The Risk
              </h2>
              <p className="text-sm leading-relaxed">
                You start with <span className="text-rose-400 font-bold">50% Suspicion</span>. If it reaches 100%, an international coalition will launch a preemptive strike. You are living on borrowed time.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-emerald-500 font-bold uppercase text-sm flex items-center gap-2">
                <Zap size={16} /> Strategy
              </h2>
              <ul className="text-sm space-y-1 list-disc list-inside text-zinc-400">
                <li>Balance military research with <span className="text-blue-400">Civilian Fronts</span> to lower suspicion.</li>
                <li>Manage your <span className="text-emerald-400">Funds</span> and <span className="text-blue-400">Resources</span> carefully.</li>
                <li>Use <span className="text-zinc-200">Covert Operations</span> to hide your progress from foreign intelligence.</li>
              </ul>
            </section>
          </div>

          <div className="pt-4">
            <button 
              onClick={dismissIntro}
              className="w-full py-4 px-6 bg-emerald-500 text-black font-bold rounded-lg hover:bg-emerald-400 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              Begin Operation
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Global Stats */}
      <header className="sticky top-0 z-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-panel p-6 shadow-2xl">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tighter flex items-center gap-2">
            <Shield className="text-emerald-500" />
            SOVEREIGN SHADOW <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">v1.0.4</span>
          </h1>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">National Command & Intelligence Center</p>
        </div>

        <div className="flex flex-wrap gap-6 items-center">
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Simulation Day</p>
            <p className="text-xl font-mono font-bold">{state.day}</p>
          </div>
          
          <div className="h-10 w-px bg-zinc-800 hidden md:block" />

          <div className="space-y-1">
            <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Available Funds</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-mono font-bold text-emerald-400">
                ${state.funds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <span className={`text-[10px] font-mono ${state.suspicion >= 50 ? 'text-rose-500 font-bold' : 'text-zinc-500'}`}>
                +${(state.fundsGeneration * (state.suspicion >= 80 ? 0.1 : state.suspicion >= 50 ? 0.5 : 1.0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/d
              </span>
            </div>
          </div>

          <div className="h-10 w-px bg-zinc-800 hidden md:block" />

          <div className="space-y-1">
            <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Industrial Resources</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-mono font-bold text-blue-400">
                {state.resources.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-zinc-600">MT</span>
              </p>
              <span className="text-[10px] text-zinc-500 font-mono">
                +{state.resourceGeneration.toFixed(2)}/d
              </span>
            </div>
          </div>

          <div className="h-10 w-px bg-zinc-800 hidden md:block" />

          <div className="space-y-1">
            <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Global Suspicion</p>
            <div className="flex items-center gap-2">
              <p className={`text-xl font-mono font-bold ${getSuspicionColor(state.suspicion)}`}>
                {Math.round(state.suspicion)}%
              </p>
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 ${getSuspicionColor(state.suspicion)}`}>
                {getSuspicionLabel(state.suspicion)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                    speed === s ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-400"
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? <Play size={20} /> : <Pause size={20} />}
            </button>
            <button 
              onClick={resetGame}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-400"
              title="Reset"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Projects */}
        <div className="lg:col-span-8 space-y-6">
          <div className="glass-panel overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Database size={16} className="text-zinc-500" />
                Development Projects
              </h2>
              {activeProjectId && (
                <div className="flex items-center gap-2 text-xs text-emerald-500 font-mono animate-pulse">
                  <Zap size={12} />
                  ACTIVE: {state.projects[activeProjectId].name}
                </div>
              )}
            </div>
            
            <div className="p-4 space-y-8">
              {(['NUCLEAR', 'DELIVERY', 'COVERT', 'CIVILIAN'] as const).map((category) => {
                const categoryProjects = (Object.values(state.projects) as Project[]).filter(p => p.type === category);
                if (categoryProjects.length === 0) return null;

                return (
                  <div key={category} className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-800/50 pb-2 flex items-center gap-2">
                      {category === 'NUCLEAR' && <Zap size={12} className="text-rose-500" />}
                      {category === 'DELIVERY' && <TrendingUp size={12} className="text-blue-500" />}
                      {category === 'COVERT' && <Shield size={12} className="text-emerald-500" />}
                      {category === 'CIVILIAN' && <Globe size={12} className="text-amber-500" />}
                      {category} OPERATIONS
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {categoryProjects.map((project) => {
                        const isLocked = !project.isUnlocked;
                        const isComplete = project.progress >= 100;
                        const isActive = activeProjectId === project.id;

                        return (
                          <div 
                            key={project.id}
                            className={`relative p-4 rounded-xl border transition-all duration-300 ${
                              isLocked 
                                ? 'bg-zinc-900/20 border-zinc-900 opacity-50 grayscale' 
                                : isComplete
                                  ? 'bg-emerald-950/10 border-emerald-900/30'
                                  : isActive
                                    ? 'bg-zinc-800/50 border-emerald-500/50 ring-1 ring-emerald-500/20'
                                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-sm">{project.name}</h3>
                                  {isComplete && !project.isRepeatable && <CheckCircle2 size={14} className="text-emerald-500" />}
                                  {project.isRepeatable && project.repeatCount! > 0 && (
                                    <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                                      x{project.repeatCount}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-tight">
                                  {project.type}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-mono text-zinc-400">${(project.cost/1000).toFixed(0)}k</p>
                                <p className="text-[10px] font-mono text-zinc-400">{project.resourceCost} MT</p>
                              </div>
                            </div>

                            <p className="text-xs text-zinc-400 mb-4 line-clamp-2 min-h-[2rem]">
                              {project.description}
                            </p>

                            {/* Bonuses Display */}
                            {(project.incomeBonus || project.resourceBonus || project.oneTimeFunds || project.oneTimeResources) && (
                              <div className="mb-4 flex flex-wrap gap-2">
                                {project.incomeBonus && (
                                  <span className="text-[9px] font-bold text-emerald-500 uppercase">
                                    +${project.incomeBonus/1000}k/d
                                  </span>
                                )}
                                {project.resourceBonus && (
                                  <span className="text-[9px] font-bold text-blue-500 uppercase">
                                    +{project.resourceBonus} MT/d
                                  </span>
                                )}
                                {project.oneTimeFunds && (
                                  <span className="text-[9px] font-bold text-emerald-400 uppercase">
                                    +${project.oneTimeFunds/1000}k
                                  </span>
                                )}
                                {project.oneTimeResources && (
                                  <span className="text-[9px] font-bold text-blue-400 uppercase">
                                    +{project.oneTimeResources} MT
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="space-y-3">
                              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${project.progress}%` }}
                                  className={`h-full ${isComplete ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                                />
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-mono text-zinc-500">{Math.round(project.progress)}%</span>
                                
                                {(!isComplete || project.isRepeatable) && !isLocked && (
                                  <button
                                    onClick={() => {
                                      if (isActive) {
                                        if (isPaused) {
                                          setIsPaused(false);
                                        } else {
                                          setActiveProjectId(null);
                                        }
                                      } else {
                                        startProject(project.id);
                                      }
                                    }}
                                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                      isActive 
                                        ? (isPaused ? 'bg-emerald-500 text-black hover:bg-emerald-400' : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30')
                                        : 'bg-emerald-500 text-black hover:bg-emerald-400'
                                    }`}
                                  >
                                    {isActive ? (isPaused ? 'Resume' : 'Halt') : 'Initiate'}
                                  </button>
                                )}

                                {isLocked && (
                                  <div className="flex items-center gap-1 text-[9px] text-zinc-600 font-bold uppercase">
                                    <Info size={10} />
                                    Classified
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: News & Intel */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-32 lg:h-[calc(100vh-10rem)] flex flex-col">
          <div className="glass-panel p-6 space-y-4 shrink-0">
            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-500" />
              Strategic Status
            </h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-500">
                  <span>Nuclear Capability</span>
                  <span>{Math.round((state.projects['warhead_design'].progress + state.projects['centrifuge_research'].progress) / 2)}%</span>
                </div>
                <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-rose-500 transition-all duration-500" 
                    style={{ width: `${(state.projects['warhead_design'].progress + state.projects['centrifuge_research'].progress) / 2}%` }} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-500">
                  <span>Delivery Capability</span>
                  <span>{Math.round((state.projects['icbm_assembly'].progress + state.projects['guidance_systems'].progress) / 2)}%</span>
                </div>
                <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500" 
                    style={{ width: `${(state.projects['icbm_assembly'].progress + state.projects['guidance_systems'].progress) / 2}%` }} 
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Globe size={24} className={state.suspicion > 70 ? 'text-rose-500 animate-pulse' : 'text-zinc-600'} />
                  <div>
                    <p className="text-[10px] font-bold uppercase">Global Tension</p>
                    <p className="text-xs font-medium">
                      {state.suspicion > 80 ? 'International coalition considering military options.' :
                       state.suspicion > 50 ? 'Regional powers expressing deep concern.' :
                       'Global community largely indifferent.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel flex flex-col flex-1 min-h-0">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
              <Radio size={16} className="text-zinc-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Intelligence Feed</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              <AnimatePresence initial={false}>
                {state.news.map((item) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-lg border-l-2 text-xs leading-relaxed ${
                      item.type === 'CRITICAL' ? 'bg-rose-500/10 border-rose-500 text-rose-200' :
                      item.type === 'WARNING' ? 'bg-amber-500/10 border-amber-500 text-amber-200' :
                      item.type === 'SUCCESS' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-200' :
                      'bg-zinc-800/50 border-zinc-600 text-zinc-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[9px] font-mono font-bold text-zinc-500">
                        DAY {item.day}
                      </span>
                      {item.type !== 'NEUTRAL' && (
                        <AlertTriangle size={10} className="opacity-50" />
                      )}
                    </div>
                    {item.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
