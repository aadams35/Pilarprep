import {
  cognitoIdentityCredentialsProvider,
  parseApiGatewayRegion,
  signedJsonFetch,
} from "@/lib/pillarprep/aws-sigv4";
import { generateDemoBrief, validateBriefRequest } from "@/lib/pillarprep/generator";
import {
  extractBackendError,
  normalizeBriefResponse,
} from "@/lib/pillarprep/response";
import type { BriefRequest } from "@/lib/pillarprep/types";

const backendUrl = process.env.PILLARPREP_BACKEND_URL?.trim();
const backendApiKey = process.env.PILLARPREP_BACKEND_API_KEY?.trim();
const backendAuthMode = (process.env.PILLARPREP_BACKEND_AUTH_MODE ?? "iam").trim().toLowerCase();
const backendRegion =
  process.env.PILLARPREP_BACKEND_REGION?.trim() ||
  parseApiGatewayRegion(backendUrl ?? "", process.env.AWS_REGION ?? "us-east-1");
const backendIdentityPoolId =
  process.env.PILLARPREP_COGNITO_IDENTITY_POOL_ID?.trim() ||
  process.env.VITE_PILLARPREP_COGNITO_IDENTITY_POOL_ID?.trim();
const useIamBackendAuth = backendAuthMode !== "api-key";
async function getNodeCredentials() {
  const { fromNodeProviderChain } = await import("@aws-sdk/credential-providers");
  return fromNodeProviderChain()();
}
const iamCredentials = backendIdentityPoolId
  ? cognitoIdentityCredentialsProvider({
      region: backendRegion,
      identityPoolId: backendIdentityPoolId,
    })
  : getNodeCredentials;

const noStoreHeaders = {
  "cache-control": "no-store",
};

async function forwardToAwsBackend(payload: BriefRequest, requireLive: boolean) {
  if (!backendUrl) {
    if (requireLive) {
      return Response.json(
        { error: "AI model mode is not configured on this server" },
        { status: 503, headers: noStoreHeaders }
      );
    }
    return null;
  }

  const response = useIamBackendAuth
    ? await signedJsonFetch(
        backendUrl,
        payload,
        iamCredentials,
        backendRegion
      )
    : await fetch(backendUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(backendApiKey ? { "x-api-key": backendApiKey } : {}),
        },
        body: JSON.stringify(payload),
      });

  const body = await response.text();

  if (!response.ok) {
    return Response.json(
      {
        error: extractBackendError(body),
      },
      { status: response.status, headers: noStoreHeaders }
    );
  }

  try {
    return Response.json(normalizeBriefResponse(JSON.parse(body), "bedrock"), {
      headers: noStoreHeaders,
    });
  } catch {
    return Response.json(
      {
        error: "AWS backend returned invalid JSON",
      },
      { status: 502, headers: noStoreHeaders }
    );
  }
}

export async function GET() {
  return Response.json(
    {
      liveConfigured: Boolean(backendUrl),
      apiKeyConfigured: Boolean(backendApiKey),
      authMode: useIamBackendAuth
        ? backendIdentityPoolId
          ? "iam-cognito-demo"
          : "iam"
        : "api-key",
      region: backendRegion,
      provider: backendUrl ? "bedrock" : "demo",
    },
    { headers: noStoreHeaders }
  );
}

export async function POST(request: Request) {
  const requestedMode = request.headers.get("x-pillarprep-mode");
  const requireLive = requestedMode === "live";
  const forceDemo = requestedMode === "demo";
  let payload: Partial<BriefRequest>;

  try {
    payload = (await request.json()) as Partial<BriefRequest>;
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400, headers: noStoreHeaders });
  }

  const validationError = validateBriefRequest(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400, headers: noStoreHeaders });
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
      { status: 502, headers: noStoreHeaders }
    );
  }

  if (awsResponse) {
    return awsResponse;
  }

  const brief = normalizeBriefResponse(generateDemoBrief(briefRequest), "demo");

  return Response.json(brief, {
    headers: noStoreHeaders,
  });
}