import React from 'react';

export function RupiahIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="9.5" />
      <text 
        x="12" 
        y="15.5" 
        textAnchor="middle" 
        fontSize="9" 
        fontWeight="900" 
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        fill="currentColor" 
        stroke="none"
      >
        Rp
      </text>
    </svg>
  );
}

export default RupiahIcon;
