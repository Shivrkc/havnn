import React, { forwardRef } from "react";

export interface AmoledLiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "card" | "navbar" | "sidebar" | "toolbar" | "panel";
  interactive?: boolean;
  selected?: boolean;
}

/**
 * AmoledLiquidGlass
 *
 * Apple-inspired Smoked Liquid Glass material component for HAVN.
 * Implements deep AMOLED black foundation compatibility with smoked translucent obsidian glass,
 * controlled backdrop-blur and saturation, multi-layer inner specular edge highlights,
 * and high-contrast content presentation.
 *
 * Light mode appearance is 100% preserved (white/80 with slate borders).
 */
export const AmoledLiquidGlass = forwardRef<HTMLDivElement, AmoledLiquidGlassProps>(
  (
    {
      children,
      className = "",
      variant = "card",
      interactive = false,
      selected = false,
      style,
      ...props
    },
    ref
  ) => {
    // Base surface tokens: Refined Apple-inspired Liquid Glass with high-optical clarity
    const baseGlass =
      "backdrop-blur-2xl backdrop-saturate-125 transition-all duration-200 relative overflow-hidden";

    const variantStyles = {
      card: "bg-white/60 dark:bg-[#07080B]/60 border border-white/60 dark:border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),inset_0_0_0_1px_rgba(255,255,255,0.30),0_8px_24px_-4px_rgba(15,23,42,0.06),0_2px_6px_-2px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(255,255,255,0.02),0_8px_32px_0_rgba(0,0,0,0.55)] rounded-2xl",
      navbar:
        "bg-white/70 dark:bg-[#07080B]/70 border border-white/70 dark:border-white/[0.09] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),inset_0_0_0_1px_rgba(255,255,255,0.35),0_12px_32px_-4px_rgba(15,23,42,0.08),0_2px_8px_-2px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),inset_0_0_0_1px_rgba(255,255,255,0.03),0_12px_36px_0_rgba(0,0,0,0.6)] rounded-2xl",
      sidebar:
        "bg-white/70 dark:bg-[#07080B]/75 border border-white/70 dark:border-white/[0.09] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),inset_0_0_0_1px_rgba(255,255,255,0.35),0_16px_40px_-6px_rgba(15,23,42,0.08),0_4px_12px_-2px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),inset_0_0_0_1px_rgba(255,255,255,0.03),0_16px_48px_0_rgba(0,0,0,0.7)] rounded-3xl sm:rounded-[28px]",
      toolbar:
        "bg-white/50 dark:bg-[#07080B]/60 border border-white/50 dark:border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85),inset_0_1px_2px_0_rgba(15,23,42,0.03),0_4px_16px_-2px_rgba(15,23,42,0.05)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.10),0_4px_20px_0_rgba(0,0,0,0.45)] rounded-xl",
      panel:
        "bg-white/60 dark:bg-[#07080B]/65 border border-white/60 dark:border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),inset_0_0_0_1px_rgba(255,255,255,0.30),0_8px_24px_-4px_rgba(15,23,42,0.06),0_2px_6px_-2px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_8px_32px_0_rgba(0,0,0,0.55)] rounded-2xl",
    };

    const interactiveStyles = interactive
      ? "hover:border-white/90 hover:bg-white/75 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,1),inset_0_0_0_1px_rgba(255,255,255,0.50),0_12px_32px_-4px_rgba(15,23,42,0.10),0_4px_12px_-2px_rgba(15,23,42,0.06)] dark:hover:border-white/[0.16] dark:hover:bg-[#090B0F]/75 dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),inset_0_0_0_1px_rgba(255,255,255,0.05),0_12px_40px_0_rgba(0,0,0,0.75)] cursor-pointer"
      : "";

    const selectedStyles = selected
      ? "border-sky-500/60 dark:border-sky-400/60 ring-2 ring-sky-500/25 dark:ring-sky-400/20"
      : "";

    return (
      <div
        ref={ref}
        className={`${baseGlass} ${variantStyles[variant]} ${interactiveStyles} ${selectedStyles} ${className}`}
        style={style}
        {...props}
      >
        {/* Subtle Liquid Top Edge Specular Highlight (Liquid Glass Bevel) */}
        <span
          className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent pointer-events-none opacity-90 dark:opacity-100 transition-opacity"
          aria-hidden="true"
        />
        {children}
      </div>
    );
  }
);

AmoledLiquidGlass.displayName = "AmoledLiquidGlass";
