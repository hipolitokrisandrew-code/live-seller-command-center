import { useEffect, useMemo, useState } from "react";
import type { FinanceTutorialStep } from "../../hooks/useFinanceTutorial";

type FinanceTutorialOverlayProps = {
  isOpen: boolean;
  steps: FinanceTutorialStep[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onSkip: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function FinanceTutorialOverlay({
  isOpen,
  steps,
  currentIndex,
  onNext,
  onPrev,
  onClose,
  onSkip,
}: FinanceTutorialOverlayProps) {
  const step = steps[currentIndex];
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isOpen || !step) return;

    const updateRect = () => {
      const element = document.querySelector(step.targetSelector) as HTMLElement | null;
      if (!element) {
        setTargetRect(null);
        return;
      }
      setTargetRect(element.getBoundingClientRect());
    };

    const target = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    const frame = requestAnimationFrame(updateRect);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onNext]);

  const spotlight = useMemo(() => {
    if (!targetRect || !step) return null;
    const padding = step.spotlightPadding ?? 8;
    const top = clamp(targetRect.top - padding, 8, window.innerHeight - 16);
    const left = clamp(targetRect.left - padding, 8, window.innerWidth - 16);
    const width = clamp(
      targetRect.width + padding * 2,
      40,
      window.innerWidth - left - 8
    );
    const height = clamp(
      targetRect.height + padding * 2,
      40,
      window.innerHeight - top - 8
    );
    const rightGap = Math.max(0, window.innerWidth - (left + width));
    const bottomGap = Math.max(0, window.innerHeight - (top + height));

    return { top, left, width, height, rightGap, bottomGap };
  }, [step, targetRect]);

  if (!isOpen || !step) return null;

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50">
      {spotlight ? (
        <div className="absolute inset-0 z-10">
          <div
            className="absolute left-0 top-0 w-full bg-slate-900/50 backdrop-blur-[1px]"
            style={{ height: spotlight.top }}
          />
          <div
            className="absolute left-0 bg-slate-900/50 backdrop-blur-[1px]"
            style={{
              top: spotlight.top,
              width: spotlight.left,
              height: spotlight.height,
            }}
          />
          <div
            className="absolute bg-slate-900/50 backdrop-blur-[1px]"
            style={{
              top: spotlight.top,
              left: spotlight.left + spotlight.width,
              width: spotlight.rightGap,
              height: spotlight.height,
            }}
          />
          <div
            className="absolute left-0 w-full bg-slate-900/50 backdrop-blur-[1px]"
            style={{
              top: spotlight.top + spotlight.height,
              height: spotlight.bottomGap,
            }}
          />
        </div>
      ) : (
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]" />
      )}
      {spotlight ? (
        <div
          className="absolute z-20 rounded-xl border border-emerald-400/80 transition-all pointer-events-none"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      ) : null}

      <div
        className="absolute bottom-4 left-4 right-4 z-30 rounded-xl border border-slate-200 bg-white p-4 shadow-xl md:bottom-6 md:left-1/2 md:right-auto md:w-[420px] md:-translate-x-1/2"
        role="dialog"
        aria-modal="true"
        aria-label="Finance tutorial"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
              Step {currentIndex + 1} of {steps.length}
            </p>
            <h2 className="text-base font-semibold text-slate-900">{step.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-600">{step.description}</p>

        {step.mediaLabel ? (
          <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">
            {step.mediaLabel}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Skip tutorial
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={isFirst}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-600"
              autoFocus
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
