import { withAxiomRouteHandler } from "next-axiom";

type RouteHandler = Parameters<typeof withAxiomRouteHandler>[0];
type WrappedHandler = ReturnType<typeof withAxiomRouteHandler>;

/**
 * Wraps route handlers with Axiom observability in production (Vercel).
 * In local dev, withAxiomRouteHandler blocks the response for ~2s while flushing
 * logs (it only uses the non-blocking waitUntil path on Vercel). Pass through
 * directly in development to keep local response times fast.
 */
export function withObservability(handler: RouteHandler): WrappedHandler {
  if (process.env.NODE_ENV === "production") {
    return withAxiomRouteHandler(handler);
  }
  return handler as unknown as WrappedHandler;
}
