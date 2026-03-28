import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

type RouteHandler = (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>;

export function withRouteLogging(name: string, handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ...args: unknown[]) => {
    const start = Date.now();
    logger.info(`${name}: request`, {
      method: req.method,
      pathname: new URL(req.url).pathname,
    });
    try {
      const response = await handler(req, ...args);
      logger.info(`${name}: completed`, {
        status: response.status,
        durationMs: Date.now() - start,
      });
      return response;
    } catch (error) {
      logger.error(`${name}: failed`, error, { durationMs: Date.now() - start });
      throw error;
    }
  };
}
