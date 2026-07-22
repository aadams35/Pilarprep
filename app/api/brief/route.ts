import { generateDemoBrief, validateBriefRequest } from "@/lib/pillarprep/generator";
import type { BriefRequest } from "@/lib/pillarprep/types";

const backendUrl = process.env.PILLARPREP_BACKEND_URL?.trim();
const backendApiKey = process.env.PILLARPREP_BACKEND_API_KEY?.trim();

async function forwardToAwsBackend(payload: BriefRequest) {
  if (!backendUrl) {
    return null;
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (backendApiKey) {
    headers["x-api-key"] = backendApiKey;
  }

  const response = await fetch(backendUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = await response.text();

  if (!response.ok) {
    return Response.json(
      {
        error: body || "AWS backend request failed",
      },
      { status: response.status }
    );
  }

  return new Response(body, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}

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

  const briefRequest = payload as BriefRequest;
  const awsResponse = await forwardToAwsBackend(briefRequest);

  if (awsResponse) {
    return awsResponse;
  }

  const brief = generateDemoBrief(briefRequest);

  return Response.json(brief, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
