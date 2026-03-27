"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import type {
  EstimateInput, EstimateData, AnalysisStep, PMQuestion, HiddenCost,
  RiskItem, EstimatePlan, TaskBreakdown, SimilarCase, ChatMessage, SubAgentReview
} from "@/types";

/* ─── 定数 ─── */
const STEPS: { key: AnalysisStep; label: string; icon: string }[] = [
  { key: "region", label: "地域分析", icon: "🗺️" },
  { key: "industry", label: "業種分析", icon: "🏭" },
  { key: "company", label: "企業分析", icon: "🏢" },
  { key: "similar_cases", label: "類似案件検索", icon: "🔍" },
  { key: "preconditions", label: "前提条件", icon: "📋" },
  { key: "risks", label: "リスク分析", icon: "⚠️" },
  { key: "operations", label: "運用設計", icon: "🔧" },
  { key: "estimate", label: "3プラン見積", icon: "💰" },
  { key: "sub_agent_review", label: "顧客目線レビュー", icon: "🔎" },
];

const CAT_COLORS: Record<string, string> = {
  technical: "bg-blue-100 text-blue-800", external: "bg-yellow-100 text-yellow-800",
  security: "bg-red-100 text-red-800", team: "bg-purple-100 text-purple-800",
};
const CAT_LABELS: Record<string, string> = {
  technical: "技術", external: "外部依存", security: "セキュリティ", team: "体制",
};

type Phase = "input" | "pm_questions" | "hidden_costs" | "analyzing" | "result";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("input");
  const [input, setInput] = useState<EstimateInput>({
    region: "", industry: "", companyName: "", requirements: "", budget: "", timeline: "",
  });

  // PM質問
  const [pmQuestions, setPmQuestions] = useState<PMQuestion[]>([]);
  const [pmAnswers, setPmAnswers] = useState<Record<string, string>>({});
  const [pmLoading, setPmLoading] = useState(false);

  // 隠れコスト
  const [hiddenCosts, setHiddenCosts] = useState<HiddenCost[]>([]);
  const [selectedHiddenCosts, setSelectedHiddenCosts] = useState<Set<string>>(new Set());
  const [hcLoading, setHcLoading] = useState(false);

  // 分析
  const [currentStep, setCurrentStep] = useState<AnalysisStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<AnalysisStep>>(new Set());
  const [stepContents, setStepContents] = useState<Record<string, string>>({});
  const [estimate, setEstimate] = useState<EstimateData | null>(null);

  // 結果タブ
  const [activeTab, setActiveTab] = useState<string>("plans");
  const [selectedPlan, setSelectedPlan] = useState(1);

  // チャット（常時利用可能）
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Misoca連携
  const [misocaCreating, setMisocaCreating] = useState(false);
  const [misocaResult, setMisocaResult] = useState<{ id: string; url: string } | null>(null);
  const [misocaError, setMisocaError] = useState("");

  // 分析コンテキスト
  const ctx = useRef({ regionAnalysis: "", industryAnalysis: "", companyAnalysis: "" });

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const fmt = (n: number) => n?.toLocaleString("ja-JP") ?? "0";

  /* ─── Phase 1: PM質問を取得 ─── */
  const startPMQuestions = useCallback(async () => {
    if (!input.region || !input.industry || !input.companyName || !input.requirements) {
      alert("地域・業種・企業名・要望は全て入力してください"); return;
    }
    setPmLoading(true);
    setPhase("pm_questions");
    try {
      const res = await fetch("/api/pm-questions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      setPmQuestions(data.questions || []);
      const initial: Record<string, string> = {};
      (data.questions || []).forEach((q: PMQuestion) => { initial[q.id] = ""; });
      setPmAnswers(initial);
    } catch { alert("PM質問の生成に失敗しました"); setPhase("input"); }
    finally { setPmLoading(false); }
  }, [input]);

  /* ─── Phase 2: 隠れコスト取得 ─── */
  const startHiddenCosts = useCallback(async () => {
    setHcLoading(true);
    setPhase("hidden_costs");
    try {
      const res = await fetch("/api/hidden-costs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      setHiddenCosts(data.costs || []);
    } catch { alert("隠れコスト分析に失敗しました"); }
    finally { setHcLoading(false); }
  }, [input]);

  /* ─── Phase 3: メイン分析 ─── */
  const startAnalysis = useCallback(async () => {
    setPhase("analyzing");
    setEstimate(null);
    setCompletedSteps(new Set());
    setStepContents({});

    const fullInput = {
      ...input,
      pmAnswers,
      hiddenCostSelections: Array.from(selectedHiddenCosts),
    };

    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullInput),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("ストリーム取得失敗");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            switch (ev.type) {
              case "step_start": setCurrentStep(ev.step); break;
              case "step_content":
                setStepContents(p => ({ ...p, [ev.step]: (p[ev.step] || "") + ev.data }));
                break;
              case "step_complete":
                setCompletedSteps(p => new Set([...p, ev.step]));
                if (ev.step === "region") ctx.current.regionAnalysis = ev.data;
                if (ev.step === "industry") ctx.current.industryAnalysis = ev.data;
                if (ev.step === "company") ctx.current.companyAnalysis = ev.data;
                break;
              case "estimate_data":
                setEstimate(JSON.parse(ev.data));
                setPhase("result");
                break;
            }
          } catch {}
        }
      }
      if (!estimate) setPhase("result");
    } catch (err) {
      alert("エラー: " + (err instanceof Error ? err.message : "不明"));
      setPhase("input");
    } finally { setCurrentStep(null); }
  }, [input, pmAnswers, selectedHiddenCosts, estimate]);

  /* ─── チャット ─── */
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const q = chatInput.trim();
    setChatInput("");
    setChatMessages(p => [...p, { role: "user", content: q }]);
    setChatLoading(true);
    try {
      const context = estimate
        ? JSON.stringify({ input, ...ctx.current, estimate })
        : `案件情報: ${input.companyName} ${input.region} ${input.industry} ${input.requirements}`;
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context }),
      });
      const data = await res.json();
      setChatMessages(p => [...p, { role: "assistant", content: data.answer || data.error }]);
    } catch {
      setChatMessages(p => [...p, { role: "assistant", content: "エラーが発生しました" }]);
    } finally { setChatLoading(false); }
  };

  /* ─── Misocaで見積書作成 ─── */
  const createMisocaEstimate = async () => {
    if (!estimate) return;
    setMisocaCreating(true);
    setMisocaError("");
    setMisocaResult(null);
    try {
      const res = await fetch("/api/misoca/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimate,
          recipientName: input.companyName,
          planIndex: selectedPlan,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMisocaResult({ id: data.estimateId, url: data.url });
    } catch (err) {
      setMisocaError(err instanceof Error ? err.message : "見積書の作成に失敗しました");
    } finally { setMisocaCreating(false); }
  };

  const plan = estimate?.plans?.[selectedPlan];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-slate-800 to-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🤖 AI見積エージェント</h1>
            <p className="text-blue-300 text-sm mt-0.5">PM思考プロセス × 類似案件検索 × サブエージェントレビュー</p>
          </div>
          <div className="flex items-center gap-3">
            {phase !== "input" && (
              <button onClick={() => { setPhase("input"); setEstimate(null); }}
                className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg">
                ← 最初から
              </button>
            )}
            <button onClick={() => setChatOpen(!chatOpen)}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1">
              💬 質問する
              {chatMessages.length > 0 && (
                <span className="bg-white text-blue-700 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {chatMessages.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* ─── Phase: 入力 ─── */}
        {phase === "input" && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">📝 案件情報を入力</h2>
              <p className="text-sm text-gray-500 mb-6">入力後、AIがPMの視点でクリティカルな確認事項を逆質問します</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {[
                  { key: "region", label: "地域", ph: "例: 岩手県北上市" },
                  { key: "industry", label: "業種", ph: "例: 製造業" },
                  { key: "companyName", label: "企業名", ph: "例: 株式会社テスト製作所" },
                  { key: "budget", label: "予算感（任意）", ph: "例: 300〜500万円" },
                  { key: "timeline", label: "希望納期（任意）", ph: "例: 2026年9月末" },
                ].map(f => (
                  <div key={f.key} className={f.key === "companyName" ? "md:col-span-2" : ""}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={f.ph} value={(input as unknown as Record<string,string>)[f.key] || ""}
                      onChange={e => setInput(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">要望・課題</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm h-28 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例: 受発注管理をデジタル化したい。現在はFAXと電話で受注しており、入力ミスが多い。在庫管理も連動させたい。"
                  value={input.requirements}
                  onChange={e => setInput(p => ({ ...p, requirements: e.target.value }))} />
              </div>
              <button onClick={startPMQuestions} disabled={pmLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg text-lg transition-colors">
                {pmLoading ? "⏳ AI が質問を考えています..." : "🧠 PMの視点で分析を開始"}
              </button>
            </div>

            {/* フロー説明 */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
              {["🧠 PM逆質問", "💡 隠れコスト", "📊 9段階分析", "💰 3プラン生成", "🔎 顧客レビュー"].map((s, i) => (
                <div key={s} className="bg-white rounded-lg p-3 text-center shadow">
                  <div className="text-2xl mb-1">{s.split(" ")[0]}</div>
                  <div className="text-xs text-gray-600">{s.split(" ").slice(1).join(" ")}</div>
                  <div className="text-xs text-gray-400 mt-1">Step {i + 1}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Phase: PM逆質問 ─── */}
        {phase === "pm_questions" && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">🧠</div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">PMからの確認事項</h2>
                  <p className="text-sm text-gray-500">見積精度を上げるために、以下の質問にお答えください</p>
                </div>
              </div>
              {pmLoading ? (
                <div className="text-center py-12 text-gray-500 animate-pulse">🧠 AIがクリティカルな質問を考えています...</div>
              ) : (
                <div className="space-y-4">
                  {pmQuestions.map(q => (
                    <div key={q.id} className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{q.category}</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-800">{q.question}</p>
                          <p className="text-xs text-gray-500 mt-1">💡 {q.why}</p>
                          <p className="text-xs text-blue-600 mt-0.5">📊 影響: {q.impact}</p>
                        </div>
                      </div>
                      {q.options && q.options.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {q.options.map(opt => (
                            <button key={opt} onClick={() => setPmAnswers(p => ({ ...p, [q.id]: opt }))}
                              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                pmAnswers[q.id] === opt ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 hover:border-blue-300"
                              }`}>{opt}</button>
                          ))}
                        </div>
                      ) : null}
                      <textarea className="w-full mt-2 border rounded-lg px-3 py-2 text-sm h-16 focus:ring-2 focus:ring-blue-500"
                        placeholder={q.placeholder}
                        value={pmAnswers[q.id] || ""}
                        onChange={e => setPmAnswers(p => ({ ...p, [q.id]: e.target.value }))} />
                    </div>
                  ))}
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setPhase("input")} className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm">← 戻る</button>
                    <button onClick={startHiddenCosts}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors">
                      {hcLoading ? "⏳ 隠れコストを分析中..." : "💡 隠れコストをチェック →"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Phase: 隠れコスト ─── */}
        {phase === "hidden_costs" && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-xl">💡</div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">隠れコストチェック</h2>
                  <p className="text-sm text-gray-500">見積から漏れやすいコストを事前に確認します</p>
                </div>
              </div>
              {hcLoading ? (
                <div className="text-center py-12 text-gray-500 animate-pulse">💡 隠れコストを洗い出しています...</div>
              ) : (
                <div>
                  <div className="space-y-2 mb-6">
                    {hiddenCosts.map(hc => (
                      <label key={hc.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedHiddenCosts.has(hc.id) ? "bg-yellow-50 border-yellow-300" : "hover:bg-gray-50"
                        }`}>
                        <input type="checkbox" checked={selectedHiddenCosts.has(hc.id)}
                          onChange={() => {
                            setSelectedHiddenCosts(p => {
                              const n = new Set(p);
                              n.has(hc.id) ? n.delete(hc.id) : n.add(hc.id);
                              return n;
                            });
                          }} className="mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-800">{hc.name}</span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{hc.category}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              hc.likelihood === "high" ? "bg-red-100 text-red-700" :
                              hc.likelihood === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                            }`}>{hc.forgottenRate}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{hc.description}</p>
                          <p className="text-xs text-blue-600 mt-0.5">💰 想定費用: {hc.estimatedRange}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 mb-4 text-sm">
                    <strong>✅ {selectedHiddenCosts.size}件</strong>のコストを見積に反映します
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setPhase("pm_questions")} className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm">← 戻る</button>
                    <button onClick={startAnalysis}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors">
                      🚀 9段階AI分析を開始 →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Phase: 分析中 ─── */}
        {phase === "analyzing" && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📊 AI分析中...</h2>
              <div className="space-y-2 mb-6">
                {STEPS.map(s => {
                  const done = completedSteps.has(s.key);
                  const active = currentStep === s.key;
                  return (
                    <div key={s.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      active ? "bg-blue-50 border border-blue-300" : done ? "bg-green-50 border border-green-200" : "bg-gray-50"
                    }`}>
                      <span>{done ? "✅" : active ? "⏳" : "⬜"}</span>
                      <span>{s.icon} {s.label}</span>
                      {active && <span className="ml-auto animate-pulse text-blue-500 text-xs">処理中...</span>}
                    </div>
                  );
                })}
              </div>
              {currentStep && ["region", "industry", "company"].includes(currentStep) && stepContents[currentStep] && (
                <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{stepContents[currentStep]}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Phase: 結果 ─── */}
        {phase === "result" && estimate && (
          <div className="space-y-4">
            {/* タブ */}
            <div className="bg-white rounded-xl shadow-lg">
              <div className="flex border-b overflow-x-auto">
                {[
                  { key: "plans", label: "💰 3プラン" },
                  { key: "breakdown", label: "📐 タスク分解" },
                  { key: "similar", label: "🔍 類似案件" },
                  { key: "preconditions", label: "📋 前提条件" },
                  { key: "risks", label: "⚠️ リスク" },
                  { key: "operations", label: "🔧 運用" },
                  { key: "review", label: "🔎 顧客レビュー" },
                  { key: "misoca", label: "📄 Misoca連携" },
                ].map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                      activeTab === t.key ? "border-blue-600 text-blue-600 bg-blue-50" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}>{t.label}</button>
                ))}
              </div>

              <div className="p-5">
                {activeTab === "plans" && <PlansView e={estimate} sel={selectedPlan} setSel={setSelectedPlan} f={fmt} />}
                {activeTab === "breakdown" && plan && <BreakdownView plan={plan} f={fmt} />}
                {activeTab === "similar" && <SimilarView cases={estimate.similarCases} f={fmt} />}
                {activeTab === "preconditions" && <PreconditionsView p={estimate.preconditions} />}
                {activeTab === "risks" && <RisksView r={estimate.riskRegister} f={fmt} />}
                {activeTab === "operations" && <OpsView o={estimate.operationsDesign} f={fmt} />}
                {activeTab === "review" && <ReviewView r={estimate.subAgentReview} />}
                {activeTab === "misoca" && (
                  <MisocaPanel
                    creating={misocaCreating}
                    result={misocaResult}
                    error={misocaError}
                    planLabel={plan?.tierLabel || ""}
                    companyName={input.companyName}
                    onCreate={createMisocaEstimate}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── 常時チャット ─── */}
      {chatOpen && (
        <div className="fixed bottom-4 right-4 w-96 bg-white rounded-xl shadow-2xl border flex flex-col z-50" style={{ height: "480px" }}>
          <div className="bg-blue-700 text-white px-4 py-3 rounded-t-xl flex items-center justify-between">
            <span className="font-bold text-sm">💬 AIに質問</span>
            <button onClick={() => setChatOpen(false)} className="text-white/80 hover:text-white">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-8">
                <p>いつでも質問できます</p>
                <div className="flex flex-wrap gap-1 mt-3 justify-center">
                  {["相場は？", "もっと安くなる？", "この項目は何？", "補助金は使える？"].map(q => (
                    <button key={q} onClick={() => { setChatInput(q); }} className="text-xs bg-gray-100 hover:bg-gray-200 rounded-full px-2 py-1">{q}</button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                }`}><p className="whitespace-pre-wrap">{m.content}</p></div>
              </div>
            ))}
            {chatLoading && <div className="text-gray-400 text-sm animate-pulse">回答中...</div>}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t p-2 flex gap-2">
            <input className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="質問を入力..."
              value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()} />
            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm">送信</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ サブコンポーネント ═══════════════════ */

function PlansView({ e, sel, setSel, f }: { e: EstimateData; sel: number; setSel: (n:number)=>void; f:(n:number)=>string }) {
  const styles = ["border-indigo-400 bg-indigo-50", "border-green-400 bg-green-50", "border-orange-400 bg-orange-50"];
  const badges = ["bg-indigo-600", "bg-green-600", "bg-orange-600"];
  const plan = e.plans?.[sel];
  return (
    <div>
      <h3 className="text-lg font-bold mb-1">{e.title}</h3>
      <p className="text-sm text-gray-600 mb-4">{e.summary}</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {e.plans?.map((p, i) => (
          <button key={p.tier} onClick={() => setSel(i)}
            className={`relative border-2 rounded-xl p-4 text-left transition ${sel === i ? styles[i] : "border-gray-200 hover:border-gray-300"}`}>
            {i === 1 && <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">おすすめ</span>}
            <span className={`inline-block text-xs text-white px-2 py-0.5 rounded-full mb-2 ${badges[i]}`}>{p.tierLabel}</span>
            <div className="text-xs text-gray-500 mb-1">{p.priority}</div>
            <div className="text-xl font-bold">¥{f(p.total)}</div>
            <div className="text-xs text-gray-500">税込 / {p.estimatedDays}日</div>
            <div className="mt-2 text-xs">
              <div className="text-green-600">✅ {p.pros?.[0]}</div>
              <div className="text-red-500">⚠️ {p.cons?.[0]}</div>
            </div>
          </button>
        ))}
      </div>
      {plan && (
        <div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-green-50 rounded-lg p-3">
              <h5 className="text-xs font-bold text-green-800 mb-1">✅ メリット</h5>
              {plan.pros?.map((p,i) => <p key={i} className="text-xs text-green-700">• {p}</p>)}
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <h5 className="text-xs font-bold text-red-800 mb-1">⚠️ デメリット</h5>
              {plan.cons?.map((c,i) => <p key={i} className="text-xs text-red-700">• {c}</p>)}
            </div>
          </div>
          <table className="w-full text-sm border-collapse mb-4">
            <thead><tr className="bg-gray-100">
              <th className="text-left p-2 border">項目</th>
              <th className="text-right p-2 border w-16">数量</th>
              <th className="text-center p-2 border w-12">単位</th>
              <th className="text-right p-2 border w-24">単価</th>
              <th className="text-right p-2 border w-28">金額</th>
            </tr></thead>
            <tbody>{plan.items?.map((it, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="p-2 border"><div className="font-medium">{it.name}</div><div className="text-xs text-gray-500">{it.description}</div></td>
                <td className="text-right p-2 border">{it.quantity}</td>
                <td className="text-center p-2 border">{it.unit}</td>
                <td className="text-right p-2 border">¥{f(it.unitPrice)}</td>
                <td className="text-right p-2 border font-medium">¥{f(it.amount)}</td>
              </tr>
            ))}</tbody>
            <tfoot className="bg-gray-50 font-medium">
              <tr><td colSpan={4} className="text-right p-2 border">小計</td><td className="text-right p-2 border">¥{f(plan.subtotal)}</td></tr>
              {plan.riskBuffer > 0 && <tr><td colSpan={4} className="text-right p-2 border text-orange-600">リスクバッファ</td><td className="text-right p-2 border text-orange-600">¥{f(plan.riskBuffer)}</td></tr>}
              <tr><td colSpan={4} className="text-right p-2 border">消費税</td><td className="text-right p-2 border">¥{f(plan.tax)}</td></tr>
              <tr className="text-lg"><td colSpan={4} className="text-right p-2 border font-bold">合計</td><td className="text-right p-2 border font-bold text-blue-700">¥{f(plan.total)}</td></tr>
            </tfoot>
          </table>
          {plan.monthlyOperationCost > 0 && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm">💡 月額運用費: <strong>¥{f(plan.monthlyOperationCost)}/月</strong></div>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownView({ plan, f }: { plan: EstimatePlan; f:(n:number)=>string }) {
  if (!plan.taskBreakdown?.length) return <p className="text-gray-500">タスク分解データなし</p>;
  const colors = ["bg-blue-50 border-blue-200", "bg-green-50 border-green-200", "bg-yellow-50 border-yellow-200", "bg-purple-50 border-purple-200"];
  return (
    <div>
      <h3 className="text-lg font-bold mb-4">📐 タスク分解 — {plan.tierLabel}</h3>
      <p className="text-sm text-gray-500 mb-4">なぜこの金額になるのか — 各フェーズの作業時間と単価の内訳</p>
      {plan.taskBreakdown.map((tb, pi) => (
        <div key={pi} className={`border rounded-lg mb-4 overflow-hidden ${colors[pi % 4]}`}>
          <div className="px-4 py-2 font-bold text-sm flex justify-between">
            <span>{tb.phase}</span>
            <span>{tb.totalHours}h / ¥{f(tb.subtotal)}</span>
          </div>
          <table className="w-full text-sm bg-white">
            <thead><tr className="bg-gray-50"><th className="text-left p-2">タスク</th><th className="text-right p-2 w-14">時間</th><th className="text-right p-2 w-20">単価</th><th className="text-right p-2 w-24">金額</th><th className="text-center p-2 w-16">担当</th></tr></thead>
            <tbody>{tb.tasks?.map((t, i) => (
              <tr key={i} className="border-t"><td className="p-2"><div className="font-medium">{t.name}</div><div className="text-xs text-gray-500">{t.description}</div></td>
                <td className="text-right p-2">{t.hours}h</td><td className="text-right p-2">¥{f(t.unitPrice)}</td><td className="text-right p-2">¥{f(t.amount)}</td><td className="text-center p-2 text-xs">{t.assignee}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function SimilarView({ cases, f }: { cases: SimilarCase[]; f:(n:number)=>string }) {
  if (!cases?.length) return <p className="text-gray-500">類似案件データなし</p>;
  return (
    <div>
      <h3 className="text-lg font-bold mb-2">🔍 類似案件</h3>
      <p className="text-sm text-gray-500 mb-4">過去の類似案件を参考に金額の妥当性を示します</p>
      <div className="space-y-3">
        {cases.map((c, i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div><h4 className="font-bold text-sm">{c.projectName}</h4><p className="text-xs text-gray-500">{c.industry} / {c.region} / {c.scale}</p></div>
              <div className="text-right"><div className="text-lg font-bold text-blue-700">¥{f(c.totalCost)}</div><div className="text-xs text-gray-500">{c.duration}</div></div>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">{c.keyFeatures?.map((feat, j) => <span key={j} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{feat}</span>)}</div>
            <p className="text-xs text-gray-600">📝 {c.lessonsLearned}</p>
            <p className="text-xs text-green-600 mt-1">🔗 {c.relevance}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreconditionsView({ p }: { p: EstimateData["preconditions"] }) {
  if (!p) return <p className="text-gray-500">前提条件データなし</p>;
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">📋 前提条件</h3>
      <Sec title="✅ 対象範囲" items={p.scope} />
      <Sec title="🚫 対象外" items={p.outOfScope} />
      <div className="border rounded-lg p-3"><h4 className="font-bold text-sm mb-2">📦 成果物</h4>
        {p.deliverables?.map((d,i) => <div key={i} className="text-sm mb-1">• <strong>{d.name}</strong>: {d.description}（完了: {d.completionCriteria}）</div>)}</div>
      <div className="border rounded-lg p-3"><h4 className="font-bold text-sm mb-2">🔄 変更管理</h4>
        <p className="text-sm">方針: {p.changeManagement?.policy}</p>
        <p className="text-sm">追加費用: {p.changeManagement?.additionalCostRule}</p></div>
      <div className="border rounded-lg p-3"><h4 className="font-bold text-sm mb-2">🤝 顧客の役割</h4>
        {p.clientResponsibilities?.map((c,i) => <div key={i} className="text-sm mb-1">• {c.task}（期限: {c.deadline}）⚠️ {c.impact}</div>)}</div>
    </div>
  );
}

function Sec({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return <div className="border rounded-lg p-3"><h4 className="font-bold text-sm mb-2">{title}</h4>{items.map((s,i) => <p key={i} className="text-sm">• {s}</p>)}</div>;
}

function RisksView({ r, f }: { r: EstimateData["riskRegister"]; f:(n:number)=>string }) {
  if (!r?.risks?.length) return <p className="text-gray-500">リスクデータなし</p>;
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">⚠️ リスクレジスター</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-right">
          <div className="text-xs text-red-600">総バッファ</div>
          <div className="text-lg font-bold text-red-700">¥{f(r.totalBufferCost)}</div>
        </div>
      </div>
      <div className="space-y-2">{r.risks.map((ri: RiskItem) => (
        <div key={ri.id} className="border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs bg-gray-200 px-1 rounded">{ri.id}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[ri.category]}`}>{CAT_LABELS[ri.category]}</span>
            <span className="font-medium text-sm">{ri.name}</span>
          </div>
          <p className="text-xs text-gray-600">{ri.description}</p>
          <div className="flex gap-3 mt-1 text-xs">
            <span>確率: {(ri.probability*100).toFixed(0)}%</span>
            <span>影響: {ri.impactHours}h</span>
            <span className="font-bold text-red-600">→ バッファ: {ri.bufferHours}h (¥{f(ri.bufferCost)})</span>
          </div>
          <div className="mt-1 text-xs bg-blue-50 rounded p-1.5"><strong>対策:</strong> {ri.mitigation}</div>
        </div>
      ))}</div>
    </div>
  );
}

function OpsView({ o, f }: { o: EstimateData["operationsDesign"]; f:(n:number)=>string }) {
  if (!o) return <p className="text-gray-500">運用データなし</p>;
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold">🔧 運用設計</h3>
      <Card2 title="📡 監視"><p className="text-sm">対象: {o.monitoring?.targets?.join("、")}</p><p className="text-sm">通知: {o.monitoring?.alertChannels?.join("、")}</p><p className="text-sm">対応: {o.monitoring?.responseHours}</p></Card2>
      <Card2 title="🚨 SLA"><p className="text-sm">営業時間内: {o.incidentSLA?.businessHours}</p><p className="text-sm">一次対応: {o.incidentSLA?.firstResponseMinutes}分以内</p><p className="text-sm">エスカレーション: {o.incidentSLA?.escalationFlow?.join(" → ")}</p></Card2>
      <Card2 title="💾 バックアップ/DR"><p className="text-sm">RTO: {o.backupDR?.rtoHours}時間 / RPO: {o.backupDR?.rpoHours}時間</p><p className="text-sm">戦略: {o.backupDR?.drStrategy}</p></Card2>
      <Card2 title="🛠️ 保守">
        {o.maintenance?.tasks?.map((t,i) => <p key={i} className="text-sm">• {t.name}（{t.frequency} / {t.responsible}）</p>)}
        <p className="text-sm font-bold mt-2">月額: ¥{f(o.maintenance?.monthlyEstimate || 0)}/月</p>
      </Card2>
    </div>
  );
}

function Card2({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="border rounded-lg p-3"><h4 className="font-bold text-sm mb-2">{title}</h4>{children}</div>;
}

function ReviewView({ r }: { r: SubAgentReview }) {
  if (!r) return <p className="text-gray-500">レビューデータなし</p>;
  const scoreColor = r.overallScore >= 8 ? "text-green-600" : r.overallScore >= 6 ? "text-yellow-600" : "text-red-600";
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-xl">🔎</div>
        <div>
          <h3 className="text-lg font-bold">顧客目線サブエージェントレビュー</h3>
          <p className="text-sm text-gray-500">顧客の立場から見積を厳しくチェックしました</p>
        </div>
        <div className="ml-auto text-center">
          <div className={`text-3xl font-bold ${scoreColor}`}>{r.overallScore}<span className="text-lg">/10</span></div>
          <div className="text-xs text-gray-500">総合スコア</div>
        </div>
      </div>

      {/* 価格妥当性 */}
      <div className={`rounded-lg p-4 mb-4 ${r.priceJustification?.isReasonable ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
        <h4 className="font-bold text-sm mb-1">{r.priceJustification?.isReasonable ? "✅ 価格は妥当" : "⚠️ 価格に懸念あり"}</h4>
        <p className="text-sm">{r.priceJustification?.reasoning}</p>
        <p className="text-sm text-gray-600 mt-1">📊 {r.priceJustification?.marketComparison}</p>
      </div>

      {/* 懸念事項 */}
      {r.customerConcerns?.length > 0 && (
        <div className="mb-4">
          <h4 className="font-bold text-sm mb-2">⚠️ 顧客の懸念事項</h4>
          <div className="space-y-2">{r.customerConcerns.map((c, i) => (
            <div key={i} className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  c.severity === "high" ? "bg-red-100 text-red-700" : c.severity === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
                }`}>{c.severity}</span>
                <span className="text-sm font-medium">{c.area}</span>
              </div>
              <p className="text-sm text-gray-700">{c.concern}</p>
              <p className="text-sm text-green-700 mt-1">💡 {c.suggestion}</p>
            </div>
          ))}</div>
        </div>
      )}

      {/* 交渉ポイント */}
      {r.negotiationPoints?.length > 0 && (
        <div className="mb-4 bg-blue-50 rounded-lg p-4">
          <h4 className="font-bold text-sm mb-2">🤝 交渉ポイント</h4>
          {r.negotiationPoints.map((n, i) => <p key={i} className="text-sm">• {n}</p>)}
        </div>
      )}

      {/* 見落とし */}
      {r.missingItems?.length > 0 && (
        <div className="mb-4 bg-yellow-50 rounded-lg p-4">
          <h4 className="font-bold text-sm mb-2">🔍 見落とし項目</h4>
          {r.missingItems.map((m, i) => <p key={i} className="text-sm">• {m}</p>)}
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-bold text-sm mb-1">📝 総合評価</h4>
        <p className="text-sm">{r.finalVerdict}</p>
      </div>
    </div>
  );
}

/* ─── Misoca連携パネル ─── */
function MisocaPanel({ creating, result, error, planLabel, companyName, onCreate }: {
  creating: boolean;
  result: { id: string; url: string } | null; error: string;
  planLabel: string; companyName: string;
  onCreate: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">📄</div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">Misoca見積書連携</h3>
          <p className="text-sm text-gray-500">AIが生成した見積データをMisocaで正式な見積書PDFにします</p>
        </div>
      </div>

      {/* 見積書作成 */}
      <div className="border rounded-lg p-4">
        <h4 className="font-bold text-sm mb-3">📝 見積書を作成</h4>
        <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm">
          <p>以下の内容でMisocaに見積書を作成します:</p>
          <div className="mt-2 space-y-1">
            <p>• <strong>プラン:</strong> {planLabel}</p>
            <p>• <strong>宛先:</strong> {companyName}</p>
          </div>
        </div>

        <button onClick={onCreate} disabled={creating}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors">
          {creating ? "⏳ 作成中..." : "📄 Misocaに見積書を送る"}
        </button>

        {/* 成功 */}
        {result && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-bold text-green-800 mb-2">✅ 見積書を作成しました！</p>
            <p className="text-sm text-gray-600 mb-2">見積書ID: {result.id}</p>
            <a href={result.url} target="_blank"
              className="inline-block bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              📄 Misocaで見積書を開く →
            </a>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">❌ {error}</p>
          </div>
        )}
      </div>

      {/* フロー説明 */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h4 className="font-bold text-sm mb-3">📊 Misoca連携の流れ</h4>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">AI分析</span>
          <span>→</span>
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded">3プラン生成</span>
          <span>→</span>
          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">プラン選択</span>
          <span>→</span>
          <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded font-bold">Misoca PDF化</span>
          <span>→</span>
          <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded">顧客に送付</span>
        </div>
      </div>
    </div>
  );
}
