export type BriefMode = "prebrief" | "project";

export type BriefRequest = {
  mode?: BriefMode;
  company: string;
  industry: string;
  meetingType: string;
  companySize: string;
  pillars: string[];
  context: string;
  meetingNotes?: string;
  feedback?: string[];
  role?: string;
  prompt?: string;
};

export type BriefResponse = {
  provider: "demo" | "bedrock" | "strands";
  generatedAt: string;
  technical: string[];
  executive: string[];
  gameplan: string[];
  objections: string[];
  projectAnswer: string;
  citations: string[];
};
