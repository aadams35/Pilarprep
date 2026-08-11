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

export type BriefRequest = {
  mode?: BriefMode;
  company: string;
  industry: string;
  meetingType: string;
  companySize: string;
  pillars: string[];
  pillarRanking?: PillarRankingItem[];
  context: string;
  decisionMakers?: DecisionMakerContext[];
  meetingNotes?: string;
  feedback?: string[];
  role?: string;
  prompt?: string;
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
    artifactKey?: string;
    stateKey?: string;
    storageWarning?: string;
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
