"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Check, X } from "lucide-react";
import type { Category, Goal } from "@/lib/types";

interface FocusTimerModalProps {
  open: boolean;
  goals: Goal[];
  onClose: () => void;
  onCompleteSession: (payload: {
    title: string;
    category: Category;
    duration_mins: number;
    goal_id: string | null;
  }) => void;
}

export function FocusTimerModal({
  open,
  goals,
  onClose,
  onCompleteSession,
}: FocusTimerModalProps) {
  const [presetMins, setPresetMins] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [title, setTitle] = useState("Deep Work Sprint");
  const [category, setCategory] = useState<Category>("Building");
  const [goalId, setGoalId] = useState("");
  const [ambientOn, setAmbientOn] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
      setElapsedSecs((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  function toggleAmbient() {
    if (!ambientOn) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = audioCtxRef.current || new AudioCtx();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") ctx.resume();

        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 2.2;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const gain = ctx.createGain();
        gain.gain.value = 0.08;
        gainRef.current = gain;

        noise.connect(gain);
        gain.connect(ctx.destination);
        noise.start(0);
        setAmbientOn(true);
      } catch {
        setAmbientOn(false);
      }
    } else {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setAmbientOn(false);
    }
  }

  function applyPreset(mins: number) {
    setRunning(false);
    setPresetMins(mins);
    setSecondsLeft(mins * 60);
    setElapsedSecs(0);
  }

  function finishAndLog() {
    const mins = Math.max(5, Math.round(elapsedSecs / 60) || presetMins);
    setRunning(false);
    if (ambientOn) toggleAmbient();
    onCompleteSession({
      title: title.trim() || "Deep Work Sprint",
      category,
      duration_mins: mins,
      goal_id: goalId || null,
    });
    applyPreset(presetMins);
    onClose();
  }

  if (!open) return null;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 bg-[#17211E]/95 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1F2C28] border border-white/10 rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#A9C2B9]">Deep Work Focus Mode</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleAmbient}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
              title="Toggle Brown Noise"
            >
              {ambientOn ? <Volume2 className="w-4 h-4 text-[#8CE0C3]" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setRunning(false);
                if (ambientOn) toggleAmbient();
                onClose();
              }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-2">
          {[25, 50, 90].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => applyPreset(m)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
                presetMins === m ? "bg-[#2B6B59] text-white" : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {m}m
            </button>
          ))}
        </div>

        <div className="text-center font-mono text-6xl font-bold tracking-tight py-2">
          {mm}:{ss}
        </div>

        <div className="space-y-2.5">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are you focusing on?"
            className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/40 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="px-3 py-2 text-xs rounded-xl bg-[#17211E] border border-white/15 text-white"
            >
              <option value="DSA">DSA</option>
              <option value="System Design">System Design</option>
              <option value="Building">Building</option>
              <option value="AI & ML">AI &amp; ML</option>
              <option value="Health">Health</option>
            </select>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-[#17211E] border border-white/15 text-white"
            >
              <option value="">Link goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="flex-1 py-3 rounded-xl bg-[#2B6B59] hover:bg-[#35826C] text-sm font-semibold flex items-center justify-center gap-2 transition"
          >
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {running ? "Pause" : "Start"}
          </button>
          <button
            type="button"
            onClick={() => applyPreset(presetMins)}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={finishAndLog}
            className="px-4 py-3 rounded-xl bg-white text-[#17211E] hover:bg-[#E9F3EF] text-sm font-semibold flex items-center gap-1.5 transition"
          >
            <Check className="w-4 h-4" /> Log
          </button>
        </div>
      </div>
    </div>
  );
}