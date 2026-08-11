import { generateDemoBrief, validateBriefRequest } from "@/lib/pillarprep/generator";
import {
  extractBackendError,
  normalizeBriefResponse,
} from "@/lib/pillarprep/response";
import type { BriefRequest } from "@/lib/pillarprep/types";

const backendUrl = process.env.PILLARPREP_BACKEND_URL?.trim();
const backendApiKey = process.env.PILLARPREP_BACKEND_API_KEY?.trim();

async function forwardToAwsBackend(payload: BriefRequest, requireLive: boolean) {
  if (!backendUrl) {
    if (requireLive) {
      return Response.json({ error: "Live AWS mode is not configured on this server" }, { status: 503 });
    }
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
        error: extractBackendError(body),
      },
      { status: response.status }
    );
  }

  try {
    return Response.json(normalizeBriefResponse(JSON.parse(body), "bedrock"), {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        error: "AWS backend returned invalid JSON",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const requestedMode = request.headers.get("x-pillarprep-mode");
  const requireLive = requestedMode === "live";
  const forceDemo = requestedMode === "demo";
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
  let awsResponse: Response | null;

  try {
    awsResponse = forceDemo ? null : await forwardToAwsBackend(briefRequest, requireLive);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? `AWS backend request failed: ${error.message}`
            : "AWS backend request failed",
      },
      { status: 502 }
    );
  }

  if (awsResponse) {
    return awsResponse;
  }

  const brief = normalizeBriefResponse(generateDemoBrief(briefRequest), "demo");

  return Response.json(brief, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
