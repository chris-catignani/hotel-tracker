import "@testing-library/jest-dom";
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";

import React from "react";

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

// Mock next/link to avoid "Not implemented: navigation to another Document"
// Centralized here to avoid duplication across multiple test files.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    // We use a regular anchor tag to avoid Next.js's complex navigation logic in JSDOM
    return React.createElement(
      "a",
      {
        href,
        onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
          onClick?.(e);
        },
        ...props,
      },
      children
    );
  },
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
// We mock @radix-ui/react-focus-scope directly as it's a more targeted fix
// than a global rAF mock. Our tests never assert on focus management behavior,
// so replacing FocusScope with a transparent wrapper is safe and correct.
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
