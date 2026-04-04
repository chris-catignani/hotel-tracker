import "@testing-library/jest-dom";
import { vi } from "vitest";
import { config } from "dotenv";

// Load .env.local so integration tests can access secrets (e.g. ANTHROPIC_API_KEY)
config({ path: ".env.local" });

import React from "react";

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

// Mock matchMedia for Radix UI (jsdom only — not available in node environment)
if (typeof window !== "undefined") {
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
}
