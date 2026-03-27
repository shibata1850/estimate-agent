/* ─── 入力 ─── */
export interface EstimateInput {
  region: string;
  industry: string;
  companyName: string;
  requirements: string;
  budget?: string;
  timeline?: string;
  pmAnswers?: Record<string, string>;  // PM質問への回答
  hiddenCostSelections?: string[];      // 選択された隠れコスト
}

/* ─── PM逆質問 ─── */
export interface PMQuestion {
  id: string;
  category: "scope" | "quality" | "timeline" | "integration" | "operations" | "security" | "budget";
  question: string;
  why: string;           // なぜこの質問が重要か
  impact: string;        // 回答が見積にどう影響するか
  placeholder: string;
  options?: string[];    // 選択肢（あれば）
}

/* ─── 隠れコスト ─── */
export interface HiddenCost {
  id: string;
  category: string;
  name: string;
  description: string;
  estimatedRange: string;   // "50,000〜200,000円"
  likelihood: "high" | "medium" | "low";
  forgottenRate: string;    // "見落とし率80%"
}

/* ─── タスク分解 ─── */
export interface TaskBreakdown {
  phase: string;           // 設計, 実装, テスト, デプロイ
  tasks: {
    name: string;
    description: string;
    hours: number;
    unitPrice: number;     // 時間単価
    amount: number;
    assignee: string;      // PM, SE, PG等
  }[];
  subtotal: number;
  totalHours: number;
}

/* ─── 類似案件 ─── */
export interface SimilarCase {
  projectName: string;
  industry: string;
  region: string;
  scale: string;
  totalCost: number;
  duration: string;
  keyFeatures: string[];
  lessonsLearned: string;
  relevance: string;       // この案件との類似点
}

/* ─── リスク ─── */
export interface RiskItem {
  id: string;
  category: "technical" | "external" | "security" | "team";
  name: string;
  description: string;
  probability: number;
  impactHours: number;
  bufferHours: number;
  bufferCost: number;
  mitigation: string;
}

export interface RiskRegister {
  risks: RiskItem[];
  totalBufferHours: number;
  totalBufferCost: number;
  hourlyRate: number;
}

/* ─── 前提条件 ─── */
export interface PreconditionCard {
  scope: string[];
  outOfScope: string[];
  deliverables: { name: string; description: string; completionCriteria: string }[];
  acceptanceCriteria: {
    testApproach: string;
    uatRequired: boolean;
    uatDetails: string;
    environmentConditions: string[];
  };
  changeManagement: {
    policy: string;
    additionalCostRule: string;
    approvalProcess: string;
  };
  clientResponsibilities: { task: string; deadline: string; impact: string }[];
}

/* ─── 運用設計 ─── */
export interface OperationsDesign {
  monitoring: { targets: string[]; alertChannels: string[]; responseHours: string; responsible: string };
  incidentSLA: { businessHours: string; afterHours: string; firstResponseMinutes: number; resolutionTargetHours: number; escalationFlow: string[] };
  backupDR: { backupFrequency: string; retentionPeriod: string; rtoHours: number; rpoHours: number; drStrategy: string };
  accessManagement: { policies: string[]; offboardingProcess: string; reviewCycle: string };
  maintenance: { tasks: { name: string; frequency: string; responsible: string }[]; monthlyEstimate: number };
}

/* ─── 3プラン（品質/バランス/納期） ─── */
export interface EstimateLineItem {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

export interface EstimatePlan {
  tier: "quality" | "balance" | "speed";
  tierLabel: string;
  priority: string;          // "品質優先" / "バランス" / "納期優先"
  summary: string;
  pros: string[];
  cons: string[];
  features: string[];
  excludedFeatures: string[];
  items: EstimateLineItem[];
  taskBreakdown: TaskBreakdown[];
  subtotal: number;
  riskBuffer: number;
  taxRate: number;
  tax: number;
  total: number;
  deliveryDate: string;
  estimatedDays: number;
  monthlyOperationCost: number;
}

/* ─── サブエージェント（顧客目線レビュー） ─── */
export interface SubAgentReview {
  overallScore: number;      // 1-10
  customerConcerns: {
    area: string;
    concern: string;
    severity: "high" | "medium" | "low";
    suggestion: string;
  }[];
  priceJustification: {
    isReasonable: boolean;
    reasoning: string;
    marketComparison: string;
  };
  missingItems: string[];
  negotiationPoints: string[];
  finalVerdict: string;
}

/* ─── 統合見積データ ─── */
export interface EstimateData {
  title: string;
  summary: string;
  plans: EstimatePlan[];
  similarCases: SimilarCase[];
  preconditions: PreconditionCard;
  riskRegister: RiskRegister;
  operationsDesign: OperationsDesign;
  subAgentReview: SubAgentReview;
  validUntil: string;
  paymentTerms: string;
  notes: string;
}

/* ─── 分析ステップ ─── */
export type AnalysisStep =
  | "region" | "industry" | "company"
  | "similar_cases" | "preconditions" | "risks"
  | "operations" | "estimate" | "sub_agent_review";

/* ─── チャット ─── */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
/* ─── Misoca ─── */
export interface MisocaEstimate {
  subject: string;
  issue_date: string;
  recipient_name: string;
  items: {
    name: string;
    quantity: number;
    unit_price: number;
    unit: string;
    description?: string;
  }[];
}
