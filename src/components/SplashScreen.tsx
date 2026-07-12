import React, { useEffect, useState } from "react";

interface SplashScreenProps {
  isInitializing: boolean;
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ isInitializing, onFinish }) => {
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isInitializing) {
      // Simulate progress up to 90%
      interval = setInterval(() => {
        setProgress(p => {
          if (p >= 90) return 90;
          // Progress slows down as it gets closer to 90%
          const increment = p > 70 ? 0.5 : p > 40 ? 1.5 : 2;
          return Math.min(p + increment, 90);
        });
      }, 100);
    } else {
      // Once backend is ready, snap to 100%
      setProgress(100);
      
      // Give a short delay to let user see 100%, then start fading
      const timer = setTimeout(() => {
        setFading(true);
        setTimeout(() => {
          onFinish();
        }, 500); // 500ms fade-out duration
      }, 300);
      return () => clearTimeout(timer);
    }
    
    return () => {
        if (interval) clearInterval(interval);
    };
  }, [isInitializing, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F9FAFB] transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* The Minimalist Crop Logo */}
      <div className="relative mb-6 flex items-center justify-center h-20 w-20">
        {/* Play Button Triangle */}
        <div 
          className="w-0 h-0 border-t-[20px] border-t-transparent border-l-[30px] border-l-[#0F172A] border-b-[20px] border-b-transparent ml-2 z-10" 
        />
        {/* Crop Lines (Vertical/Horizontal accent) */}
        <div className="absolute top-0 left-2 w-1 h-24 bg-[#3B82F6] transform -translate-y-2 opacity-80" />
        <div className="absolute bottom-2 right-0 w-24 h-1 bg-[#3B82F6] transform translate-x-2 opacity-80" />
      </div>

      <h1 className="text-4xl font-bold text-[#0F172A] mb-2 tracking-tight font-sans">
        Auto Clipper
      </h1>
      
      <p className="text-[#6B7280] text-sm mb-12">
        Long-form to Shorts. Secara Otomatis.
      </p>

      {/* Dynamic Loading Indicator */}
      <div className="w-48 h-1.5 bg-gray-200 rounded overflow-hidden relative">
        <div 
          className="absolute left-0 top-0 h-full bg-[#3B82F6] transition-all duration-200 ease-out rounded" 
          style={{ width: `${progress}%` }} 
        />
      </div>
    </div>
  );
};
