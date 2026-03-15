import "@testing-library/jest-dom";
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";

// userEvent v14 default delay:0 uses setTimeout(0) between each of the ~16
// pointer/mouse events fired per click(). Under parallel test execution those
// macrotasks pile up and can push individual tests past the 10 s timeout.
// Setting delay:null switches them to Promise.resolve() microtasks, which are
// not affected by event-loop congestion — eliminating the flakiness without
// changing test semantics.
const _origSetup = userEvent.setup.bind(userEvent);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(userEvent as any).setup = (options: Parameters<typeof userEvent.setup>[0] = {}) =>
  _origSetup({ delay: null, ...options });

// Mock Sentry SDKs — they attempt network I/O on init which hangs jsdom tests
vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((cb) => cb({ setExtra: vi.fn() })),
}));
vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
}));

// Mock matchMedia for Radix UI
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver for Radix UI
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Radix UI (@radix-ui/react-focus-scope) uses requestAnimationFrame to schedule
// initial focus callbacks. In jsdom, rAF is backed by macrotasks that can fire
// inside async act() drains and trigger focus/focusin events that reschedule
// React work, creating an infinite loop → 10 000ms timeout.
//
// Fix A — rAF no-op: prevents the rAF-based focus loop.
// Fix B — mock @radix-ui/react-focus-scope: removes timer-based focus scheduling
// at the source. Our tests never assert on focus management behavior, so
// replacing FocusScope with a transparent wrapper is safe and correct.
global.requestAnimationFrame = (_cb: FrameRequestCallback): number => 0;
global.cancelAnimationFrame = (_id: number): void => {};

vi.mock("@radix-ui/react-focus-scope", async () => {
  const React = await import("react");
  return {
    FocusScope: ({
      children,
    }: {
      children: React.ReactNode;
      asChild?: boolean;
      loop?: boolean;
      trapped?: boolean;
      onMountAutoFocus?: (event: Event) => void;
      onUnmountAutoFocus?: (event: Event) => void;
    }) => React.createElement(React.Fragment, null, children),
  };
});

// Global style to disable animations and transitions for testing
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    * {
      transition: none !important;
      animation: none !important;
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }
  `;
  document.head.appendChild(style);
}
