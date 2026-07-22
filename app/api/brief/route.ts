import { generateDemoBrief, validateBriefRequest } from "@/lib/pillarprep/generator";
import type { BriefRequest } from "@/lib/pillarprep/types";

export async function POST(request: Request) {
  let payload: Partial<BriefRequest>;

  try {
    payload = (await request.json()) as Partial<BriefRequest>;
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const validationError = validateBriefRequest(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const brief = generateDemoBrief(payload as BriefRequest);

  return Response.json(brief, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
