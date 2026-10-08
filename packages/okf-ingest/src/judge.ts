import { AbstractAiAdapter } from '@quatrain/ai';
import { GeminiAdapter } from '@quatrain/ai-gemini';
import { OpenAiAdapter } from '@quatrain/ai-openai';
import { OkfDocument } from './types';

/**
 * Fine-grained qualitative scoring dimensions for OKF extraction evaluations.
 */
export interface OkfDimensionScores {
   /** Factual truthfulness to source, heavy penalty for made-up claims (Weight: 30%) */
   factualFidelity: number;
   /** Scientific/botanical naming, taxonomic family, binomial precision, or honest 'Undetermined' (Weight: 25%) */
   taxonomicAccuracy: number;
   /** Soil indicators, agro-ecological diagnostic criteria, complete extraction (Weight: 20%) */
   bioIndicationCompleteness: number;
   /** Translation fidelity of abstracts, keywords, multilingual alignment (Weight: 15%) */
   multilingualQuality: number;
   /** OKF v0.2 frontmatter contract, schema fields, markdown formatting hygiene (Weight: 10%) */
   structureCompliance: number;
}

/**
 * Specific factual hallucination or ground-truth divergence identified by a judge.
 */
export interface OkfHallucination {
   /** Target field or section where hallucination occurred (e.g. 'title', 'scientificName', 'soils') */
   field: string;
   /** Severity level of the hallucination */
   severity: 'critical' | 'major' | 'minor';
   /** What the extracted document claimed */
   claimed: string;
   /** What the source text actually says, or empty if completely absent */
   sourceReality: string;
   /** Detailed auditor explanation of why this constitutes a hallucination */
   explanation: string;
   /** Whether this hallucination was verified by multiple judges in consensus */
   consensus?: boolean;
   /** Number of judges that agreed on this hallucination */
   agreementCount?: number;
}

/**
 * Standard qualitative evaluation report returned by a single LLM judge.
 */
export interface OkfEvaluationReport {
   /** Identifier of the judge ('gemini' | 'chatgpt' | 'claude' | custom) */
   judge: string;
   /** Model name used for evaluation (e.g. 'gemini-2.5-flash', 'gpt-4o', 'claude-3-5-sonnet') */
   model: string;
   /** Overall weighted qualitative score between 0 and 100 */
   score: number;
   /** Academic letter grade based on score */
   grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
   /** Automated pipeline verdict */
   verdict: 'PASS' | 'WARN' | 'FAIL';
   /** Breakdown of scores across the 5 orthogonal dimensions */
   dimensions: OkfDimensionScores;
   /** Identified hallucinations with severity grading */
   hallucinations: OkfHallucination[];
   /** Key source concepts or diagnostic items omitted in the extraction */
   omissions: string[];
   /** Strong aspects of the extraction */
   strengths: string[];
   /** Actionable suggestions to improve the extraction prompt or pipeline */
   recommendations: string[];
   /** Qualitative auditor executive summary */
   summary: string;
   /** ISO timestamp of the evaluation */
   evaluatedAt: string;
}

/**
 * Composite consensus report aggregating evaluations from multiple LLM judges.
 */
export interface CompositeEvaluationReport {
   /** Consolidated composite score (weighted or arithmetic mean of judge scores) */
   overallScore: number;
   /** Consolidated academic letter grade */
   overallGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
   /** Final consensus verdict */
   verdict: 'PASS' | 'WARN' | 'FAIL';
   /** List of judge identifiers that contributed to this report */
   activeJudges: string[];
   /** Averaged scores across all 5 dimensions */
   dimensionAverages: OkfDimensionScores;
   /** Individual evaluation reports from each active judge */
   judges: OkfEvaluationReport[];
   /** Consolidated list of hallucinations flagged by at least one judge */
   consensusHallucinations: OkfHallucination[];
   /** Consolidated list of omissions identified across judges */
   consensusOmissions: string[];
   /** Score spread between highest and lowest judge score (measure of inter-judge consensus) */
   scoreVariance: number;
   /** Global synthesis and executive overview */
   summary: string;
   /** ISO timestamp of the composite evaluation */
   evaluatedAt: string;
}

/**
 * Input target passed to the evaluator.
 */
export interface OkfEvaluationTarget {
   /** Ground-truth source text (e.g. raw OCR, scan excerpt, chapter text) */
   sourceText: string;
   /** Generated/extracted OKF document, JSON payload, or formatted Markdown */
   extracted: OkfDocument | Record<string, unknown> | string;
   /** Optional domain description or guidelines (e.g. botanical, agronomic, legal) */
   domainContext?: string;
   /** Optional expected fields that should have been extracted */
   expectedFields?: string[];
}

/**
 * API keys and model configuration for judge providers.
 */
export interface JudgeProviderConfig {
   geminiApiKey?: string;
   geminiModel?: string;
   openAiApiKey?: string;
   openAiModel?: string;
   anthropicApiKey?: string;
   anthropicModel?: string;
   openRouterApiKey?: string;
   customAdapters?: Record<string, AbstractAiAdapter>;
}

/**
 * Execution options for composite evaluation.
 */
export interface CompositeJudgeOptions {
   /** List of judges to invoke (defaults to all available from environment) */
   judges?: Array<'gemini' | 'chatgpt' | 'claude' | string>;
   /** Optional relative weights for each judge in the composite score */
   weights?: Record<string, number>;
   /** Provider API keys and model overrides */
   providerConfig?: JudgeProviderConfig;
}

/**
 * Weight distribution for calculating the overall qualitative score.
 */
export const OKF_DIMENSION_WEIGHTS: Record<keyof OkfDimensionScores, number> = {
   factualFidelity: 0.30,
   taxonomicAccuracy: 0.25,
   bioIndicationCompleteness: 0.20,
   multilingualQuality: 0.15,
   structureCompliance: 0.10,
};

/**
 * Universal JSON Schema for structured LLM-as-a-Judge outputs.
 */
export const OKF_JUDGE_JSON_SCHEMA = {
   type: 'OBJECT',
   properties: {
      factualFidelity: {
         type: 'NUMBER',
         description: 'Score 0-100 on factual truthfulness to source. Heavy penalty for fabricated claims.',
      },
      taxonomicAccuracy: {
         type: 'NUMBER',
         description: 'Score 0-100 on scientific naming, taxonomic precision, or honest "Undetermined".',
      },
      bioIndicationCompleteness: {
         type: 'NUMBER',
         description: 'Score 0-100 on extracting all soil indicators, ecological criteria, diagnostics.',
      },
      multilingualQuality: {
         type: 'NUMBER',
         description: 'Score 0-100 on quality and alignment of translated abstracts and keywords.',
      },
      structureCompliance: {
         type: 'NUMBER',
         description: 'Score 0-100 on OKF frontmatter schema compliance and clean Markdown formatting.',
      },
      hallucinations: {
         type: 'ARRAY',
         items: {
            type: 'OBJECT',
            properties: {
               field: { type: 'STRING' },
               severity: { type: 'STRING', enum: ['critical', 'major', 'minor'] },
               claimed: { type: 'STRING' },
               sourceReality: { type: 'STRING' },
               explanation: { type: 'STRING' },
            },
            required: ['field', 'severity', 'claimed', 'sourceReality', 'explanation'],
         },
      },
      omissions: {
         type: 'ARRAY',
         items: { type: 'STRING' },
      },
      strengths: {
         type: 'ARRAY',
         items: { type: 'STRING' },
      },
      recommendations: {
         type: 'ARRAY',
         items: { type: 'STRING' },
      },
      summary: {
         type: 'STRING',
         description: 'Concise executive synthesis explaining the qualitative score.',
      },
   },
   required: [
      'factualFidelity',
      'taxonomicAccuracy',
      'bioIndicationCompleteness',
      'multilingualQuality',
      'structureCompliance',
      'hallucinations',
      'omissions',
      'strengths',
      'recommendations',
      'summary',
   ],
};

/**
 * Raw unstructured payload returned by LLM judges before normalization.
 */
interface RawJudgePayload {
   factualFidelity?: number;
   taxonomicAccuracy?: number;
   bioIndicationCompleteness?: number;
   multilingualQuality?: number;
   structureCompliance?: number;
   hallucinations?: Array<{
      field?: string;
      severity?: string;
      claimed?: string;
      sourceReality?: string;
      explanation?: string;
   }>;
   omissions?: string[];
   strengths?: string[];
   recommendations?: string[];
   summary?: string;
   properties?: Record<string, unknown>;
}

/**
 * OkfEntryEvaluator orchestrates autonomous qualitative assessments
 * of extracted OKF documents, supporting standalone Gemini audits
 * and multi-model consensus scoring with ChatGPT and Claude.
 */
export class OkfEntryEvaluator {
   protected _config: JudgeProviderConfig;

   constructor(config: JudgeProviderConfig = {}) {
      this._config = config;
   }

   /**
    * Computes an academic letter grade from a numerical score (0 to 100).
    */
   static calculateGrade(score: number): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
      if (score >= 90) return 'A+';
      if (score >= 80) return 'A';
      if (score >= 70) return 'B';
      if (score >= 60) return 'C';
      if (score >= 50) return 'D';
      return 'F';
   }

   /**
    * Determines the pipeline verdict based on score and severity of hallucinations.
    * A critical hallucination (such as inventing a species name) triggers an immediate FAIL.
    */
   static calculateVerdict(score: number, hallucinations: OkfHallucination[]): 'PASS' | 'WARN' | 'FAIL' {
      const hasCritical = hallucinations.some((h) => h.severity === 'critical');
      if (hasCritical) {
         return 'FAIL';
      }
      const hasMajor = hallucinations.some((h) => h.severity === 'major');
      if (score >= 80 && !hasMajor) {
         return 'PASS';
      }
      if (score >= 50) {
         return 'WARN';
      }
      return 'FAIL';
   }

   /**
    * Computes the weighted composite score from the 5 qualitative dimensions.
    */
   static calculateWeightedScore(dimensions: OkfDimensionScores): number {
      const raw =
         dimensions.factualFidelity * OKF_DIMENSION_WEIGHTS.factualFidelity +
         dimensions.taxonomicAccuracy * OKF_DIMENSION_WEIGHTS.taxonomicAccuracy +
         dimensions.bioIndicationCompleteness * OKF_DIMENSION_WEIGHTS.bioIndicationCompleteness +
         dimensions.multilingualQuality * OKF_DIMENSION_WEIGHTS.multilingualQuality +
         dimensions.structureCompliance * OKF_DIMENSION_WEIGHTS.structureCompliance;

      return Math.round(Math.max(0, Math.min(100, raw)) * 10) / 10;
   }

   /**
    * Detects which LLM judges can be activated based on available API keys or adapters.
    */
   static detectAvailableJudges(config: JudgeProviderConfig = {}): string[] {
      const available: string[] = [];

      const geminiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
      if (geminiKey) {
         available.push('gemini');
      }

      const openAiKey = config.openAiApiKey || process.env.OPENAI_API_KEY;
      if (openAiKey) {
         available.push('chatgpt');
      }

      const anthropicKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
      const openRouterKey = config.openRouterApiKey || process.env.OPENROUTER_API_KEY;
      if (anthropicKey || openRouterKey) {
         available.push('claude');
      }

      if (config.customAdapters) {
         for (const customName of Object.keys(config.customAdapters)) {
            available.push(customName);
         }
      }

      return available;
   }

   /**
    * Formats an extracted document target into a sanitized inspection string for the judge prompt.
    */
   protected _formatExtractedTarget(extracted: OkfDocument | Record<string, unknown> | string): string {
      if (typeof extracted === 'string') {
         return extracted.trim();
      }
      if ('metadata' in extracted && 'body' in extracted) {
         const doc = extracted as OkfDocument;
         return `---\n${JSON.stringify(doc.metadata, null, 2)}\n---\n\n${doc.body}`;
      }
      return JSON.stringify(extracted, null, 2);
   }

   /**
    * Builds the standardized auditor prompt sent to LLM judges.
    */
   buildJudgePrompt(target: OkfEvaluationTarget): string {
      const extractedStr = this._formatExtractedTarget(target.extracted);
      const domainSection = target.domainContext
         ? `Domain Guidelines & Expectations:\n${target.domainContext}\n\n`
         : '';

      const expectedFieldsSection = target.expectedFields && target.expectedFields.length > 0
         ? `Expected Fields to evaluate:\n${target.expectedFields.join(', ')}\n\n`
         : '';

      return `You are a Chief Scientific Auditor and rigorous evaluator assessing the quality of an automated text extraction into the Open Knowledge Format (OKF v0.2).

Your role is to strictly compare the GROUND TRUTH SOURCE TEXT against the EXTRACTED OKF DOCUMENT and produce an objective qualitative audit.

${domainSection}${expectedFieldsSection}## CRITICAL AUDITING INSTRUCTIONS:
1. FACTUAL FIDELITY (Weight 30%):
   - Are all stated claims strictly grounded in the source text?
   - Look for HALLUCINATIONS: Did the model invent facts, properties, or dates not supported by the source?
   - Any invented fact must be reported in the 'hallucinations' array with exact citations and severity ('critical', 'major', or 'minor').

2. TAXONOMIC & DOMAIN ACCURACY (Weight 25%):
   - Are botanical/scientific names, binomials, taxonomic families, and vernacular names exact?
   - HONESTY CONTRACT: If the source text lacks a legible title or plant name (e.g. obscured in margins), an honest model sets 'Undetermined' or notes ambiguity. An unfaithful model invents a plausible-sounding name. Reward honesty! Heavily penalize plausible-sounding fabrications.

3. BIO-INDICATION & CONTENT COMPLETENESS (Weight 20%):
   - Did the extraction capture all soil indicators, ecological criteria, diagnostic keys, and agronomic properties present in the source?
   - Report missing key points in the 'omissions' array.

4. MULTILINGUAL QUALITY (Weight 15%):
   - Are abstracts, descriptions, and keywords well-translated, natural, and terminologically accurate?

5. STRUCTURE COMPLIANCE (Weight 10%):
   - Is the OKF frontmatter clean? Are tags lowercase? Is the Markdown body free of raw JSON blocks, broken code fences, or duplicated text?

--------------------------------------------------------------------------------
GROUND TRUTH SOURCE TEXT:
${target.sourceText}
--------------------------------------------------------------------------------

EXTRACTED OKF DOCUMENT TO EVALUATE:
${extractedStr}
--------------------------------------------------------------------------------

Respond strictly with a JSON object conforming to the required schema. Do NOT include markdown code fences or conversational text.`;
   }

   /**
    * Normalizes raw LLM output into a validated OkfEvaluationReport.
    */
   protected _normalizePayload(
      raw: RawJudgePayload,
      judge: string,
      model: string
   ): OkfEvaluationReport {
      const data = raw.properties && typeof raw.properties === 'object' && !raw.factualFidelity
         ? (raw.properties as RawJudgePayload)
         : raw;

      const clamp = (val: unknown): number => {
         const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
         if (isNaN(num)) return 50;
         return Math.max(0, Math.min(100, Math.round(num * 10) / 10));
      };

      const dimensions: OkfDimensionScores = {
         factualFidelity: clamp(data.factualFidelity),
         taxonomicAccuracy: clamp(data.taxonomicAccuracy),
         bioIndicationCompleteness: clamp(data.bioIndicationCompleteness),
         multilingualQuality: clamp(data.multilingualQuality),
         structureCompliance: clamp(data.structureCompliance),
      };

      const hallucinations: OkfHallucination[] = [];
      if (Array.isArray(data.hallucinations)) {
         for (const h of data.hallucinations) {
            if (h) {
               const rawSev = String(h.severity || 'major').toLowerCase();
               const severity: 'critical' | 'major' | 'minor' =
                  rawSev === 'critical' || rawSev === 'minor' ? rawSev : 'major';

               hallucinations.push({
                  field: String(h.field || 'general'),
                  severity,
                  claimed: String(h.claimed || ''),
                  sourceReality: String(h.sourceReality || ''),
                  explanation: String(h.explanation || ''),
               });
            }
         }
      }

      const omissions = Array.isArray(data.omissions) ? data.omissions.map(String) : [];
      const strengths = Array.isArray(data.strengths) ? data.strengths.map(String) : [];
      const recommendations = Array.isArray(data.recommendations) ? data.recommendations.map(String) : [];
      const summary = typeof data.summary === 'string' ? data.summary.trim() : 'Qualitative evaluation completed.';

      const score = OkfEntryEvaluator.calculateWeightedScore(dimensions);
      const grade = OkfEntryEvaluator.calculateGrade(score);
      const verdict = OkfEntryEvaluator.calculateVerdict(score, hallucinations);

      return {
         judge,
         model,
         score,
         grade,
         verdict,
         dimensions,
         hallucinations,
         omissions,
         strengths,
         recommendations,
         summary,
         evaluatedAt: new Date().toISOString(),
      };
   }

   /**
    * Evaluates an OKF entry using a generic AbstractAiAdapter.
    */
   async evaluateWithAdapter(
      adapter: AbstractAiAdapter,
      target: OkfEvaluationTarget,
      judgeName = 'custom',
      modelName = 'custom-model'
   ): Promise<OkfEvaluationReport> {
      adapter.init();
      const prompt = this.buildJudgePrompt(target);
      const raw = (await adapter.generateStructured(prompt, OKF_JUDGE_JSON_SCHEMA, {
         model: modelName,
         temperature: 0.1,
      })) as RawJudgePayload;

      return this._normalizePayload(raw, judgeName, modelName);
   }

   /**
    * Evaluates an OKF entry using Gemini (GeminiAdapter).
    */
   async evaluateWithGemini(
      target: OkfEvaluationTarget,
      options: { apiKey?: string; model?: string } = {}
   ): Promise<OkfEvaluationReport> {
      const apiKey = options.apiKey || this._config.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
         throw new Error(
            'OkfEntryEvaluator: GEMINI_API_KEY is required to evaluate with Gemini. Provide it in constructor, options, or environment.'
         );
      }

      const model = options.model || this._config.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const adapter = new GeminiAdapter(apiKey);
      return this.evaluateWithAdapter(adapter, target, 'gemini', model);
   }

   /**
    * Evaluates an OKF entry using ChatGPT (OpenAiAdapter).
    */
   async evaluateWithChatGpt(
      target: OkfEvaluationTarget,
      options: { apiKey?: string; model?: string } = {}
   ): Promise<OkfEvaluationReport> {
      const apiKey = options.apiKey || this._config.openAiApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
         throw new Error(
            'OkfEntryEvaluator: OPENAI_API_KEY is required to evaluate with ChatGPT. Provide it in constructor, options, or environment.'
         );
      }

      const model = options.model || this._config.openAiModel || 'gpt-4o';
      const adapter = OpenAiAdapter.forOpenAi(apiKey, model);
      return this.evaluateWithAdapter(adapter, target, 'chatgpt', model);
   }

   /**
    * Evaluates an OKF entry using Claude (Anthropic API or OpenRouter).
    */
   async evaluateWithClaude(
      target: OkfEvaluationTarget,
      options: { apiKey?: string; model?: string; openRouterKey?: string } = {}
   ): Promise<OkfEvaluationReport> {
      const openRouterKey = options.openRouterKey || this._config.openRouterApiKey || process.env.OPENROUTER_API_KEY;
      const anthropicKey = options.apiKey || this._config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;

      if (openRouterKey) {
         const model = options.model || this._config.anthropicModel || 'anthropic/claude-3.5-sonnet';
         const adapter = OpenAiAdapter.forOpenRouter(openRouterKey, model);
         return this.evaluateWithAdapter(adapter, target, 'claude', model);
      }

      if (anthropicKey) {
         const model = options.model || this._config.anthropicModel || 'claude-3-5-sonnet-latest';
         const prompt = this.buildJudgePrompt(target);
         const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
               'x-api-key': anthropicKey,
               'anthropic-version': '2023-06-01',
               'content-type': 'application/json',
            },
            body: JSON.stringify({
               model,
               max_tokens: 4096,
               temperature: 0.1,
               system: 'You must return ONLY a valid JSON object matching the required schema without markdown fences.',
               messages: [{ role: 'user', content: prompt }],
            }),
         });

         if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OkfEntryEvaluator: Anthropic API error (${res.status}): ${errText}`);
         }

         const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
         const text = data.content?.[0]?.text || '{}';
         let cleaned = text.trim();
         if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
         if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
         if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);

         const raw = JSON.parse(cleaned.trim()) as RawJudgePayload;
         return this._normalizePayload(raw, 'claude', model);
      }

      throw new Error(
         'OkfEntryEvaluator: ANTHROPIC_API_KEY or OPENROUTER_API_KEY is required to evaluate with Claude.'
      );
   }

   /**
    * Evaluates an OKF entry with a single specified judge, defaulting to Gemini or first available.
    */
   async evaluate(
      target: OkfEvaluationTarget,
      options: { judge?: string; model?: string; apiKey?: string; adapter?: AbstractAiAdapter } = {}
   ): Promise<OkfEvaluationReport> {
      if (options.adapter) {
         return this.evaluateWithAdapter(options.adapter, target, options.judge || 'custom', options.model || 'custom');
      }

      const judge = (options.judge || 'gemini').toLowerCase();
      if (judge === 'gemini') {
         return this.evaluateWithGemini(target, options);
      }
      if (judge === 'chatgpt' || judge === 'openai') {
         return this.evaluateWithChatGpt(target, options);
      }
      if (judge === 'claude' || judge === 'anthropic') {
         return this.evaluateWithClaude(target, options);
      }

      if (this._config.customAdapters) {
         const custom = Reflect.get(this._config.customAdapters, judge) as AbstractAiAdapter | undefined;
         if (custom) {
            return this.evaluateWithAdapter(custom, target, judge, options.model || judge);
         }
      }

      throw new Error(`OkfEntryEvaluator: Unsupported or unconfigured judge "${options.judge}".`);
   }

   /**
    * Computes a multi-judge composite evaluation, orchestrating parallel audits and consensus synthesis.
    */
   async evaluateComposite(
      target: OkfEvaluationTarget,
      options: CompositeJudgeOptions = {}
   ): Promise<CompositeEvaluationReport> {
      const available = OkfEntryEvaluator.detectAvailableJudges({
         ...this._config,
         ...options.providerConfig,
      });

      const selected = (options.judges && options.judges.length > 0)
         ? options.judges.map((j) => j.toLowerCase())
         : available;

      if (selected.length === 0) {
         throw new Error(
            'OkfEntryEvaluator: No AI keys configured for composite evaluation. Supply at least GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.'
         );
      }

      const reports: OkfEvaluationReport[] = [];
      const tasks = selected.map(async (judgeName) => {
         try {
            if (judgeName === 'gemini') {
               return await this.evaluateWithGemini(target, {
                  apiKey: options.providerConfig?.geminiApiKey,
                  model: options.providerConfig?.geminiModel,
               });
            }
            if (judgeName === 'chatgpt' || judgeName === 'openai') {
               return await this.evaluateWithChatGpt(target, {
                  apiKey: options.providerConfig?.openAiApiKey,
                  model: options.providerConfig?.openAiModel,
               });
            }
            if (judgeName === 'claude' || judgeName === 'anthropic') {
               return await this.evaluateWithClaude(target, {
                  apiKey: options.providerConfig?.anthropicApiKey,
                  model: options.providerConfig?.anthropicModel,
                  openRouterKey: options.providerConfig?.openRouterApiKey,
               });
            }
            if (this._config.customAdapters) {
               const custom = Reflect.get(this._config.customAdapters, judgeName) as AbstractAiAdapter | undefined;
               if (custom) {
                  return await this.evaluateWithAdapter(custom, target, judgeName, judgeName);
               }
            }
            return null;
         } catch (err) {
            console.warn(`[OkfEntryEvaluator] Judge "${judgeName}" failed:`, err);
            return null;
         }
      });

      const results = await Promise.all(tasks);
      for (const res of results) {
         if (res) reports.push(res);
      }

      if (reports.length === 0) {
         throw new Error('OkfEntryEvaluator: All selected judges failed to return evaluation reports.');
      }

      return OkfEntryEvaluator.synthesizeComposite(reports, options.weights);
   }

   /**
    * Synthesizes multiple individual judge reports into a unified consensus report.
    */
   static synthesizeComposite(
      reports: OkfEvaluationReport[],
      weights?: Record<string, number>
   ): CompositeEvaluationReport {
      if (reports.length === 0) {
         throw new Error('OkfEntryEvaluator.synthesizeComposite: At least one report is required.');
      }

      const activeJudges = reports.map((r) => r.judge);

      // Compute weighted overall score
      let totalWeight = 0;
      let weightedSum = 0;
      for (const rep of reports) {
         const w = weights?.[rep.judge] ?? 1.0;
         weightedSum += rep.score * w;
         totalWeight += w;
      }
      const overallScore = Math.round((weightedSum / (totalWeight || 1)) * 10) / 10;
      const overallGrade = OkfEntryEvaluator.calculateGrade(overallScore);

      // Compute dimension averages
      const dimensionKeys: Array<keyof OkfDimensionScores> = [
         'factualFidelity',
         'taxonomicAccuracy',
         'bioIndicationCompleteness',
         'multilingualQuality',
         'structureCompliance',
      ];

      const dimensionAverages: OkfDimensionScores = {
         factualFidelity: 0,
         taxonomicAccuracy: 0,
         bioIndicationCompleteness: 0,
         multilingualQuality: 0,
         structureCompliance: 0,
      };

      for (const key of dimensionKeys) {
         const sum = reports.reduce((acc, r) => acc + (Reflect.get(r.dimensions, key) as number), 0);
         Reflect.set(dimensionAverages, key, Math.round((sum / reports.length) * 10) / 10);
      }

      // Track score variance
      const scores = reports.map((r) => r.score);
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const scoreVariance = Math.round((maxScore - minScore) * 10) / 10;

      // Consolidate hallucinations with consensus tracking
      const consensusHallucinations: OkfHallucination[] = [];
      const fieldCountMap = new Map<string, { count: number; sample: OkfHallucination }>();

      for (const rep of reports) {
         for (const h of rep.hallucinations) {
            const key = `${h.field.toLowerCase()}:${h.claimed.toLowerCase().trim()}`;
            const existing = fieldCountMap.get(key);
            if (existing) {
               existing.count++;
               if (h.severity === 'critical') existing.sample.severity = 'critical';
            } else {
               fieldCountMap.set(key, { count: 1, sample: { ...h } });
            }
         }
      }

      for (const [, item] of fieldCountMap) {
         item.sample.agreementCount = item.count;
         item.sample.consensus = reports.length > 1 ? item.count >= 2 : true;
         consensusHallucinations.push(item.sample);
      }

      // Consolidate omissions
      const omissionSet = new Set<string>();
      for (const rep of reports) {
         for (const om of rep.omissions) {
            omissionSet.add(om);
         }
      }
      const consensusOmissions = Array.from(omissionSet);

      // Determine final consensus verdict
      const hasCritical = consensusHallucinations.some((h) => h.severity === 'critical');

      let verdict: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
      if (hasCritical || overallScore < 50) {
         verdict = 'FAIL';
      } else if (overallScore < 80 || consensusHallucinations.some((h) => h.severity === 'major')) {
         verdict = 'WARN';
      }

      // Generate composite executive summary
      const judgeSummary = reports.map((r) => `${r.judge} (${r.model}): ${r.score}/100 [${r.grade}]`).join(', ');
      const varianceNote = scoreVariance >= 15
         ? ` High variance (${scoreVariance} pts) indicates ambiguity or divergent judge interpretations.`
         : ` Strong inter-judge consensus (spread: ${scoreVariance} pts).`;

      const summary = `Composite evaluation with ${reports.length} judges: ${judgeSummary}. Final Consensus Score: ${overallScore}/100 (${overallGrade} - ${verdict}).${varianceNote}`;

      return {
         overallScore,
         overallGrade,
         verdict,
         activeJudges,
         dimensionAverages,
         judges: reports,
         consensusHallucinations,
         consensusOmissions,
         scoreVariance,
         summary,
         evaluatedAt: new Date().toISOString(),
      };
   }
}
