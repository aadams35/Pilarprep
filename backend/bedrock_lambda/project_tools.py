from datetime import datetime, timezone


def _first(items, fallback):
    return items[0] if items else fallback


def build_project_record(payload, generated):
    company = payload.get("company", "Customer")
    pillars = payload.get("pillars", [])
    now = datetime.now(timezone.utc).isoformat()

    return {
        "projectName": f"{company} briefing follow-through",
        "company": company,
        "industry": payload.get("industry", ""),
        "meetingType": payload.get("meetingType", ""),
        "primaryPillar": _first(pillars, "Security"),
        "status": "brief-generated",
        "createdAt": now,
        "updatedAt": now,
        "summary": _first(generated.get("executive", []), ""),
        "stakeholders": build_stakeholder_map(payload, generated),
        "openQuestions": generated.get("gameplan", []),
        "risks": build_risk_register(payload, generated),
    }


def build_two_week_plan(payload, generated):
    company = payload.get("company", "the customer")
    primary_pillar = _first(payload.get("pillars", []), "Security")

    return [
        {
            "dayRange": "Days 1-2",
            "owner": "SA / Sales",
            "task": f"Confirm stakeholders, meeting goal, and success criteria for {company}.",
        },
        {
            "dayRange": "Days 3-5",
            "owner": "SA / Engineer",
            "task": f"Validate current-state assumptions and top {primary_pillar.lower()} risks.",
        },
        {
            "dayRange": "Days 6-8",
            "owner": "Engineer",
            "task": "Map AWS services, integration boundaries, data flow, and observability needs.",
        },
        {
            "dayRange": "Days 9-10",
            "owner": "PM / Sponsor",
            "task": "Publish decision log, risk register, next workshop agenda, and owner list.",
        },
    ]


def build_risk_register(payload, generated):
    company = payload.get("company", "the customer")
    primary_pillar = _first(payload.get("pillars", []), "Security")

    return [
        {
            "risk": "Unvalidated assumptions",
            "impact": f"The team may overfit recommendations before {company}'s current state is confirmed.",
            "mitigation": "Track every generated claim as an assumption until confirmed in discovery.",
        },
        {
            "risk": f"{primary_pillar} ownership gap",
            "impact": "The project may stall if technical risk lacks a named customer owner.",
            "mitigation": "Assign owners during the closeout and include them in the project record.",
        },
        {
            "risk": "Executive and technical narratives diverge",
            "impact": "Sponsors may not see how architecture work maps to business outcomes.",
            "mitigation": "Keep the executive brief low-jargon and tie technical items to success metrics.",
        },
    ]


def build_stakeholder_map(payload, generated):
    decision_makers = payload.get("decisionMakers", [])
    generated_lens = generated.get("stakeholders", [])

    if not isinstance(decision_makers, list):
        decision_makers = []

    if not isinstance(generated_lens, list):
        generated_lens = []

    if not decision_makers:
        return [
            {
                "name": "Stakeholder to confirm",
                "title": "Economic buyer / technical owner / security approver",
                "signal": _first(
                    generated_lens,
                    "Capture approved decision-maker notes during or after the meeting.",
                ),
                "nextQuestion": "Who owns approval, technical validation, security review, and budget?",
            }
        ]

    return [
        {
            "name": person.get("name", "Decision maker")
            if isinstance(person, dict)
            else "Decision maker",
            "title": person.get("title", "") if isinstance(person, dict) else "",
            "source": person.get("source", "User-provided context")
            if isinstance(person, dict)
            else "User-provided context",
            "signal": person.get("context", _first(generated_lens, ""))
            if isinstance(person, dict)
            else str(person),
            "nextQuestion": "What outcome, risk, or blocker matters most from your seat?",
        }
        for person in decision_makers
    ]


def build_follow_up_email(payload, generated):
    company = payload.get("company", "your team")
    executive_summary = _first(generated.get("executive", []), "")
    stakeholder_lens = _first(generated.get("stakeholders", []), "")
    next_step = _first(generated.get("gameplan", []), "confirm next steps")

    return {
        "subject": f"Follow-up from PilarPrep briefing for {company}",
        "body": (
            f"Thanks for the conversation. The main theme we captured was: {executive_summary}\n\n"
            f"Stakeholder context we will validate: {stakeholder_lens}\n\n"
            f"Recommended next step: {next_step}\n\n"
            "We will use the approved brief, decision-maker notes, meeting notes, risks, and owner list as the shared project context."
        ),
    }
