import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => {
  // Style time inputs to match dashboard (dark bg, no browser white styling)
  const isTimeInput = type === 'time';
  
  return (
    <>
      <input
        type={type}
        className={cn(
          'flex h-9 w-full border-2 border-[#2d2d2d] bg-[#1a1a1a] px-3 py-1 text-sm font-mono text-[#f0f0f0] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#555] focus-visible:outline-none focus-visible:border-[#FF9900] focus-visible:shadow-[2px_2px_0_0_#FF9900] disabled:cursor-not-allowed disabled:opacity-40',
          isTimeInput && 'time-input-override',
          className
        )}
        ref={ref}
        {...props}
      />
      {isTimeInput && (
        <style>{`
          input[type="time"]::-webkit-calendar-picker-indicator {
            cursor: pointer;
            border-radius: 4px;
            margin-right: 2px;
            opacity: 0.6;
            filter: invert(1);
          }
          input[type="time"]::-webkit-calendar-picker-indicator:hover {
            opacity: 1;
          }
          input[type="time"]::-webkit-outer-spin-button,
          input[type="time"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type="time"] {
            color-scheme: dark;
          }
        `}</style>
      )}
    </>
  );
});
Input.displayName = 'Input';

export { Input };
