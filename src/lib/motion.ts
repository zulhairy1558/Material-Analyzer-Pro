import type { Transition, Variants } from "framer-motion";

// ───────────────────────────────────────────────────────────────────────────
// Easing tokens (mirror globals.css)
// ───────────────────────────────────────────────────────────────────────────

export const easings = {
  out: [0.23, 1, 0.32, 1] as const,
  inOut: [0.77, 0, 0.175, 1] as const,
  drawer: [0.32, 0.72, 0, 1] as const,
  arrive: [0.16, 1, 0.3, 1] as const,
};

export const durations = {
  press: 0.12,
  tooltip: 0.15,
  dropdown: 0.2,
  popover: 0.2,
  modal: 0.28,
  drawer: 0.32,
  page: 0.22,
  stagger: 0.04,
  focal: 0.6,
};

// ───────────────────────────────────────────────────────────────────────────
// Spring presets (Framer Motion)
// ───────────────────────────────────────────────────────────────────────────

export const springs: Record<string, Transition> = {
  smooth: { type: "spring", bounce: 0, duration: 0.4 },
  snappy: { type: "spring", bounce: 0, duration: 0.3 },
  bounce: { type: "spring", bounce: 0.2, duration: 0.5 },
  drawer: { type: "spring", bounce: 0.18, duration: 0.5 },
  physics: { type: "spring", stiffness: 300, damping: 30, mass: 1 },
  gentle: { type: "spring", bounce: 0, duration: 0.6 },
};

// ───────────────────────────────────────────────────────────────────────────
// Reusable variants
// ───────────────────────────────────────────────────────────────────────────

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const pageTransitionTransition: Transition = {
  duration: durations.page,
  ease: easings.arrive,
};

export function listItemEntrance(index: number, cap = 8): Transition {
  return {
    duration: 0.3,
    ease: easings.arrive,
    delay: Math.min(index, cap) * durations.stagger,
  };
}

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 4 },
};

export const modalTransition: Transition = {
  duration: durations.modal,
  ease: easings.arrive,
};

export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const backdropTransition: Transition = {
  duration: 0.2,
};

export const popoverVariants: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

export const popoverTransition: Transition = {
  duration: durations.popover,
  ease: easings.out,
};

export function sheetVariants(direction: "right" | "bottom" = "right"): Variants {
  return direction === "right"
    ? {
        initial: { x: "100%" },
        animate: { x: 0 },
        exit: { x: "100%" },
      }
    : {
        initial: { y: "100%" },
        animate: { y: 0 },
        exit: { y: "100%" },
      };
}
