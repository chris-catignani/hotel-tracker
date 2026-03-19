import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { searchProperties } from "@/lib/geo-lookup";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;

    const q = request.nextUrl.searchParams.get("q") ?? "";
    if (q.trim().length < 3) {
      return NextResponse.json([]);
    }

    const accommodationType = request.nextUrl.searchParams.get("accommodationType");
    const isHotel = accommodationType !== "apartment";
    const results = await searchProperties(q, isHotel);
    return NextResponse.json(results);
  } catch (error) {
    return apiError("Failed to search properties", error, 500, request);
  }
}
