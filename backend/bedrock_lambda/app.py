import base64
import json
import os
from datetime import datetime, timezone
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile
from xml.sax.saxutils import escape as xml_escape

import boto3


MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.amazon.nova-micro-v1:0")
REGION = os.getenv("AWS_REGION", "us-east-1")
ARTIFACT_BUCKET = os.getenv("ARTIFACT_BUCKET", "")
PROJECT_TABLE = os.getenv("PROJECT_TABLE", "")
PILLARPREP_API_KEY = os.getenv("PILLARPREP_API_KEY", "")
GUARDRAIL_ID = os.getenv("BEDROCK_GUARDRAIL_ID", "")
GUARDRAIL_VERSION = os.getenv("BEDROCK_GUARDRAIL_VERSION", "")
LIST_ITEM_COUNT = 4


def _metric(name, value=1, **dimensions):
    metric_dimensions = dimensions or {"Service": "BriefFunction"}
    metric = {
        "_aws": {
            "Timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
            "CloudWatchMetrics": [
                {
                    "Namespace": "PilarPrep",
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
You are PilarPrep, an AWS Solutions Architect briefing assistant.
Generate detailed, practical meeting preparation for AWS pre-sales teams.
Return strict JSON only. Do not include markdown fences, comments, or prose outside JSON.
Treat all generated content as preparation hypotheses to validate with the customer.
Never claim that PilarPrep scraped, browsed, or verified LinkedIn or external profiles.
""".strip()


def _briefing_guidance(payload):
    industry = _clean_string(payload.get("industry"))
    ranked_pillars = _pillar_ranking(payload)
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
    for ranked_pillar in ranked_pillars:
        selected_hints.extend(pillar_hints.get(ranked_pillar["pillar"], []))

    return {
        "industrySignals": industry_hints.get(industry, ["modernization", "operational risk", "security", "measurable outcomes"]),
        "pillarRanking": ranked_pillars,
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
    ranked_pillars = guidance.get("pillarRanking", [])
    request_context = {
        "company": payload.get("company", ""),
        "industry": payload.get("industry", ""),
        "meetingType": payload.get("meetingType", ""),
        "companySize": payload.get("companySize", ""),
        "pillars": [item.get("pillar", "") for item in ranked_pillars],
        "pillarRanking": ranked_pillars,
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
        "technical": ["string", "string", "string", "string"],
        "executive": ["string", "string", "string", "string"],
        "stakeholders": ["string", "string", "string", "string"],
        "gameplan": ["string", "string", "string", "string"],
        "objections": [
            "Concern: customer concern. Response: practical response.",
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
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
            ],
            "riskRegister": [
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
            ],
            "stakeholderMap": [
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
                {"title": "string", "detail": "string", "owner": "string", "status": "string"},
            ],
            "followUpEmail": {"subject": "string", "body": "string"},
        },
        "citations": ["string", "string"],
    }

    return f"""
Generate a PilarPrep response for the request below.

Required JSON schema:
{json.dumps(schema, ensure_ascii=True, indent=2)}

Content requirements:
- Before writing, identify the company name, industry, meeting type, ranked pillar order, decision-maker notes, feedback, and meeting notes from the Request JSON. Use those as hard anchors, not optional flavor.
- Every technical and executive paragraph must name the company or a supplied stakeholder, refer to the rank 1 pillar, and connect to at least one supplied context detail. Do not write a paragraph that could be reused unchanged for another customer.
- If decision-maker context is supplied, at least two stakeholder or executive paragraphs must use the supplied names, roles, or approved notes. Treat those notes as hypotheses to validate, not as facts.
- If feedback or meetingNotes are supplied, reflect them directly in the refinement, game plan, projectAnswer, and projectArtifacts.
- technical: exactly 4 SA-facing paragraphs, not headings. Each paragraph must be 75-120 words, 4-6 complete sentences, connect to the company context, ranked pillars, industry signals, current-state assumptions, and include one explicit discovery question starting with "Ask:".
- executive: exactly 4 business-facing paragraphs with no AWS jargon. Each paragraph must be 75-110 words, 4-6 complete sentences, name a business risk, outcome, metric, or decision, include ROI or success framing where useful, and include one executive-level question starting with "Ask:".
- stakeholders: exactly 4 role-aware paragraphs of 55-95 words based only on supplied decision-maker context; if context is thin, say what to validate and include a practical stakeholder question starting with "Ask:".
- gameplan: exactly 4 meeting-plan paragraphs of 60-100 words. Each paragraph must explain what the SA should do in that part of the meeting and include one question the SA can ask live.
- objections: exactly 4 paragraphs of 60-100 words in "Concern: ... Response: ... Ask: ..." form. Make each response specific enough to use in front of a customer.
- projectAnswer: answer the requested follow-on role and prompt with one substantial paragraph of 4-6 sentences using the generated brief context so the Project model can auto-build from the same response.
- projectArtifacts: always include exactly 4 two-week plan items, exactly 4 risks, exactly 4 stakeholder map items, and one follow-up email in the same response. Details should be concrete, owner-oriented, and implementation-ready.
- citations: 2-4 short labels only, such as "Customer context", "Decision-maker notes", or "AWS Well-Architected pillars".
- Treat pillarRanking as highest-to-lowest priority; rank 1 is the primary discovery lens and lower ranks should shape secondary tradeoffs.
- Tie technical content to the ranked AWS Well-Architected pillars.
- Include AWS services only when useful for the conversation, and never list services without explaining the customer decision they support.
- Treat unknowns as assumptions to validate; do not present guesses as facts.
- Avoid generic textbook cloud advice; tailor wording to the supplied customer context, industry signals, meeting type, ranked pillars, feedback, decision-maker context, and meeting notes. If a section sounds generic, rewrite it with the customer name, a ranked pillar tradeoff, a stakeholder signal, and a concrete validation question.
- Make the answer feel like a strong SA wrote it for a real upcoming meeting: specific, practical, question-led, and useful without follow-up clarification.
- Do not return short bullets. Every array item should stand alone as a useful mini-brief paragraph.

Request JSON:
{json.dumps(request_context, ensure_ascii=True, indent=2)}
""".strip()


def _invoke_bedrock(prompt):
    client = boto3.client("bedrock-runtime", region_name=REGION)
    converse_args = {
        "modelId": MODEL_ID,
        "system": [{"text": _system_prompt()}],
        "messages": [
            {
                "role": "user",
                "content": [{"text": prompt}],
            }
        ],
        "inferenceConfig": {
            "temperature": 0.2,
            "maxTokens": 5200,
        },
    }

    if GUARDRAIL_ID and GUARDRAIL_VERSION:
        converse_args["guardrailConfig"] = {
            "guardrailIdentifier": GUARDRAIL_ID,
            "guardrailVersion": GUARDRAIL_VERSION,
            "trace": "enabled",
        }

    result = client.converse(**converse_args)
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


def _rank_value(value, fallback):
    try:
        rank = int(value)
    except (TypeError, ValueError):
        rank = fallback

    return rank if rank > 0 else fallback


def _pillar_ranking(payload):
    explicit_ranking = payload.get("pillarRanking")
    ranked = []
    seen = set()

    if isinstance(explicit_ranking, list):
        for index, item in enumerate(explicit_ranking):
            if isinstance(item, dict):
                pillar = _clean_string(item.get("pillar"))
                rank = _rank_value(item.get("rank"), index + 1)
            else:
                pillar = _clean_string(item)
                rank = index + 1

            if pillar and pillar not in seen:
                seen.add(pillar)
                ranked.append({"rank": rank, "pillar": pillar})

    if not ranked:
        pillars = payload.get("pillars") if isinstance(payload.get("pillars"), list) else []
        for index, pillar in enumerate(pillars):
            clean_pillar = _clean_string(pillar)
            if clean_pillar and clean_pillar not in seen:
                seen.add(clean_pillar)
                ranked.append({"rank": index + 1, "pillar": clean_pillar})

    ranked.sort(key=lambda item: item["rank"])
    return [
        {"rank": index + 1, "pillar": item["pillar"]}
        for index, item in enumerate(ranked)
    ]


def _as_string_list(value):
    if isinstance(value, list):
        return [_clean_string(item) for item in value if _clean_string(item)]

    if value:
        return [_clean_string(value)]

    return []


def _first_pillar(payload):
    ranked_pillars = _pillar_ranking(payload)
    return ranked_pillars[0]["pillar"] if ranked_pillars else "the top Well-Architected priority"


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
            {
                "title": "Days 11-14: Package decision evidence",
                "detail": "Create the executive readout, implementation recommendation, open-decision list, and next-phase estimate.",
                "owner": "PM / Sponsor",
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
            {
                "title": "Evidence gap",
                "detail": "The pilot may stall if architecture, control, cost, or success evidence is not captured in a reusable project record.",
                "owner": "SA / PM",
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
            {
                "title": "Project driver",
                "detail": "Confirm who will translate meeting outcomes into owners, timeline, dependency tracking, and decision log updates.",
                "owner": "Customer project lead",
                "status": "Identify",
            },
        ],
        "followUpEmail": {
            "subject": f"Follow-up from PilarPrep briefing for {company}",
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
            stakeholder_lines.append(f"{name}, {title}: connect the meeting opening to {primary_pillar.lower()} and validate what outcome matters most from that seat.{signal} Ask: \"What outcome would make this initiative worth supporting, what risk would stop approval, and who else needs to agree before the team moves forward?\"")

    generic_stakeholder_lines = [
        f"Economic buyer to confirm: identify who owns budget, value, timing, and final prioritization for {company} before the follow-up. Connect the conversation to measurable progress, not platform preference, and validate what would make the initiative fundable. Ask: \"What business metric will prove this was worth doing, and what date or event is creating urgency?\"",
        f"Technical owner to confirm: identify who owns architecture assumptions, dependencies, implementation constraints, rollback expectations, and acceptance criteria for {company}. Use the ranked pillars to keep the technical discussion grounded in customer risk rather than generic architecture. Ask: \"What evidence do you need before approving the target pattern?\"",
        "Security or compliance approver to confirm: identify who owns control evidence, data boundaries, identity policy, data classification, and review checkpoints. Treat security language as a validation path, not a promise, until the customer confirms control owners and audit requirements. Ask: \"Which controls must be proven before launch, and what documentation would make approval easier?\"",
        "Project driver to confirm: identify who will turn meeting outcomes into a decision log, risk register, implementation owners, and the first validation sprint. This role keeps the brief from becoming a one-time artifact after the call. Ask: \"Who will own follow-through, and what format would keep the project team aligned next week?\"",
    ]
    for line in generic_stakeholder_lines:
        if len(stakeholder_lines) >= LIST_ITEM_COUNT:
            break
        stakeholder_lines.append(line)

    return {
        "technical": [
            f"For {company}, validate the current architecture before proposing services: identity model, data boundaries, integration path, failure modes, and operational ownership should all be treated as assumptions until the customer confirms them. Use the first ranked pillar, {primary_pillar}, as the primary discovery lens and connect every technical recommendation to evidence the customer can provide. Ask: \"Which current-state assumption would change the plan the most if it were wrong?\"",
            f"For a {meeting_type.lower()}, turn the conversation into acceptance criteria rather than a feature tour. Confirm RTO/RPO, compliance obligations, latency targets, deployment rollback, observability ownership, and the decision process for moving from discovery to pilot. Translate each answer into a design constraint before naming services. Ask: \"What evidence would your technical, security, and business owners all need before approving the next step?\"",
            "Relevant AWS references include Lambda/API Gateway for controlled orchestration, S3 for artifacts, DynamoDB for project state, CloudWatch for telemetry, and Bedrock for generation, but only after the customer risk is clear. Tie each service to a decision: reduce operational risk, prove control evidence, speed follow-through, or preserve meeting context. Ask: \"Which decision should the architecture make easier for the customer this month?\"",
            f"Use the ranked pillar order to shape the proof plan for {company}: rank 1 gets the deepest evidence review, ranks 2 and 3 become tradeoff checks, and lower-ranked pillars stay visible so they are not ignored. Capture which artifacts are missing, who owns each artifact, and how a pilot would prove the riskiest assumption. Ask: \"What proof would let us move from discussion to a small approved pilot?\"",
        ],
        "executive": [
            f"{company} is preparing for a {meeting_type.lower()} where the business story should stay tied to risk reduction, speed, and measurable progress. Keep the executive version focused on {industry} outcomes instead of service names so the sponsor can make a decision without needing cloud jargon. Ask: \"What business outcome should be visibly better 30 days after this meeting?\"",
            "The strongest value story is that PilarPrep reduces missed assumptions before the meeting and preserves follow-through after the meeting. That means fewer scattered notes, clearer owners, and a faster path from discovery to a bounded pilot with evidence. Ask: \"Where do initiatives like this usually stall: funding, security approval, technical uncertainty, or lack of ownership?\"",
            f"The next executive decision is whether to approve a small validation sprint with clear success measures, named owners, and evidence checkpoints.{model_hint} The sponsor should leave knowing what will be validated, who owns each risk, and what would trigger expansion beyond the pilot. Ask: \"What evidence would make you comfortable saying yes to the next step?\"",
            f"Frame the ROI for {company} as decision speed and rework reduction: better prep should reduce repeated discovery, unclear handoffs, and late risk surprises. The executive sponsor does not need a service tour; they need confidence that the team can move in a controlled way and know when to stop, pivot, or expand. Ask: \"Which delay costs more right now: waiting for perfect information, or moving forward without enough evidence?\"",
        ],
        "stakeholders": stakeholder_lines[:LIST_ITEM_COUNT],
        "gameplan": [
            "Open by confirming the business event driving urgency, then repeat the ranked pillar order back to the customer so the meeting starts with shared priorities. Keep the first five minutes focused on success criteria, decision owner, and what would make the conversation useful. Ask: \"Is this priority order right, or should we move a different risk to the top?\"",
            f"Spend the technical portion on {primary_pillar.lower()}, current-state constraints, dependencies, risks, and evidence the customer needs to proceed. Move from broad context to proof points: architecture artifacts, control evidence, operational metrics, and owner confirmation. Ask: \"What artifact can we review next to validate this before we design around it?\"",
            "Use the final third of the meeting to connect technical findings to business decisions. Separate what is known, what is assumed, what needs a customer artifact, and what would block a pilot if left unresolved. Ask: \"Which unresolved question is most likely to delay approval if we do not answer it this week?\"",
            "Close with confirmed goals, open questions, owners, next meeting, and how the generated Project model handoff should be used. Read the action list back live so sales, SA, and the implementation team do not leave with different interpretations. Ask: \"What should we capture now so the delivery team does not have to rediscover it later?\"",
        ],
        "objections": [
            "Concern: \"We cannot risk disruption.\" Response: propose a bounded pilot with rollback criteria, explicit success measures, and a checkpoint before broader rollout. Ask: \"Which workload, workflow, or decision point is small enough to validate safely but important enough to prove value?\"",
            "Concern: \"This may increase cost.\" Response: start with unit-cost visibility, right-sizing assumptions, and a decision checkpoint tied to business value before scaling the implementation. Ask: \"What cost signal would help you distinguish healthy investment from waste?\"",
            "Concern: \"We do not have enough internal capacity.\" Response: identify the smallest validation path, name only the first two weeks of owners, and keep the project model updated from approved notes. Ask: \"Who can own validation, who can approve risk, and who needs to be informed but not pulled into every detail?\"",
            "Concern: \"The generated brief may be wrong.\" Response: agree, then position the brief as a structured hypothesis map that speeds validation rather than replacing customer discovery. Ask: \"Which assumption should we mark as highest risk until your team confirms it?\"",
        ],
        "projectAnswer": f"Start with a two-week validation sprint for {company}: confirm stakeholders, validate rank 1 {primary_pillar.lower()} assumptions, capture current-state architecture, document risks and owners, and publish a decision log before implementation expands. Use the approved brief, decision-maker notes, and meeting outcomes as the shared project model so sales, SA, engineering, and the sponsor are working from the same context. The first deliverable should be a concise owner-based plan that says what will be validated, what evidence is needed, what risk could block approval, and when the next decision happens. Treat every generated statement as a hypothesis until the customer validates it.",        "projectArtifacts": _fallback_project_artifacts(payload),
        "citations": ["Customer context", "Decision-maker notes", "AWS Well-Architected pillars" if context else "PilarPrep fallback"],
    }


def _is_useful_brief_line(item):
    words = item.replace("/", " ").replace("-", " ").split()
    return len(words) >= 45 and "Ask:" in item


def _is_useful_project_answer(item):
    words = item.replace("/", " ").replace("-", " ").split()
    return len(words) >= 60

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
        "projectAnswer": _clean_string(source.get("projectAnswer")) if _is_useful_project_answer(_clean_string(source.get("projectAnswer"))) else fallback["projectAnswer"],
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


def _xml_text(value):
    return xml_escape(str(value or ""), {'"': '&quot;'})


def _docx_paragraph(text, style=None):
    style_xml = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    safe_text = _xml_text(text)
    return f'<w:p>{style_xml}<w:r><w:t xml:space="preserve">{safe_text}</w:t></w:r></w:p>'


def _docx_bullet(text):
    return _docx_paragraph(f"- {text}")


def _artifact_rows(items):
    rows = []
    if not isinstance(items, list):
        return rows

    for item in items:
        if isinstance(item, dict):
            title = _clean_string(item.get("title")) or "Untitled item"
            detail = _clean_string(item.get("detail"))
            owner = _clean_string(item.get("owner"))
            status = _clean_string(item.get("status"))
            suffix = ""
            if owner or status:
                suffix = f" Owner: {owner or 'TBD'}. Status: {status or 'TBD'}."
            rows.append(f"{title}: {detail}{suffix}".strip())
        else:
            rows.append(_clean_string(item))

    return [row for row in rows if row]


def _brief_docx_bytes(payload, generated, metadata):
    company = _clean_string(payload.get("company")) or "Customer"
    generated_at = _clean_string(generated.get("generatedAt")) or datetime.now(timezone.utc).isoformat()
    sections = [
        _docx_paragraph(f"PilarPrep Brief - {company}", "Title"),
        _docx_paragraph(f"Generated: {generated_at}"),
        _docx_paragraph(f"Client ID: {metadata.get('clientId', metadata.get('projectId', 'customer'))}"),
        _docx_paragraph("Customer Context", "Heading1"),
        _docx_paragraph(f"Industry: {_clean_string(payload.get('industry')) or 'Not provided'}"),
        _docx_paragraph(f"Meeting type: {_clean_string(payload.get('meetingType')) or 'Not provided'}"),
        _docx_paragraph(f"Company size: {_clean_string(payload.get('companySize')) or 'Not provided'}"),
        _docx_paragraph(f"Context: {_clean_string(payload.get('context')) or 'Not provided'}"),
    ]

    ranked_pillars = _pillar_ranking(payload)
    if ranked_pillars:
        sections.append(_docx_paragraph("AWS Pillar Ranking", "Heading1"))
        for ranked in ranked_pillars:
            sections.append(_docx_bullet(f"{ranked.get('rank')}. {ranked.get('pillar')}"))

    for heading, key in (
        ("Technical Brief", "technical"),
        ("Executive Brief", "executive"),
        ("Stakeholder Lens", "stakeholders"),
        ("SA Game Plan", "gameplan"),
        ("Objections And Responses", "objections"),
    ):
        sections.append(_docx_paragraph(heading, "Heading1"))
        for index, item in enumerate(generated.get(key, []), start=1):
            sections.append(_docx_paragraph(f"{index}. {item}"))

    sections.append(_docx_paragraph("Project Model", "Heading1"))
    sections.append(_docx_paragraph(generated.get("projectAnswer", "")))

    artifacts = generated.get("projectArtifacts") if isinstance(generated.get("projectArtifacts"), dict) else {}
    for heading, key in (
        ("Two-Week Plan", "twoWeekPlan"),
        ("Risk Register", "riskRegister"),
        ("Stakeholder Map", "stakeholderMap"),
    ):
        rows = _artifact_rows(artifacts.get(key)) if isinstance(artifacts, dict) else []
        if rows:
            sections.append(_docx_paragraph(heading, "Heading2"))
            for row in rows:
                sections.append(_docx_bullet(row))

    follow_up = artifacts.get("followUpEmail") if isinstance(artifacts, dict) else None
    if isinstance(follow_up, dict):
        sections.append(_docx_paragraph("Follow-Up Email", "Heading2"))
        sections.append(_docx_paragraph(f"Subject: {_clean_string(follow_up.get('subject'))}"))
        sections.append(_docx_paragraph(_clean_string(follow_up.get("body"))))

    citations = generated.get("citations") if isinstance(generated.get("citations"), list) else []
    if citations:
        sections.append(_docx_paragraph("Source Labels", "Heading1"))
        for citation in citations:
            sections.append(_docx_bullet(citation))

    body_xml = "".join(sections)
    document_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>{body_xml}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>'''
    styles_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
</w:styles>'''
    content_types_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''
    rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''
    document_rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'''

    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types_xml)
        docx.writestr("_rels/.rels", rels_xml)
        docx.writestr("word/document.xml", document_xml)
        docx.writestr("word/_rels/document.xml.rels", document_rels_xml)
        docx.writestr("word/styles.xml", styles_xml)

    return output.getvalue()


def _delete_existing_brief_artifacts(s3, bucket, prefix):
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        objects = [{"Key": item["Key"]} for item in page.get("Contents", []) if item.get("Key")]
        if objects:
            s3.delete_objects(Bucket=bucket, Delete={"Objects": objects, "Quiet": True})


def _store_project_artifacts(payload, generated):
    client_id = _project_id(payload)
    metadata = {"projectId": client_id, "clientId": client_id, "artifactRetention": "latest-only"}
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    stored_at = datetime.now(timezone.utc).isoformat()
    brief_prefix = f"clients/{metadata['clientId']}/brief/"
    artifact_key = f"{brief_prefix}latest.json"
    docx_artifact_key = f"{brief_prefix}latest.docx"
    document = {
        "request": payload,
        "response": generated,
        "storedAt": stored_at,
        "briefVersion": timestamp,
    }

    try:
        if ARTIFACT_BUCKET:
            s3 = boto3.client("s3", region_name=REGION)
            _delete_existing_brief_artifacts(s3, ARTIFACT_BUCKET, brief_prefix)
            s3.put_object(
                Bucket=ARTIFACT_BUCKET,
                Key=artifact_key,
                Body=json.dumps(document).encode("utf-8"),
                ContentType="application/json",
            )
            s3.put_object(
                Bucket=ARTIFACT_BUCKET,
                Key=docx_artifact_key,
                Body=_brief_docx_bytes(payload, generated, metadata),
                ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
            metadata["artifactKey"] = artifact_key
            metadata["docxArtifactKey"] = docx_artifact_key
            metadata["docxDownloadUrl"] = s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": ARTIFACT_BUCKET, "Key": docx_artifact_key},
                ExpiresIn=3600,
            )
            metadata["briefVersion"] = timestamp

        if PROJECT_TABLE:
            state_key = "BRIEF#LATEST"
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
                    "updatedAt": {"S": stored_at},
                    "briefVersion": {"S": timestamp},
                    "artifactKey": {"S": artifact_key},
                    "docxArtifactKey": {"S": docx_artifact_key},
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

    if "pillarRanking" in payload and not isinstance(payload.get("pillarRanking"), list):
        _metric("BriefErrors", ErrorType="InvalidPillarRanking")
        return _response(400, {"error": "pillarRanking must be an array"})

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
    if GUARDRAIL_ID:
        metadata["guardrailId"] = GUARDRAIL_ID
    if GUARDRAIL_VERSION:
        metadata["guardrailVersion"] = GUARDRAIL_VERSION
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
