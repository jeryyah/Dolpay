import React from "react";

interface TGMonogramProps {
  size?: number;
  className?: string;
  rounded?: boolean;
  showShine?: boolean;
}

export function TGMonogram({
  size = 56,
  className = "",
  rounded = true,
  showShine = true,
}: TGMonogramProps) {
  const id = React.useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      aria-label="TECHGEMING logo"
    >
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a1208" />
          <stop offset="55%" stopColor="#0a0905" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
        <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFEFB6" />
          <stop offset="35%" stopColor="#F2C25C" />
          <stop offset="60%" stopColor="#C28F22" />
          <stop offset="85%" stopColor="#FFD874" />
          <stop offset="100%" stopColor="#7A4F0E" />
        </linearGradient>
        <linearGradient id={`shine-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity=".75" />
          <stop offset="50%" stopColor="#fff" stopOpacity=".05" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={`glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect
        x="2"
        y="2"
        width="116"
        height="116"
        rx={rounded ? 24 : 4}
        fill={`url(#bg-${id})`}
        stroke="rgba(212,151,42,.35)"
        strokeWidth="1.5"
      />
      {/* TG monogram */}
      <g
        filter={`url(#glow-${id})`}
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontWeight="900"
        textAnchor="middle"
      >
        <text
          x="60"
          y="78"
          fontSize="60"
          fill={`url(#gold-${id})`}
          letterSpacing="-2"
        >
          TG
        </text>
      </g>
      {showShine && (
        <rect
          x="2"
          y="2"
          width="116"
          height="58"
          rx={rounded ? 24 : 4}
          fill={`url(#shine-${id})`}
          opacity=".35"
        />
      )}
    </svg>
  );
}

export function TGMonogramHero({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* Glow halo */}
      <div className="absolute inset-0 rounded-[28%] blur-3xl bg-amber-500/20 scale-110" />
      <div className="absolute inset-0 rounded-[28%] blur-2xl bg-amber-300/15 scale-95" />
      {/* Floating monogram */}
      <div className="relative float-soft">
        <TGMonogram size={220} className="drop-shadow-[0_24px_50px_rgba(212,151,42,.45)]" />
      </div>
    </div>
  );
}
