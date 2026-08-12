export type BriefMode = "prebrief" | "project";

export type DecisionMakerContext = {
  name: string;
  title: string;
  source?: string;
  context: string;
};

export type PillarRankingItem = {
  rank: number;
  pillar: string;
};

export type ApprovedBriefSnapshot = {
  technical: string[];
  executive: string[];
  stakeholders: string[];
  gameplan: string[];
  objections: string[];
  citations?: string[];
};

export type BriefRequest = {
  mode?: BriefMode;
  company: string;
  industry: string;
  meetingType: string;
  companySize: string;
  pillars: string[];
  pillarRanking?: PillarRankingItem[];
  context: string;
  companyValues?: string;
  decisionMakers?: DecisionMakerContext[];
  meetingNotes?: string;
  feedback?: string[];
  role?: string;
  prompt?: string;
  approvedBrief?: ApprovedBriefSnapshot;
};

export type ProjectArtifactItem = {
  title: string;
  detail: string;
  owner?: string;
  status?: string;
};

export type FollowUpEmailArtifact = {
  subject: string;
  body: string;
};

export type ProjectArtifacts = {
  twoWeekPlan: ProjectArtifactItem[];
  riskRegister: ProjectArtifactItem[];
  stakeholderMap: ProjectArtifactItem[];
  followUpEmail: FollowUpEmailArtifact;
};

export type BriefResponse = {
  provider: "demo" | "bedrock" | "strands";
  generatedAt: string;
  metadata?: {
    projectId?: string;
    clientId?: string;
    artifactKey?: string;
    docxArtifactKey?: string;
    docxDownloadUrl?: string;
    artifactRetention?: string;
    stateKey?: string;
    storageWarning?: string;
    guardrailId?: string;
    guardrailVersion?: string;
    modelId?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
  };
  technical: string[];
  executive: string[];
  stakeholders: string[];
  gameplan: string[];
  objections: string[];
  projectAnswer: string;
  projectArtifacts?: ProjectArtifacts;
  citations: string[];
};

