import base64
import json
import os
from datetime import datetime, timezone

import boto3


MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.amazon.nova-micro-v1:0")
REGION = os.getenv("AWS_REGION", "us-east-1")
ARTIFACT_BUCKET = os.getenv("ARTIFACT_BUCKET", "")
PROJECT_TABLE = os.getenv("PROJECT_TABLE", "")
PILLARPREP_API_KEY = os.getenv("PILLARPREP_API_KEY", "")
LIST_ITEM_COUNT = 3


def _metric(name, value=1, **dimensions):
    metric_dimensions = dimensions or {"Service": "BriefFunction"}
    metric = {
        "_aws": {
            "Timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
            "CloudWatchMetrics": [
                {
                    "Namespace": "PillarPrep",
                    "Dimensions": [list(metric_dimensions.keys())],
                    "Metrics": [{"Name": name, "Unit": "Count"}],
                }
            ],
        },
        name: value,
        **metric_dimensions,
    }
    print(json.dumps(metric))


def _request_header(event, name):
    headers = event.get("headers") if isinstance(event, dict) else None
    if not isinstance(headers, dict):
        return ""

    target = name.lower()
    for key, value in headers.items():
        if key.lower() == target:
            return str(value or "")

    return ""


def _is_authorized(event):
    if not PILLARPREP_API_KEY:
        return True

    return _request_header(event, "x-api-key") == PILLARPREP_API_KEY


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "content-type": "application/json",
            "access-control-allow-origin": os.getenv("ALLOWED_ORIGIN", "*"),
            "access-control-allow-headers": "accept,authorization,content-type,x-amz-content-sha256,x-amz-date,x-amz-security-token",
            "access-control-allow-methods": "POST,OPTIONS",
            "vary": "origin",
        },
        "body": json.dumps(body),
    }


def _load_payload(event):
    body = event.get("body") if isinstance(event, dict) else None

    if isinstance(body, dict):
        return body

    if body is None:
        return {}

    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")

    return json.loads(body or "{}")


def _system_prompt():
    return """
You are PillarPrep, an AWS Solutions Architect briefing assistant.
Generate concise, practical meeting preparation for AWS pre-sales teams.
Return strict JSON only. Do not include markdown fences, comments, or prose outside JSON.
Treat all generated content as preparation hypotheses to validate with the customer.
Never claim that PillarPrep scraped, browsed, or verified LinkedIn or external profiles.
""".strip()


def _briefing_guidance(payload):
    industry = _clean_string(payload.get("industry"))
    pillars = payload.get("pillars") if isinstance(payload.get("pillars"), list) else []
    industry_hints = {
        "Financial Services": ["audit evidence", "identity boundaries", "regulatory reporting", "customer trust"],
        "Healthcare": ["patient access", "protected health data", "clinical continuity", "interoperability"],
        "Retail": ["peak traffic", "checkout latency", "conversion", "unit cost"],
        "Manufacturing": ["plant uptime", "forecasting data", "edge connectivity", "operational resilience"],
        "Media": ["content workflow", "global delivery", "burst demand", "monetization"],
        "SaaS": ["tenant isolation", "platform reliability", "release velocity", "gross margin"],
    }
    pillar_hints = {
        "Operational Excellence": ["CloudWatch", "runbooks", "incident ownership", "deployment rollback"],
        "Security": ["IAM", "KMS", "Security Hub", "least privilege", "audit trails"],
        "Reliability": ["multi-AZ design", "RTO/RPO", "Route 53", "backup and restore"],
        "Performance Efficiency": ["load testing", "Auto Scaling", "CloudFront", "latency budgets"],
        "Cost Optimization": ["Budgets", "Cost Explorer", "right sizing", "unit economics"],
        "Sustainability": ["right sizing", "managed services", "resource schedules", "waste reduction"],
    }

    selected_hints = []
    for pillar in pillars:
        selected_hints.extend(pillar_hints.get(_clean_string(pillar), []))

    return {
        "industrySignals": industry_hints.get(industry, ["modernization", "operational risk", "security", "measurable outcomes"]),
        "pillarSignals": selected_hints[:10],
        "qualityBar": [
            "Mention the company or its stated context in each technical and executive item.",
            "Prefer validate, quantify, map, confirm, compare, or sequence over generic recommend language.",
            "Use AWS service names only in technical content and only when tied to a concrete customer risk or decision.",
            "Executive content must explain risk, speed, cost, trust, revenue, or governance without AWS jargon.",
        ],
    }


def _build_prompt(payload):
    guidance = _briefing_guidance(payload)
    request_context = {
        "company": payload.get("company", ""),
        "industry": payload.get("industry", ""),
        "meetingType": payload.get("meetingType", ""),
        "companySize": payload.get("companySize", ""),
        "pillars": payload.get("pillars", []),
        "context": payload.get("context", ""),
        "decisionMakers": payload.get("decisionMakers", []),
        "meetingNotes": payload.get("meetingNotes", ""),
        "feedback": payload.get("feedback", []),
        "role": payload.get("role", ""),
        "prompt": payload.get("prompt", ""),
        "mode": payload.get("mode", "prebrief"),
        "briefingGuidance": guidance,
    }

    schema = {
        "technical": ["string", "string", "string"],
        "executive": ["string", "string", "string"],
        "stakeholders": ["string", "string", "string"],
        "gameplan": ["string", "string", "string"],
        "objections": [
            "Concern: customer concern. Response: practical response.",
            "Concern: customer concern. Response: practical response.",
            "Concern: customer concern. Response: practical response.",
        ],
        "projectAnswer": "one useful paragraph for the requested follow-on role and prompt",
        "projectArtifacts": {
            "twoWeekPlan": [
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
            ],
            "riskRegister": [
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
            ],
            "stakeholderMap": [
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
            ],
            "followUpEmail": {"subject": "string", "body": "string"},
        },
        "citations": ["string", "string"],
    }

    return f"""
Generate a PillarPrep response for the request below.

Required JSON schema:
{json.dumps(schema, ensure_ascii=True, indent=2)}

Content requirements:
- technical: exactly 3 complete SA-facing sentences, each with a clear action or validation point, not headings; every sentence must connect to the company context, selected pillars, or industry signals.
- executive: exactly 3 complete business-facing sentences with no AWS jargon, not headings; every sentence must name a business risk, outcome, metric, or decision.
- stakeholders: exactly 3 complete sentences based only on supplied decision-maker context; say what to validate if context is thin.
- gameplan: exactly 3 complete sentences for how the SA should run the meeting.
- objections: exactly 3 complete sentences in "Concern: ... Response: ..." form.
- projectAnswer: always answer the requested follow-on role and prompt using the generated brief context so Project Brain can auto-build from the same response.
- projectArtifacts: always include exactly 3 two-week plan items, exactly 3 risks, exactly 3 stakeholder map items, and one follow-up email in the same response.
- citations: 2-4 short labels only, such as "Customer context", "Decision-maker notes", or "AWS Well-Architected pillars".
- Tie technical content to the selected AWS Well-Architected pillars.
- Include AWS services only when useful for the conversation.
- Treat unknowns as assumptions to validate.
- Keep output compact enough for a pre-meeting brief, but never return one- or two-word labels such as "IAM roles" or "Secure migration".
- Avoid generic textbook cloud advice; tailor wording to the supplied customer context, industry signals, meeting type, and selected pillars.
- If a service is named, include why it matters for this customer decision.

Request JSON:
{json.dumps(request_context, ensure_ascii=True, indent=2)}
""".strip()


def _invoke_bedrock(prompt):
    client = boto3.client("bedrock-runtime", region_name=REGION)
    result = client.converse(
        modelId=MODEL_ID,
        system=[{"text": _system_prompt()}],
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}],
            }
        ],
        inferenceConfig={
            "temperature": 0.2,
            "maxTokens": 2600,
        },
    )
    content = result.get("output", {}).get("message", {}).get("content", [])
    text = "\n".join(
        str(block.get("text", ""))
        for block in content
        if isinstance(block, dict) and block.get("text")
    ).strip()

    return {
        "text": text,
        "usage": result.get("usage", {}),
        "metrics": result.get("metrics", {}),
    }


def _clean_string(value):
    if value is None:
        return ""

    return str(value).strip()


def _as_string_list(value):
    if isinstance(value, list):
        return [_clean_string(item) for item in value if _clean_string(item)]

    if value:
        return [_clean_string(value)]

    return []


def _first_pillar(payload):
    pillars = payload.get("pillars") if isinstance(payload.get("pillars"), list) else []
    return _clean_string(pillars[0]) if pillars else "the top Well-Architected priority"


def _safe_company(payload):
    return _clean_string(payload.get("company")) or "the customer"


def _fallback_project_artifacts(payload):
    company = _safe_company(payload)
    primary_pillar = _first_pillar(payload)
    decision_makers = payload.get("decisionMakers") if isinstance(payload.get("decisionMakers"), list) else []
    first_person = decision_makers[0] if decision_makers and isinstance(decision_makers[0], dict) else {}
    stakeholder_name = _clean_string(first_person.get("name")) or "Primary sponsor"
    stakeholder_title = _clean_string(first_person.get("title")) or "Role to confirm"

    return {
        "twoWeekPlan": [
            {
                "title": "Days 1-2: Confirm outcomes",
                "detail": f"Validate success criteria, decision process, and the business event driving urgency for {company}.",
                "owner": "SA / Sales",
                "status": "Ready",
            },
            {
                "title": "Days 3-7: Validate current state",
                "detail": f"Review architecture, data boundaries, RTO/RPO, compliance needs, and {primary_pillar.lower()} assumptions.",
                "owner": "SA / Customer technical owner",
                "status": "Ready",
            },
            {
                "title": "Days 8-10: Shape pilot",
                "detail": "Define pilot scope, rollback criteria, owners, risks, and executive checkpoint before broader delivery.",
                "owner": "PM / SA",
                "status": "Queued",
            },
        ],
        "riskRegister": [
            {
                "title": "Unvalidated assumptions",
                "detail": "Generated recommendations must be confirmed in discovery before they become architecture decisions.",
                "owner": "SA",
                "status": "High",
            },
            {
                "title": "Stakeholder alignment",
                "detail": "Executive success criteria and technical acceptance criteria may not match yet.",
                "owner": "Sales / PM",
                "status": "Medium",
            },
            {
                "title": "Implementation scope creep",
                "detail": "Keep the first pilot bounded so cost, reliability, and security evidence can be reviewed quickly.",
                "owner": "PM",
                "status": "Medium",
            },
        ],
        "stakeholderMap": [
            {
                "title": stakeholder_name,
                "detail": f"Validate priorities for {stakeholder_title} and confirm what success looks like from that seat.",
                "owner": stakeholder_title,
                "status": "Validate",
            },
            {
                "title": "Technical owner",
                "detail": "Confirm current-state architecture, constraints, integration points, and operating model.",
                "owner": "Customer architecture lead",
                "status": "Identify",
            },
            {
                "title": "Security / compliance approver",
                "detail": "Confirm control evidence, data classification, identity boundaries, and approval path.",
                "owner": "Customer security lead",
                "status": "Identify",
            },
        ],
        "followUpEmail": {
            "subject": f"Follow-up from PillarPrep briefing for {company}",
            "body": (
                f"Thanks for the conversation. We captured the key context for {company}, with "
                f"{primary_pillar.lower()} as an early validation area.\n\n"
                "Recommended next step: run a focused working session to confirm stakeholders, "
                "current-state assumptions, success criteria, risks, and pilot scope."
            ),
        },
    }


def _fallback_generated(payload, model_text=""):
    company = _safe_company(payload)
    primary_pillar = _first_pillar(payload)
    industry = _clean_string(payload.get("industry")) or "the customer's industry"
    meeting_type = _clean_string(payload.get("meetingType")) or "customer meeting"
    context = _clean_string(payload.get("context"))
    model_hint = " The model response was not valid JSON, so this safe fallback should be refined before sharing." if model_text else ""

    decision_makers = payload.get("decisionMakers") if isinstance(payload.get("decisionMakers"), list) else []
    stakeholder_lines = []
    for person in decision_makers[:LIST_ITEM_COUNT]:
        if isinstance(person, dict):
            name = _clean_string(person.get("name")) or "Decision maker"
            title = _clean_string(person.get("title")) or "Role to confirm"
            person_context = _clean_string(person.get("context"))
            signal = f" Signal to validate: {person_context}" if person_context else " Confirm priorities and decision criteria before tailoring the talk track."
            stakeholder_lines.append(f"{name}, {title}: connect the meeting opening to {primary_pillar.lower()} and validate what outcome matters most.{signal}")

    generic_stakeholder_lines = [
        "Identify the economic buyer before the follow-up so the business outcome, funding path, and definition of success have an accountable owner.",
        "Identify the technical owner before the follow-up so architecture assumptions, dependencies, and implementation constraints can be validated quickly.",
        "Identify the security or compliance approver before the follow-up so control evidence, data boundaries, and review checkpoints are visible early.",
    ]
    for line in generic_stakeholder_lines:
        if len(stakeholder_lines) >= LIST_ITEM_COUNT:
            break
        stakeholder_lines.append(line)

    return {
        "technical": [
            f"For {company}, validate the current architecture, integration path, identity model, data boundaries, and operational ownership before recommending services.",
            f"Use {primary_pillar} as the first deep-dive lens; confirm RTO/RPO, compliance obligations, latency targets, observability, and rollback expectations.",
            "Relevant AWS references include Lambda/API Gateway for orchestration, S3 for artifacts, DynamoDB for project state, CloudWatch for telemetry, and Bedrock for generation.",
        ],
        "executive": [
            f"{company} is preparing for a {meeting_type.lower()} where the business story should stay tied to risk reduction, speed, and measurable progress.",
            f"Frame the work around {industry} outcomes: clearer decisions, reduced delivery friction, and a safer path from discussion to implementation.",
            f"The next executive decision is whether to approve a bounded validation path with clear owners, success measures, and checkpoints.{model_hint}",
        ],
        "stakeholders": stakeholder_lines[:LIST_ITEM_COUNT],
        "gameplan": [
            "Open by confirming the business event driving urgency, then map each technical unknown to business impact.",
            f"Spend the technical portion on {primary_pillar.lower()}, current-state constraints, dependencies, risks, and evidence the customer needs to proceed.",
            "Close with confirmed goals, open questions, owners, next meeting, and how the generated Project Brain handoff should be used.",
        ],
        "objections": [
            "Concern: We cannot risk disruption. Response: propose a bounded pilot with rollback criteria and a checkpoint before broader rollout.",
            "Concern: This may increase cost. Response: start with unit-cost visibility, right-sizing, and a decision point tied to business value.",
            "Concern: We do not have enough internal capacity. Response: identify the smallest validation path and assign owners only for the first two weeks.",
        ],
        "projectAnswer": f"Start with a two-week validation sprint for {company}: confirm stakeholders, validate {primary_pillar.lower()} assumptions, capture current-state architecture, document risks and owners, and publish a decision log before implementation expands.",
        "projectArtifacts": _fallback_project_artifacts(payload),
        "citations": ["Customer context", "Decision-maker notes", "AWS Well-Architected pillars" if context else "PillarPrep fallback"],
    }


def _is_useful_brief_line(item):
    words = item.replace("/", " ").replace("-", " ").split()
    return len(words) >= 8


def _ensure_string_items(value, fallback_items, count=LIST_ITEM_COUNT):
    items = [item for item in _as_string_list(value) if _is_useful_brief_line(item)]
    fallback = _as_string_list(fallback_items)

    for item in fallback:
        if len(items) >= count:
            break
        if item not in items:
            items.append(item)

    return items[:count]


def _artifact_item(value, fallback):
    source = value if isinstance(value, dict) else {}
    fallback_source = fallback if isinstance(fallback, dict) else {}

    title = _clean_string(source.get("title")) or _clean_string(fallback_source.get("title")) or "Project artifact"
    detail = _clean_string(source.get("detail")) or _clean_string(fallback_source.get("detail")) or "No detail returned."
    owner = _clean_string(source.get("owner")) or _clean_string(fallback_source.get("owner")) or "TBD"
    status = _clean_string(source.get("status")) or _clean_string(fallback_source.get("status")) or "Queued"

    return {"title": title, "detail": detail, "owner": owner, "status": status}


def _artifact_list(value, fallback_items):
    source_items = value if isinstance(value, list) else []
    result = []

    for index in range(LIST_ITEM_COUNT):
        source = source_items[index] if index < len(source_items) else {}
        fallback = fallback_items[index] if index < len(fallback_items) else {}
        result.append(_artifact_item(source, fallback))

    return result


def _normalize_project_artifacts(value, fallback):
    source = value if isinstance(value, dict) else {}
    fallback_email = fallback["followUpEmail"]
    source_email = source.get("followUpEmail") if isinstance(source.get("followUpEmail"), dict) else {}

    return {
        "twoWeekPlan": _artifact_list(source.get("twoWeekPlan"), fallback["twoWeekPlan"]),
        "riskRegister": _artifact_list(source.get("riskRegister"), fallback["riskRegister"]),
        "stakeholderMap": _artifact_list(source.get("stakeholderMap"), fallback["stakeholderMap"]),
        "followUpEmail": {
            "subject": _clean_string(source_email.get("subject")) or fallback_email["subject"],
            "body": _clean_string(source_email.get("body")) or fallback_email["body"],
        },
    }


def _normalize_generated(parsed, payload, model_text=""):
    fallback = _fallback_generated(payload, model_text)
    source = parsed if isinstance(parsed, dict) else {}
    citations = _as_string_list(source.get("citations"))

    for citation in fallback["citations"]:
        if len(citations) >= 2:
            break
        if citation not in citations:
            citations.append(citation)

    return {
        "technical": _ensure_string_items(source.get("technical"), fallback["technical"]),
        "executive": _ensure_string_items(source.get("executive"), fallback["executive"]),
        "stakeholders": _ensure_string_items(source.get("stakeholders"), fallback["stakeholders"]),
        "gameplan": _ensure_string_items(source.get("gameplan"), fallback["gameplan"]),
        "objections": _ensure_string_items(source.get("objections"), fallback["objections"]),
        "projectAnswer": _clean_string(source.get("projectAnswer")) or fallback["projectAnswer"],
        "projectArtifacts": _normalize_project_artifacts(source.get("projectArtifacts"), fallback["projectArtifacts"]),
        "citations": citations[:4] or fallback["citations"][:2],
    }


def _parse_model_response(model_text, payload):
    cleaned = model_text.strip()

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")

    if start >= 0 and end > start:
        cleaned = cleaned[start : end + 1]

    parsed = json.loads(cleaned)
    return _normalize_generated(parsed, payload, model_text)


def _project_id(payload):
    company = payload.get("company") or "customer"
    slug = "".join(char.lower() if char.isalnum() else "-" for char in company)
    slug = "-".join(part for part in slug.split("-") if part)
    return payload.get("projectId") or slug or "customer"


def _store_project_artifacts(payload, generated):
    metadata = {"projectId": _project_id(payload)}
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    document = {
        "request": payload,
        "response": generated,
        "storedAt": datetime.now(timezone.utc).isoformat(),
    }

    try:
        if ARTIFACT_BUCKET:
            artifact_key = f"projects/{metadata['projectId']}/briefs/{timestamp}.json"
            s3 = boto3.client("s3", region_name=REGION)
            s3.put_object(
                Bucket=ARTIFACT_BUCKET,
                Key=artifact_key,
                Body=json.dumps(document).encode("utf-8"),
                ContentType="application/json",
            )
            metadata["artifactKey"] = artifact_key

        if PROJECT_TABLE:
            state_key = f"BRIEF#{timestamp}"
            dynamodb = boto3.client("dynamodb", region_name=REGION)
            dynamodb.put_item(
                TableName=PROJECT_TABLE,
                Item={
                    "projectId": {"S": metadata["projectId"]},
                    "sortKey": {"S": state_key},
                    "company": {"S": payload.get("company", "")},
                    "industry": {"S": payload.get("industry", "")},
                    "meetingType": {"S": payload.get("meetingType", "")},
                    "provider": {"S": "bedrock"},
                    "createdAt": {"S": document["storedAt"]},
                },
            )
            metadata["stateKey"] = state_key
    except Exception as error:  # Keep generation useful even if storage is misconfigured.
        metadata["storageWarning"] = str(error)
        _metric("BriefErrors", ErrorType="Storage")

    return metadata


def handler(event, _context):
    if not _is_authorized(event):
        _metric("UnauthorizedRequests")
        return _response(401, {"error": "Unauthorized"})

    _metric("BriefRequests")

    try:
        payload = _load_payload(event)
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        _metric("BriefErrors", ErrorType="InvalidJson")
        return _response(400, {"error": "Invalid JSON payload"})

    required = ["company", "industry", "meetingType", "companySize", "pillars", "context"]
    missing = [field for field in required if not payload.get(field)]

    if missing:
        _metric("BriefErrors", ErrorType="MissingFields")
        return _response(400, {"error": f"Missing required fields: {', '.join(missing)}"})

    if "decisionMakers" in payload and not isinstance(payload["decisionMakers"], list):
        _metric("BriefErrors", ErrorType="InvalidDecisionMakers")
        return _response(400, {"error": "decisionMakers must be an array"})

    if not isinstance(payload.get("pillars"), list):
        _metric("BriefErrors", ErrorType="InvalidPillars")
        return _response(400, {"error": "pillars must be an array"})

    prompt = _build_prompt(payload)

    try:
        bedrock_result = _invoke_bedrock(prompt)
    except Exception as error:
        _metric("BriefErrors", ErrorType="BedrockInvocation")
        return _response(502, {"error": f"Bedrock invocation failed: {error}"})

    if isinstance(bedrock_result, dict):
        model_text = str(bedrock_result.get("text", ""))
        usage = bedrock_result.get("usage", {})
        metrics = bedrock_result.get("metrics", {})
    else:
        model_text = str(bedrock_result)
        usage = {}
        metrics = {}

    try:
        generated = _parse_model_response(model_text, payload)
    except (AttributeError, json.JSONDecodeError, UnicodeDecodeError, ValueError, TypeError):
        _metric("BriefErrors", ErrorType="ModelJsonFallback")
        generated = _fallback_generated(payload, model_text)

    generated["provider"] = "bedrock"
    generated["generatedAt"] = datetime.now(timezone.utc).isoformat()
    metadata = _store_project_artifacts(payload, generated)
    metadata["modelId"] = MODEL_ID
    if isinstance(usage, dict):
        for source_key, target_key in (
            ("inputTokens", "inputTokens"),
            ("outputTokens", "outputTokens"),
            ("totalTokens", "totalTokens"),
        ):
            if source_key in usage:
                metadata[target_key] = usage[source_key]
    if isinstance(metrics, dict) and "latencyMs" in metrics:
        metadata["latencyMs"] = metrics["latencyMs"]
    generated["metadata"] = metadata
    _metric("BriefSuccess")

    return _response(200, generated)