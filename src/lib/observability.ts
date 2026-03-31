import { withAxiomRouteHandler, Logger } from "next-axiom";
import type { AxiomRequest } from "next-axiom/dist/withAxiom";
import { type NextRequest } from "next/server";

type RouteHandler = Parameters<typeof withAxiomRouteHandler>[0];
type WrappedHandler = ReturnType<typeof withAxiomRouteHandler>;

/**
 * Wraps route handlers with Axiom observability in production (Vercel).
 * In local dev, withAxiomRouteHandler blocks the response for ~2s while flushing
 * logs (it only uses the non-blocking waitUntil path on Vercel). In development
 * we attach a plain Logger instance (falls back to console.log when no Axiom
 * token is configured) so req.log is available for parity.
 *
 * When Axiom is not configured (e.g. in CI), we skip withAxiomRouteHandler to
 * avoid duplicate console output from next-axiom's prettyPrint fallback.
 */
export function withObservability(handler: RouteHandler): WrappedHandler {
  if (process.env.NODE_ENV === "production" && process.env.AXIOM_TOKEN) {
    return withAxiomRouteHandler(handler);
  }
  return ((req: NextRequest, arg?: unknown) => {
    const axiomReq = req as AxiomRequest;
    axiomReq.log = new Logger();
    return handler(axiomReq, arg);
  }) as WrappedHandler;
}
