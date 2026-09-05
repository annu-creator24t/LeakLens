"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  Volume2,
  VolumeX,
  Maximize
} from "lucide-react";

export default function IntroVideoPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);

  // Ensure all audio / video playback stops when component unmounts
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    };
  }, []);

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleRestart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsPlaying(true);
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    videoRef.current.currentTime = fraction * duration;
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const mins = Math.floor(currentTime / 60);
  const secs = Math.floor(currentTime % 60);
  const totalMins = Math.floor(duration / 60);
  const totalSecs = Math.floor(duration % 60);

  return (
    <div className="relative w-screen h-screen bg-[#080b11] text-white flex flex-col justify-between overflow-hidden select-none font-sans">
      
      {/* Top Bar Navigation */}
      <header className="relative z-40 p-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-mono font-bold text-sm shadow-[0_0_20px_rgba(37,99,235,0.5)]">
            LL
          </div>
          <div>
            <span className="font-bold text-base tracking-tight">LeakLens</span>
            <span className="text-[10px] font-mono text-slate-400 block -mt-0.5">Product Introduction Video</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href="/leaklens_intro.mp4"
            download="leaklens_intro.mp4"
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors"
          >
            Download MP4
          </a>

          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-md cursor-pointer"
          >
            <span>Skip to Live Demo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Cinematic Video Player */}
      <main className="relative z-20 flex-1 flex items-center justify-center p-4 sm:p-8 max-w-6xl w-full mx-auto">
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-2xl group">
          <video
            ref={videoRef}
            src="/leaklens_intro.mp4"
            playsInline
            autoPlay
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onClick={handleTogglePlay}
            className="w-full h-full object-contain cursor-pointer"
          />

          {/* Overlay Play button when paused */}
          {!isPlaying && (
            <div
              onClick={handleTogglePlay}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center cursor-pointer transition-opacity"
            >
              <div className="w-20 h-20 rounded-full bg-blue-600/90 border border-blue-400/50 flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.6)] transform hover:scale-105 transition-transform">
                <Play className="w-8 h-8 fill-white text-white ml-1" />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Video Controls Bar */}
      <footer className="relative z-40 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-850 bg-[#0c121e]/90 backdrop-blur-md">
        
        {/* Play / Restart Controls */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-md"
            title={isPlaying ? "Pause" : "Play"}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
            title="Restart"
            aria-label="Restart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
            title={isMuted ? "Unmute" : "Mute"}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-blue-400" />}
          </button>

          <span className="font-mono text-xs text-slate-400 min-w-[80px]">
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")} / {String(totalMins).padStart(2, "0")}:{String(totalSecs).padStart(2, "0")}
          </span>
        </div>

        {/* Progress Timeline Scrubber */}
        <div
          className="flex-1 max-w-xl w-full h-2.5 bg-slate-900 rounded-full border border-slate-800 overflow-hidden cursor-pointer relative"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Fullscreen & Dashboard Actions */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleFullscreen}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Fullscreen"
            aria-label="Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>

          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            Enter Dashboard
          </Link>
        </div>
      </footer>

    </div>
  );
}
