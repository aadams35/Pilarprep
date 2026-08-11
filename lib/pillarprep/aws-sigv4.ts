import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import type { AwsCredentialIdentity, Provider } from "@smithy/types";

export type AwsCredentialsInput =
  | AwsCredentialIdentity
  | Provider<AwsCredentialIdentity>;

type CognitoIdentityProviderOptions = {
  identityPoolId: string;
  region: string;
};

type CognitoCacheEntry = {
  identityId: string;
  credentials: AwsCredentialIdentity;
};

const cognitoCredentialCache = new Map<string, CognitoCacheEntry>();

export function parseApiGatewayRegion(url: string, fallback = "us-east-1") {
  try {
    const hostname = new URL(url).hostname;
    const match = hostname.match(/\.execute-api\.([a-z0-9-]+)\./);
    return match?.[1] ?? fallback;
  } catch {
    return fallback;
  }
}

function credentialsAreFresh(credentials: AwsCredentialIdentity) {
  const expiresAt = credentials.expiration?.getTime();
  return !expiresAt || expiresAt - Date.now() > 60_000;
}

function parseCognitoExpiration(value: unknown) {
  if (typeof value === "number") {
    return new Date(value < 10_000_000_000 ? value * 1000 : value);
  }

  if (typeof value === "string") {
    return new Date(value);
  }

  return undefined;
}

async function postCognitoIdentity<T>(
  region: string,
  target: "GetId" | "GetCredentialsForIdentity",
  payload: unknown
) {
  const response = await fetch(`https://cognito-identity.${region}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityService.${target}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Cognito Identity ${target} failed with HTTP ${response.status}.`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`Cognito Identity ${target} returned invalid JSON.`);
  }
}

export function cognitoIdentityCredentialsProvider({
  identityPoolId,
  region,
}: CognitoIdentityProviderOptions): Provider<AwsCredentialIdentity> {
  return async () => {
    const cacheKey = `${region}:${identityPoolId}`;
    const cached = cognitoCredentialCache.get(cacheKey);

    if (cached && credentialsAreFresh(cached.credentials)) {
      return cached.credentials;
    }

    const identity = cached?.identityId
      ? { IdentityId: cached.identityId }
      : await postCognitoIdentity<{ IdentityId?: string }>(region, "GetId", {
          IdentityPoolId: identityPoolId,
        });
    const identityId = identity.IdentityId;

    if (!identityId) {
      throw new Error("Cognito Identity did not return an identity ID.");
    }

    const credentialResponse = await postCognitoIdentity<{
      Credentials?: {
        AccessKeyId?: string;
        SecretKey?: string;
        SessionToken?: string;
        Expiration?: number | string;
      };
    }>(region, "GetCredentialsForIdentity", {
      IdentityId: identityId,
    });
    const credentials = credentialResponse.Credentials;

    if (!credentials?.AccessKeyId || !credentials.SecretKey) {
      throw new Error("Cognito Identity did not return usable credentials.");
    }

    const nextCredentials: AwsCredentialIdentity = {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretKey,
      sessionToken: credentials.SessionToken,
      expiration: parseCognitoExpiration(credentials.Expiration),
    };

    cognitoCredentialCache.set(cacheKey, {
      identityId,
      credentials: nextCredentials,
    });

    return nextCredentials;
  };
}

export async function signedJsonFetch(
  url: string,
  payload: unknown,
  credentials: AwsCredentialsInput,
  region = parseApiGatewayRegion(url)
) {
  const endpoint = new URL(url);
  const body = JSON.stringify(payload);
  const signer = new SignatureV4({
    credentials,
    region,
    service: "execute-api",
    sha256: Sha256,
  });
  const request = new HttpRequest({
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    port: endpoint.port ? Number(endpoint.port) : undefined,
    method: "POST",
    path: `${endpoint.pathname}${endpoint.search}`,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      host: endpoint.host,
    },
    body,
  });
  const signedRequest = await signer.sign(request);
  const headers = new Headers();

  for (const [key, value] of Object.entries(signedRequest.headers)) {
    const normalizedKey = key.toLowerCase();

    if (normalizedKey === "host" || normalizedKey === "content-length") {
      continue;
    }

    headers.set(key, value);
  }

  return fetch(url, {
    method: "POST",
    headers,
    body,
  });
}