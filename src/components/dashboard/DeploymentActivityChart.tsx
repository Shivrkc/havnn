import React, { useState, useMemo } from "react";
import { ChevronRight, ArrowUpRight, BarChart2 } from "lucide-react";
import { Deployment } from "../../types";

interface DeploymentActivityChartProps {
  deployments: Deployment[];
  onViewAll?: () => void;
  onViewAnalytics?: () => void;
  onSelectDateBucket?: (label: string, count: number) => void;
  variant?: "overview" | "detailed";
}

type DateRange = "7d" | "14d" | "30d" | "90d";

export const DeploymentActivityChart: React.FC<
  DeploymentActivityChartProps
> = ({
  deployments,
  onViewAll,
  onViewAnalytics,
  onSelectDateBucket,
  variant = "overview",
}) => {
  const [selectedRange, setSelectedRange] = useState<DateRange>(
    variant === "detailed" ? "30d" : "30d",
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Compute real data buckets based on selectedRange
  const { points, labels, peakCount, peakIndex, totalInPeriod, rangeDays } =
    useMemo(() => {
      const now = Date.now();
      let numBuckets = 5;
      let days = 28;

      if (selectedRange === "7d") {
        numBuckets = 7;
        days = 7;
      } else if (selectedRange === "14d") {
        numBuckets = 7;
        days = 14;
      } else if (selectedRange === "30d") {
        numBuckets = variant === "detailed" ? 10 : 5;
        days = 30;
      } else if (selectedRange === "90d") {
        numBuckets = variant === "detailed" ? 12 : 6;
        days = 90;
      }

      const totalWindowMs = days * 24 * 60 * 60 * 1000;
      const intervalMs = totalWindowMs / numBuckets;
      const bucketCounts = new Array(numBuckets).fill(0);
      const bucketLabels: string[] = [];

      for (let i = numBuckets - 1; i >= 0; i--) {
        const bucketDate = new Date(now - i * intervalMs);
        bucketLabels.push(
          bucketDate.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
        );
      }

      let total = 0;
      deployments.forEach((dep) => {
        const dateVal = dep.createdAt
          ? new Date(dep.createdAt).getTime()
          : dep.deployedAt
            ? new Date(dep.deployedAt).getTime()
            : 0;

        if (dateVal > 0) {
          const ageMs = now - dateVal;
          if (ageMs >= 0 && ageMs <= totalWindowMs) {
            const rawIdx = Math.floor((totalWindowMs - ageMs) / intervalMs);
            const bucketIdx = Math.min(Math.max(rawIdx, 0), numBuckets - 1);
            bucketCounts[bucketIdx]++;
            total++;
          }
        }
      });

      let maxIdx = 0;
      bucketCounts.forEach((c, idx) => {
        if (c >= bucketCounts[maxIdx]) maxIdx = idx;
      });

      return {
        points: bucketCounts,
        labels: bucketLabels,
        peakCount: Math.max(...bucketCounts),
        peakIndex: maxIdx,
        totalInPeriod: total,
        rangeDays: days,
      };
    }, [deployments, selectedRange, variant]);

  // Dimensions for SVG plotting
  const isDetailed = variant === "detailed";
  const width = isDetailed ? 640 : 280;
  const height = isDetailed ? 180 : 110;

  // Y-axis max scale: optimized to use available vertical plot area effectively
  // Avoids empty vertical space while preventing line from hitting extreme top edge
  const maxScale = Math.max(peakCount, 2);

  // Compute SVG coordinates
  const paddingX = isDetailed ? 20 : 12;
  const paddingTop = isDetailed ? 24 : 16;
  const paddingBottom = isDetailed ? 20 : 15;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingTop - paddingBottom;

  const coords = points.map((count, i) => {
    const x = paddingX + (i / (points.length - 1)) * plotWidth;
    const y = paddingTop + plotHeight - (count / maxScale) * plotHeight;
    return { x, y, count };
  });

  // Construct SVG path commands
  const linePath = coords.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - paddingBottom} L ${coords[0].x} ${height - paddingBottom} Z`;

  // Active tooltip coordinate: prioritize hovered point; fallback to peak in overview if hovered is null
  const activeTooltipIndex =
    hoveredIndex !== null ? hoveredIndex : peakCount > 0 ? peakIndex : null;
  const activeCoord =
    activeTooltipIndex !== null ? coords[activeTooltipIndex] : null;

  return (
    <div
      className={`backdrop-blur-2xl bg-white/75 dark:bg-[#16191f]/85 border border-white/90 dark:border-[#282d37] rounded-3xl p-5 shadow-lg shadow-sky-950/5 dark:shadow-black/30 space-y-3.5 ${isDetailed ? "p-6 sm:p-7" : ""}`}
    >
      {/* Header with Title, Range Selector & View Analytics link */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isDetailed && (
            <div className="w-8 h-8 rounded-xl bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center shrink-0">
              <BarChart2 className="w-4 h-4" />
            </div>
          )}
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-[#f1f3f5] tracking-tight flex items-center gap-1.5">
              <span>
                {isDetailed
                  ? "Deployment Cadence & Frequency"
                  : "Deployment Activity"}
              </span>
            </h3>
            {isDetailed && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Temporal pipeline throughput and execution volume over time
              </p>
            )}
          </div>
        </div>

        {/* Interactive Controls */}
        <div className="flex items-center gap-2">
          {/* Compact Date Range Tabs */}
          <div className="flex items-center p-0.5 bg-slate-100/80 dark:bg-[#12151a]/80 border border-slate-200/60 dark:border-[#282d37] rounded-xl text-[10px] font-bold font-mono">
            {(["7d", "14d", "30d", "90d"] as DateRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setSelectedRange(r);
                  setHoveredIndex(null);
                }}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedRange === r
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Quick link to Analytics (in Overview) or Deployments */}
          {!isDetailed && onViewAnalytics ? (
            <button
              type="button"
              onClick={onViewAnalytics}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-0.5 cursor-pointer ml-1"
              title="Open detailed analytics"
            >
              <span>View Analytics</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            onViewAll && (
              <button
                type="button"
                onClick={onViewAll}
                className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                title="View full deployment history"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </div>

      {/* SVG Interactive Chart Area */}
      <div
        className="relative pt-1 select-none"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={`w-full overflow-visible ${isDetailed ? "h-56 sm:h-64" : "h-24"}`}
        >
          <defs>
            <linearGradient
              id={`actGrad-${variant}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background horizontal guideline ticks in detailed mode */}
          {isDetailed && (
            <g className="opacity-40 dark:opacity-20 stroke-slate-300 dark:stroke-slate-700 stroke-dasharray-2">
              <line
                x1={paddingX}
                y1={paddingTop}
                x2={width - paddingX}
                y2={paddingTop}
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1={paddingX}
                y1={paddingTop + plotHeight * 0.5}
                x2={width - paddingX}
                y2={paddingTop + plotHeight * 0.5}
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1={paddingX}
                y1={height - paddingBottom}
                x2={width - paddingX}
                y2={height - paddingBottom}
                strokeWidth="1"
              />
            </g>
          )}

          {/* Shaded Area fill */}
          <path d={areaPath} fill={`url(#actGrad-${variant})`} />

          {/* Continuous Line stroke */}
          <path
            d={linePath}
            fill="none"
            stroke="#2563eb"
            strokeWidth={isDetailed ? "3" : "2.5"}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive vertical hover indicator line */}
          {activeCoord && (
            <line
              x1={activeCoord.x}
              y1={paddingTop}
              x2={activeCoord.x}
              y2={height - paddingBottom}
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              className="opacity-60 pointer-events-none"
            />
          )}

          {/* Data point markers */}
          {coords.map((pt, i) => {
            const isHovered = hoveredIndex === i;
            const isPeak = i === peakIndex && pt.count > 0;
            return (
              <g key={i}>
                {/* Large invisible circle for comfortable touch & hover targeting */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="14"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onTouchStart={() => setHoveredIndex(i)}
                  onClick={() => {
                    if (onSelectDateBucket)
                      onSelectDateBucket(labels[i], pt.count);
                    else if (onViewAll) onViewAll();
                  }}
                />

                {/* Visual marker circle */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={
                    isHovered
                      ? isDetailed
                        ? "6"
                        : "5"
                      : isPeak
                        ? isDetailed
                          ? "5"
                          : "4"
                        : isDetailed
                          ? "3.5"
                          : "2.5"
                  }
                  className={`pointer-events-none transition-all duration-150 ${
                    isHovered
                      ? "fill-sky-400 stroke-blue-700 stroke-2 ring-4 ring-sky-400/30"
                      : isPeak
                        ? "fill-blue-600 stroke-white dark:stroke-[#16191f] stroke-2"
                        : "fill-blue-500 dark:fill-blue-400"
                  }`}
                />
              </g>
            );
          })}

          {/* Interactive Tooltip Callout */}
          {activeCoord && activeTooltipIndex !== null && (
            <g
              transform={`translate(${
                // Clamp X position so tooltip never clips left or right edge
                Math.max(38, Math.min(width - 38, activeCoord.x))
              }, ${Math.max(16, activeCoord.y - 18)})`}
              className="pointer-events-none transition-transform duration-100 ease-out"
            >
              <rect
                x="-36"
                y="-15"
                width="72"
                height="20"
                rx="10"
                className="fill-slate-900/95 dark:fill-[#1e222b]/95 stroke border stroke-slate-700/60 shadow-lg"
              />
              <text
                x="0"
                y="-1"
                textAnchor="middle"
                className="fill-white font-mono text-[9px] font-bold tracking-tight"
              >
                {activeCoord.count}{" "}
                {activeCoord.count === 1 ? "Deploy" : "Deploys"}
              </text>
            </g>
          )}
        </svg>

        {/* X-Axis Dates */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500 pt-1.5 px-1">
          {labels.map((lbl, idx) => (
            <span
              key={idx}
              className={`transition-colors cursor-pointer ${
                hoveredIndex === idx
                  ? "text-blue-600 dark:text-blue-400 font-bold"
                  : ""
              }`}
              onClick={() => setHoveredIndex(idx)}
            >
              {lbl}
            </span>
          ))}
        </div>
      </div>

      {/* Footer Metrics Summary */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-[#282d37]">
        <span className="flex items-center gap-1.5">
          <span>Deployments ({rangeDays}d)</span>
          {hoveredIndex !== null && (
            <span className="text-blue-600 dark:text-blue-400 font-bold font-mono">
              &bull; {labels[hoveredIndex]}: {points[hoveredIndex]}{" "}
              {points[hoveredIndex] === 1 ? "run" : "runs"}
            </span>
          )}
        </span>
        <span className="font-bold text-slate-700 dark:text-slate-200">
          {totalInPeriod} {totalInPeriod === 1 ? "total run" : "total runs"}
        </span>
      </div>
    </div>
  );
};
