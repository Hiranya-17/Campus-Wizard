import type {
  ChatRequest,
  ChatResponse,
  SemesterPlanRequest,
  SemesterPlanResponse,
  WeekPlanRequest,
  WeekPlanResponse,
} from "@/lib/types";
import { mockSemesterPlan, mockWeekPlan } from "@/mocks/index";

// ---------------------------------------------------------------------------
// Environment flag — set NEXT_PUBLIC_USE_MOCKS=true in .env.local to bypass
// all network calls and return mock data instead.
// ---------------------------------------------------------------------------
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

// ---------------------------------------------------------------------------
// ApiError — thrown by every API client function on non-2xx responses or
// network failures. Components catch this to display user-facing error text.
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Internal POST helper — shared by postSemesterPlan and postWeekPlan.
// postChat uses its own fetch call so it can pass an AbortSignal.
// ---------------------------------------------------------------------------
async function post<TReq, TRes>(
  path: string,
  body: TReq,
  signal?: AbortSignal,
): Promise<TRes> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    throw new ApiError(0, msg);
  }

  if (!res.ok) {
    throw new ApiError(res.status, `${path} responded ${res.status}`);
  }

  return res.json() as Promise<TRes>;
}

// ---------------------------------------------------------------------------
// Public API clients
// ---------------------------------------------------------------------------

/** POST /api/plan/semester */
export async function postSemesterPlan(
  req: SemesterPlanRequest,
): Promise<SemesterPlanResponse> {
  if (USE_MOCKS) return Promise.resolve(mockSemesterPlan);
  return post<SemesterPlanRequest, SemesterPlanResponse>(
    "/api/plan/semester",
    req,
  );
}

/** POST /api/plan/week */
export async function postWeekPlan(
  req: WeekPlanRequest,
): Promise<WeekPlanResponse> {
  if (USE_MOCKS) return Promise.resolve(mockWeekPlan);
  return post<WeekPlanRequest, WeekPlanResponse>("/api/plan/week", req);
}

/** POST /api/chat — includes a 30-second AbortController timeout. */
export async function postChat(req: ChatRequest): Promise<ChatResponse> {
  if (USE_MOCKS) {
    return Promise.resolve({
      reply: "Mock reply — mocks are enabled.",
      cards: [],
      engine: "rules",
    } satisfies ChatResponse);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    return await post<ChatRequest, ChatResponse>(
      "/api/chat",
      req,
      controller.signal,
    );
  } finally {
    clearTimeout(timer);
  }
}
