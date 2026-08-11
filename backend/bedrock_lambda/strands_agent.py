import os

from strands import Agent
from strands.models import BedrockModel

from project_tools import (
    build_follow_up_email,
    build_project_record,
    build_risk_register,
    build_stakeholder_map,
    build_two_week_plan,
)


def build_project_brain_agent():
    model = BedrockModel(
        model_id=os.getenv("BEDROCK_MODEL_ID", "us.amazon.nova-pro-v1:0"),
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        temperature=0.2,
        max_tokens=1600,
    )

    return Agent(
        model=model,
        tools=[
            build_project_record,
            build_two_week_plan,
            build_risk_register,
            build_stakeholder_map,
            build_follow_up_email,
        ],
        system_prompt=(
            "You are the Project model for PilarPrep. Use the approved brief, "
            "decision-maker context, meeting notes, risks, decisions, and "
            "owners to answer role-aware follow-on questions for sales, "
            "executives, PMs, engineers, and new project members. Be concise, "
            "practical, and action-oriented."
        ),
    )


def answer_project_question(project_context, role, question):
    agent = build_project_brain_agent()
    return agent(
        f"""
Project context:
{project_context}

Audience role: {role}
Question: {question}
"""
    )
