import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const backendUrl = isDev
    ? process.env.BACKEND_URL || "http://localhost:8091"
    : process.env.API_URL || "http://anheyu:8091";

  const backendRes = await fetch(`${backendUrl}/api/ai/writing/continue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("authorization") || "",
    },
    body: await req.text(),
    signal: req.signal,
  });

  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: {
      "Content-Type":
        backendRes.headers.get("content-type") || "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
