import { GoogleGenerativeAI } from "@google/generative-ai";
import type { EstimateInput, AnalysisStep } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL = "gemini-2.0-flash";

/* ═══════════════════════════════════════
   PM逆質問の生成
   ═══════════════════════════════════════ */
export async function generatePMQuestions(input: EstimateInput): Promise<string> {
  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent(`あなたは20年以上の経験を持つITプロジェクトマネージャーです。
見積精度を劇的に上げるために、顧客への「逆質問」を生成してください。
これらの質問は、見積金額を大きく左右するクリティカルな項目です。

【企業名】${input.companyName}
【地域】${input.region}
【業種】${input.industry}
【要望】${input.requirements}
${input.budget ? `【予算感】${input.budget}` : ""}
${input.timeline ? `【希望納期】${input.timeline}` : ""}

以下のカテゴリから必ず1つ以上の質問を含めてください:
- scope: 対象範囲（「保守運用はどうするか」「どこまでが今回のスコープか」）
- quality: 品質（「納期が優先か品質が優先か」「テスト範囲は」）
- integration: 連携（「既存システムとの連携は？」「データ移行は必要か」）
- operations: 運用（「誰が運用するか」「障害時の対応レベルは」）
- security: セキュリティ（「個人情報を扱うか」「セキュリティ要件は」）
- budget: 予算（「初期費用と月額のバランスは」「補助金の活用意向は」）

JSONのみを出力してください:
[
  {
    "id": "q1",
    "category": "scope",
    "question": "質問文",
    "why": "なぜこの質問が重要か（顧客に表示）",
    "impact": "回答が見積にどう影響するか",
    "placeholder": "回答例",
    "options": ["選択肢1", "選択肢2"]
  }
]

6〜8個の質問を生成してください。`);

  const text = result.response.text().replace(/```json\n?|```/g, "").trim();
  const m = text.match(/\[[\s\S]*\]/);
  return m ? m[0] : text;
}

/* ═══════════════════════════════════════
   隠れコスト分析
   ═══════════════════════════════════════ */
export async function analyzeHiddenCosts(input: EstimateInput): Promise<string> {
  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent(`あなたはITプロジェクトのコスト分析専門家です。
人間が見積時に忘れがちな「隠れコスト」を洗い出してください。

【企業名】${input.companyName}
【業種】${input.industry}
【要望】${input.requirements}
${input.budget ? `【予算感】${input.budget}` : ""}

以下のカテゴリを網羅的にチェック:
- インフラ（サーバー、CDN、ドメイン、SSL証明書、メール配信）
- ライセンス（商用フォント、有料API、SaaS月額、開発ツール）
- セキュリティ（脆弱性診断、WAF、DDoS対策、ログ監視）
- 法務（利用規約作成、プライバシーポリシー、NDA）
- 教育（マニュアル作成、操作研修、管理者トレーニング）
- データ（移行作業、クレンジング、バックアップ体制）
- テスト（負荷テスト、セキュリティテスト、UAT支援）
- その他（プロジェクト管理費、コミュニケーションコスト）

JSONのみを出力:
[
  {
    "id": "hc1",
    "category": "インフラ",
    "name": "コスト名",
    "description": "説明",
    "estimatedRange": "50,000〜200,000円",
    "likelihood": "high",
    "forgottenRate": "見落とし率80%"
  }
]

10〜15項目を出力してください。`);

  const text = result.response.text().replace(/```json\n?|```/g, "").trim();
  const m = text.match(/\[[\s\S]*\]/);
  return m ? m[0] : text;
}

/* ═══════════════════════════════════════
   汎用チャット（常時利用可能）
   ═══════════════════════════════════════ */
export async function chat(question: string, context: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent(`あなたはITコンサルタント兼プロジェクトマネージャーです。
顧客からの質問に、プロフェッショナルとして回答してください。

${context ? `─── 参照データ ───\n${context}\n───────────────` : "（まだ見積データはありません。一般的な知識で回答してください）"}

顧客の質問: ${question}

回答ルール:
- 見積データがある場合は、該当する内訳・前提条件・リスクを引用して根拠付きで回答
- 「この項目は何？」→ 内訳の該当行と作業内容を具体的に説明
- 「削れる？」→ 削った場合の影響（品質/納期/運用）を具体的に提示
- 「相場は？」→ 類似案件データや業界相場を提示
- 「なぜこの金額？」→ タスク分解と時間単価の根拠を提示
- 金額変更の提案には必ずトレードオフを明示
- 見積データがない段階でも、IT/DXに関する一般的な質問には回答`);

  return result.response.text();
}

/* ═══════════════════════════════════════
   メイン分析フロー（9ステップ）
   ═══════════════════════════════════════ */
export type OnEvent = (
  type: "step_start" | "step_content" | "step_complete" | "estimate_data" | "complete" | "error",
  step: AnalysisStep | null,
  data: string
) => void;

export async function runAnalysis(input: EstimateInput, onEvent: OnEvent): Promise<void> {
  let regionResult = "";
  let industryResult = "";
  let companyResult = "";
  let similarCasesResult = "";
  let preconditionsResult = "";
  let risksResult = "";
  let operationsResult = "";
  let estimateResult = "";
  let reviewResult = "";

  // Step 1: 地域分析
  onEvent("step_start", "region", "地域分析を開始...");
  regionResult = await streamStep("region", regionPrompt(input), onEvent);
  onEvent("step_complete", "region", regionResult);

  // Step 2: 業種分析
  onEvent("step_start", "industry", "業種分析を開始...");
  industryResult = await streamStep("industry", industryPrompt(input, regionResult), onEvent);
  onEvent("step_complete", "industry", industryResult);

  // Step 3: 企業分析
  onEvent("step_start", "company", "企業分析・ソリューション提案...");
  companyResult = await streamStep("company", companyPrompt(input, regionResult, industryResult), onEvent);
  onEvent("step_complete", "company", companyResult);

  // Step 4: 類似案件検索
  onEvent("step_start", "similar_cases", "類似案件を検索中...");
  similarCasesResult = await genJSON("similar_cases", similarCasesPrompt(input, companyResult), onEvent);
  onEvent("step_complete", "similar_cases", similarCasesResult);

  // Step 5: 前提条件
  onEvent("step_start", "preconditions", "前提条件を作成中...");
  preconditionsResult = await genJSON("preconditions", preconditionsPrompt(input, companyResult), onEvent);
  onEvent("step_complete", "preconditions", preconditionsResult);

  // Step 6: リスク分析
  onEvent("step_start", "risks", "リスク分析中...");
  risksResult = await genJSON("risks", risksPrompt(input, companyResult), onEvent);
  onEvent("step_complete", "risks", risksResult);

  // Step 7: 運用設計
  onEvent("step_start", "operations", "運用設計を作成中...");
  operationsResult = await genJSON("operations", operationsPrompt(input, companyResult), onEvent);
  onEvent("step_complete", "operations", operationsResult);

  // Step 8: 見積生成（3プラン + タスク分解）
  onEvent("step_start", "estimate", "3プラン見積を生成中...");
  estimateResult = await genJSON("estimate",
    estimatePrompt(input, regionResult, industryResult, companyResult,
      similarCasesResult, preconditionsResult, risksResult, operationsResult),
    onEvent);
  onEvent("step_complete", "estimate", estimateResult);

  // Step 9: サブエージェント（顧客目線レビュー）
  onEvent("step_start", "sub_agent_review", "顧客目線でレビュー中...");
  reviewResult = await genJSON("sub_agent_review",
    subAgentPrompt(input, estimateResult, risksResult, preconditionsResult),
    onEvent);
  onEvent("step_complete", "sub_agent_review", reviewResult);

  // 統合
  let similarCases, preconditions, riskRegister, operationsDesign, estimateBase, subAgentReview;
  try { similarCases = JSON.parse(similarCasesResult); } catch { similarCases = []; }
  try { preconditions = JSON.parse(preconditionsResult); } catch { preconditions = {}; }
  try { riskRegister = JSON.parse(risksResult); } catch { riskRegister = { risks: [], totalBufferHours: 0, totalBufferCost: 0, hourlyRate: 15000 }; }
  try { operationsDesign = JSON.parse(operationsResult); } catch { operationsDesign = {}; }
  try { estimateBase = JSON.parse(estimateResult); } catch { estimateBase = { title: "", summary: "", plans: [] }; }
  try { subAgentReview = JSON.parse(reviewResult); } catch { subAgentReview = { overallScore: 0, customerConcerns: [], priceJustification: {}, missingItems: [], negotiationPoints: [], finalVerdict: "" }; }

  const fullEstimate = {
    ...estimateBase,
    similarCases: Array.isArray(similarCases) ? similarCases : [],
    preconditions,
    riskRegister,
    operationsDesign,
    subAgentReview,
  };

  onEvent("estimate_data", "estimate", JSON.stringify(fullEstimate));
  onEvent("complete", null, "全ての分析が完了しました");
}

/* ─── ストリーミング ─── */
async function streamStep(step: AnalysisStep, prompt: string, onEvent: OnEvent): Promise<string> {
  let full = "";
  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) { full += text; onEvent("step_content", step, text); }
  }
  return full;
}

/* ─── JSON生成 ─── */
async function genJSON(step: AnalysisStep, prompt: string, onEvent: OnEvent): Promise<string> {
  onEvent("step_content", step, "データを構造化しています...\n");
  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json\n?|```/g, "").trim();
  const m = text.match(/[\[{][\s\S]*[\]}]/);
  onEvent("step_content", step, "完了\n");
  return m ? m[0] : text;
}

/* ═══════════════════════════════════════
   プロンプト群
   ═══════════════════════════════════════ */
function regionPrompt(input: EstimateInput): string {
  return `あなたは日本の地域経済に詳しいビジネスコンサルタントです。
【地域】${input.region}【業種】${input.industry}
分析項目: 経済環境、人口動態、デジタル化状況、活用可能な補助金、競合環境。800字程度で。`;
}

function industryPrompt(input: EstimateInput, regionAnalysis: string): string {
  return `あなたは業種特化型のITコンサルタントです。
【地域】${input.region}【業種】${input.industry}【企業名】${input.companyName}
─── 地域分析 ───
${regionAnalysis}
分析: DX動向、地域×業種の特性、よくある課題、導入効果の相場、推奨方向性。800字で。`;
}

function companyPrompt(input: EstimateInput, regionAnalysis: string, industryAnalysis: string): string {
  const pmAnswers = input.pmAnswers ? `\n【PM質問への回答】\n${Object.entries(input.pmAnswers).map(([k,v]) => `${k}: ${v}`).join("\n")}` : "";
  const hiddenCosts = input.hiddenCostSelections?.length ? `\n【確認済み隠れコスト】${input.hiddenCostSelections.join(", ")}` : "";
  return `あなたは企業のIT戦略アドバイザーです。
【企業名】${input.companyName}【地域】${input.region}【業種】${input.industry}
【要望】${input.requirements}
${input.budget ? `【予算感】${input.budget}` : ""}${input.timeline ? `【希望納期】${input.timeline}` : ""}${pmAnswers}${hiddenCosts}
─── 地域分析 ───
${regionAnalysis}
─── 業種分析 ───
${industryAnalysis}
提案: ニーズ解釈、推奨ソリューション3〜5案、導入ステップ、期待効果、リスクと対策。1000字で。`;
}

function similarCasesPrompt(input: EstimateInput, companyAnalysis: string): string {
  return `あなたはIT業界の案件データベースに精通したアナリストです。
以下の案件に類似する過去の事例を3〜5件生成してください。
実在の案件名は使わず、あくまで「このような案件では一般的にこの程度のコスト」という市場データとして提示してください。

【企業名】${input.companyName}【業種】${input.industry}【地域】${input.region}
【要望】${input.requirements}
${input.budget ? `【予算感】${input.budget}` : ""}

─── 企業分析 ───
${companyAnalysis}

JSONのみ出力:
[
  {
    "projectName": "○○業向け受発注管理システム構築",
    "industry": "製造業",
    "region": "東北地方",
    "scale": "従業員50名規模",
    "totalCost": 4500000,
    "duration": "4ヶ月",
    "keyFeatures": ["受発注管理", "在庫連携", "帳票出力"],
    "lessonsLearned": "データ移行に想定の1.5倍の工数がかかった",
    "relevance": "業種・規模・要件が類似"
  }
]`;
}

function preconditionsPrompt(input: EstimateInput, companyAnalysis: string): string {
  return `あなたはITプロジェクトの契約管理専門家です。
【企業名】${input.companyName}【要望】${input.requirements}
─── 企業分析 ───
${companyAnalysis}
JSONのみ出力:
{
  "scope": ["対象範囲1", "対象範囲2"],
  "outOfScope": ["対象外1"],
  "deliverables": [{"name": "成果物名", "description": "説明", "completionCriteria": "完了条件"}],
  "acceptanceCriteria": {"testApproach": "テスト方針", "uatRequired": true, "uatDetails": "UAT詳細", "environmentConditions": ["条件1"]},
  "changeManagement": {"policy": "方針", "additionalCostRule": "追加費用ルール", "approvalProcess": "承認プロセス"},
  "clientResponsibilities": [{"task": "タスク", "deadline": "期限", "impact": "影響"}]
}`;
}

function risksPrompt(input: EstimateInput, companyAnalysis: string): string {
  return `あなたはリスクマネジメント専門家です。時間単価15,000円。
【企業名】${input.companyName}【要望】${input.requirements}
─── 企業分析 ───
${companyAnalysis}
カテゴリ: technical, external, security, team
bufferHours = probability × impactHours, bufferCost = bufferHours × 15000
JSONのみ出力:
{
  "risks": [{"id": "R1", "category": "technical", "name": "名前", "description": "説明", "probability": 0.6, "impactHours": 40, "bufferHours": 24, "bufferCost": 360000, "mitigation": "対策"}],
  "totalBufferHours": 合計, "totalBufferCost": 合計, "hourlyRate": 15000
}
8〜12個のリスクを出力。`;
}

function operationsPrompt(input: EstimateInput, companyAnalysis: string): string {
  return `あなたは運用設計の専門家です。
【企業名】${input.companyName}【要望】${input.requirements}
─── 企業分析 ───
${companyAnalysis}
JSONのみ出力:
{
  "monitoring": {"targets": ["対象1"], "alertChannels": ["通知先1"], "responseHours": "時間帯", "responsible": "担当"},
  "incidentSLA": {"businessHours": "SLA", "afterHours": "SLA", "firstResponseMinutes": 30, "resolutionTargetHours": 4, "escalationFlow": ["一次→二次"]},
  "backupDR": {"backupFrequency": "頻度", "retentionPeriod": "期間", "rtoHours": 4, "rpoHours": 1, "drStrategy": "戦略"},
  "accessManagement": {"policies": ["ポリシー1"], "offboardingProcess": "退職時プロセス", "reviewCycle": "周期"},
  "maintenance": {"tasks": [{"name": "タスク", "frequency": "頻度", "responsible": "担当"}], "monthlyEstimate": 月額}
}`;
}

function estimatePrompt(
  input: EstimateInput, region: string, industry: string, company: string,
  similarCases: string, preconditions: string, risks: string, operations: string
): string {
  const pmAnswers = input.pmAnswers ? `\n【PM質問回答】\n${Object.entries(input.pmAnswers).map(([k,v]) => `${k}: ${v}`).join("\n")}` : "";
  return `あなたはIT企業の見積作成の専門家です。
全分析結果を踏まえ、3つの角度から見積を作成してください。

★重要: 各プランは「品質優先」「バランス」「納期優先」の3角度です。
★重要: 各プランに「タスク分解」を含めてください（設計・実装・テスト・デプロイ）
★重要: 類似案件の金額を参考に、現実的な金額設定をしてください。

【企業名】${input.companyName}【地域】${input.region}【業種】${input.industry}
【要望】${input.requirements}
${input.budget ? `【予算感】${input.budget}` : ""}${input.timeline ? `【希望納期】${input.timeline}` : ""}${pmAnswers}

─── 地域分析 ───
${region}
─── 業種分析 ───
${industry}
─── 企業分析 ───
${company}
─── 類似案件 ───
${similarCases}
─── 前提条件 ───
${preconditions}
─── リスク ───
${risks}
─── 運用設計 ───
${operations}

JSONのみ出力:
{
  "title": "見積件名",
  "summary": "概要",
  "plans": [
    {
      "tier": "quality",
      "tierLabel": "品質優先プラン",
      "priority": "品質優先",
      "summary": "テスト・セキュリティ・ドキュメントを充実",
      "pros": ["利点1", "利点2"],
      "cons": ["欠点1"],
      "features": ["機能1"],
      "excludedFeatures": [],
      "items": [{"name": "項目", "description": "説明", "quantity": 1, "unit": "式", "unitPrice": 100000, "amount": 100000}],
      "taskBreakdown": [
        {
          "phase": "要件定義・設計",
          "tasks": [{"name": "タスク名", "description": "説明", "hours": 40, "unitPrice": 15000, "amount": 600000, "assignee": "PM/SE"}],
          "subtotal": 600000,
          "totalHours": 40
        },
        {"phase": "実装", "tasks": [...], "subtotal": 数値, "totalHours": 数値},
        {"phase": "テスト", "tasks": [...], "subtotal": 数値, "totalHours": 数値},
        {"phase": "デプロイ・導入支援", "tasks": [...], "subtotal": 数値, "totalHours": 数値}
      ],
      "subtotal": 小計, "riskBuffer": リスクバッファ金額,
      "taxRate": 0.1, "tax": 消費税, "total": 合計,
      "deliveryDate": "YYYY-MM-DD", "estimatedDays": 日数,
      "monthlyOperationCost": 月額運用費
    },
    { "tier": "balance", ... },
    { "tier": "speed", ... }
  ],
  "validUntil": "YYYY-MM-DD",
  "paymentTerms": "支払条件",
  "notes": "備考"
}`;
}

function subAgentPrompt(input: EstimateInput, estimate: string, risks: string, preconditions: string): string {
  return `あなたは${input.companyName}の経営者の立場に立つ「顧客代理エージェント」です。
提示された見積書を、顧客の目線で厳しくレビューしてください。

あなたの役割:
- 過大請求がないかチェック
- 不要な項目がないか指摘
- 相場と比較して妥当か評価
- 顧客が交渉すべきポイントを提示
- 見落としている項目がないか確認

【企業名】${input.companyName}【業種】${input.industry}
【要望】${input.requirements}
${input.budget ? `【予算感】${input.budget}` : ""}

─── 見積データ ───
${estimate}
─── リスク ───
${risks}
─── 前提条件 ───
${preconditions}

JSONのみ出力:
{
  "overallScore": 8,
  "customerConcerns": [
    {
      "area": "該当領域",
      "concern": "懸念事項",
      "severity": "high",
      "suggestion": "改善提案"
    }
  ],
  "priceJustification": {
    "isReasonable": true,
    "reasoning": "妥当性の根拠",
    "marketComparison": "市場相場との比較"
  },
  "missingItems": ["見落とし項目1"],
  "negotiationPoints": ["交渉ポイント1"],
  "finalVerdict": "総合評価コメント（顧客目線で率直に）"
}`;
}
