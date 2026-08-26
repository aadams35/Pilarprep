# Authentication Flow

## Guest demo

1. The browser selects Guest demo.
2. Cognito Identity Pools returns a distinct unauthenticated identity and temporary
   STS credentials.
3. The browser SigV4-signs the guest Jobs API request.
4. API Gateway verifies AWS_IAM authorization.
5. The Jobs API reads the IAM Cognito identity from authorizer context.
6. The service derives a stable hashed guest tenant and user ID.
7. Requested client and project must match the synthetic allowlist and each other.
8. DynamoDB applies hourly and daily limits to the trusted identity.
9. Artifacts use the guest tenant prefix and receive the guest-temporary retention tag.

Changing sessionId, localStorage, or private browsing state does not merge one guest
with another or grant access to an existing guest partition.

## Authenticated workspace

1. The user selects Private workspace.
2. The browser creates PKCE verifier/challenge values and redirects to Cognito managed
   login.
3. Cognito verifies email credentials and returns an authorization code to the
   configured HTTPS callback.
4. The browser exchanges the code plus verifier for tokens.
5. Workspace requests use the CloudFront /api path with the access token.
6. CloudFront applies WAF, removes /api, changes to the API origin host, and injects
   the origin-verification secret.
7. API Gateway validates issuer and audience with the Workspace JWT authorizer.
8. The Jobs API derives subject, tenant, assignments, user tier, and groups from
   authorizer claims.
9. The origin secret is checked for every /workspace route.
10. The request is allowed only inside the derived tenant/client/project scope.

The frontend stores tokens in session storage, not durable local storage. Sign-out
clears workspace state and tokens.

## Cognito configuration

- User Pool deletion protection enabled
- Email as username and auto-verified attribute
- Twelve-character password minimum
- Optional TOTP MFA
- Account recovery by verified email
- Authorization code OAuth flow
- PKCE in the browser
- HTTPS callback/logout URLs for production
- Localhost callback only for local development configuration
- Premium and operator access via trusted Cognito groups

## Claims

| Claim | Use |
| --- | --- |
| sub | Stable verified user identity |
| custom:tenantId | Optional managed tenant assignment |
| custom:clientIds | Comma-separated authorized clients |
| custom:projectIds | Optional project restriction |
| cognito:groups | PilarPrepPremium and PilarPrepOperators |
| iss / aud | JWT issuer and application audience validation |

If custom:tenantId is absent, the service creates a personal tenant from sub. The
current demo fallback permits synthetic client IDs when client claims are absent.
Production onboarding should require explicit assignments.

## Failure behavior

- Missing or invalid JWT: API Gateway rejects before Lambda.
- Missing IAM identity: 403.
- Invalid CloudFront origin secret: 403 without revealing why.
- Client or project outside assignment: generic unavailable response plus metric.
- Expired tokens: browser must sign in again.
- Quota exceeded: 429 with a bounded retry-after value.
- Generation kill switch: 503 without invoking a model.

## Sign-out and revocation

Frontend sign-out removes local tokens. Cognito refresh-token revocation and user
disablement prevent future refresh/sign-in. For production, add global sign-out on
sensitive role changes and an administrator workflow for group/assignment updates.
