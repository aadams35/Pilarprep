export type BriefMode = "prebrief" | "project";

export type DecisionMakerContext = {
  name: string;
  title: string;
  source?: string;
  context: string;
};

export type BriefRequest = {
  mode?: BriefMode;
  company: string;
  industry: string;
  meetingType: string;
  companySize: string;
  pillars: string[];
  context: string;
  decisionMakers?: DecisionMakerContext[];
  meetingNotes?: string;
  feedback?: string[];
  role?: string;
  prompt?: string;
};

export type BriefResponse = {
  provider: "demo" | "bedrock" | "strands";
  generatedAt: string;
  metadata?: {
    projectId?: string;
    artifactKey?: string;
    stateKey?: string;
    storageWarning?: string;
  };
  technical: string[];
  executive: string[];
  stakeholders: string[];
  gameplan: string[];
  objections: string[];
  projectAnswer: string;
  citations: string[];
};
