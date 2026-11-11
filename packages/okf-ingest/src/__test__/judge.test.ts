import { describe, it, expect } from '@jest/globals';
import { AbstractAiAdapter } from '@quatrain/ai';
import {
   OkfEntryEvaluator,
   OkfEvaluationReport,
   OkfDimensionScores,
   OkfHallucination,
   OKF_DIMENSION_WEIGHTS,
} from '../judge';

/**
 * Mock AI Adapter for unit testing LLM-as-a-Judge evaluations.
 */
class MockJudgeAdapter extends AbstractAiAdapter {
   protected _mockResponse: Record<string, unknown>;

   constructor(mockResponse: Record<string, unknown>) {
      super();
      this._mockResponse = mockResponse;
   }

   init(): void {}

   async generateText(_prompt: string): Promise<string> {
      return JSON.stringify(this._mockResponse);
   }

   async generateStructured<T = unknown>(_prompt: unknown, _schema: unknown): Promise<T> {
      return this._mockResponse as T;
   }
}

describe('OkfEntryEvaluator & LLM-as-a-Judge Core', () => {
   describe('Grading & Verdict Formulas', () => {
      it('should calculate appropriate academic letter grades', () => {
         expect(OkfEntryEvaluator.calculateGrade(95)).toBe('A+');
         expect(OkfEntryEvaluator.calculateGrade(90)).toBe('A+');
         expect(OkfEntryEvaluator.calculateGrade(85)).toBe('A');
         expect(OkfEntryEvaluator.calculateGrade(75)).toBe('B');
         expect(OkfEntryEvaluator.calculateGrade(65)).toBe('C');
         expect(OkfEntryEvaluator.calculateGrade(55)).toBe('D');
         expect(OkfEntryEvaluator.calculateGrade(40)).toBe('F');
      });

      it('should compute weighted score strictly according to 30/25/20/15/10 distribution', () => {
         const dimensions: OkfDimensionScores = {
            factualFidelity: 100, // 30
            taxonomicAccuracy: 80, // 20
            bioIndicationCompleteness: 90, // 18
            multilingualQuality: 70, // 10.5
            structureCompliance: 100, // 10
         };

         const expected =
            100 * OKF_DIMENSION_WEIGHTS.factualFidelity +
            80 * OKF_DIMENSION_WEIGHTS.taxonomicAccuracy +
            90 * OKF_DIMENSION_WEIGHTS.bioIndicationCompleteness +
            70 * OKF_DIMENSION_WEIGHTS.multilingualQuality +
            100 * OKF_DIMENSION_WEIGHTS.structureCompliance;

         expect(OkfEntryEvaluator.calculateWeightedScore(dimensions)).toBe(expected);
      });

      it('should enforce FAIL verdict if any critical hallucination is present even with high score', () => {
         const criticalH: OkfHallucination = {
            field: 'scientificName',
            severity: 'critical',
            claimed: 'Foeniculum vulgare',
            sourceReality: 'Acanthus mollis (title was partially noisy in OCR)',
            explanation: 'Invented completely unrelated plant species.',
         };

         // Score would otherwise be 85 (Grade A), but critical hallucination forces FAIL
         expect(OkfEntryEvaluator.calculateVerdict(85, [criticalH])).toBe('FAIL');
      });

      it('should assign WARN if score is between 50 and 79 or if a major hallucination exists', () => {
         const majorH: OkfHallucination = {
            field: 'soils',
            severity: 'major',
            claimed: 'Sol calcaire sec',
            sourceReality: 'Sol humide lisières méditerranéennes',
            explanation: 'Inverted water regime indication.',
         };

         expect(OkfEntryEvaluator.calculateVerdict(85, [majorH])).toBe('WARN');
         expect(OkfEntryEvaluator.calculateVerdict(72, [])).toBe('WARN');
      });

      it('should assign PASS when score >= 80 and no critical or major hallucinations', () => {
         const minorH: OkfHallucination = {
            field: 'tags',
            severity: 'minor',
            claimed: 'plante-rare',
            sourceReality: 'Not explicitly mentioned',
            explanation: 'Subjective classification tag.',
         };

         expect(OkfEntryEvaluator.calculateVerdict(88, [minorH])).toBe('PASS');
      });
   });

   describe('Available Judge Detection', () => {
      it('should detect judges from config object', () => {
         const judges = OkfEntryEvaluator.detectAvailableJudges({
            geminiApiKey: 'test-gemini-key',
            openAiApiKey: 'test-openai-key',
            anthropicApiKey: 'test-anthropic-key',
         });

         expect(judges).toContain('gemini');
         expect(judges).toContain('chatgpt');
         expect(judges).toContain('claude');
      });

      it('should recognize OpenRouter key as enabling Claude judge', () => {
         const judges = OkfEntryEvaluator.detectAvailableJudges({
            openRouterApiKey: 'sk-or-v1-test',
         });

         expect(judges).toContain('claude');
      });
   });

   describe('Single Judge Evaluation via Adapter', () => {
      it('should evaluate and normalize structured report from mock adapter', async () => {
         const mockPayload = {
            factualFidelity: 92,
            taxonomicAccuracy: 95,
            bioIndicationCompleteness: 88,
            multilingualQuality: 90,
            structureCompliance: 96,
            hallucinations: [],
            omissions: ['Missing secondary biotope details'],
            strengths: ['Accurate Latin binomial Acanthus mollis', 'Clean OKF frontmatter'],
            recommendations: ['Capture moisture index explicitly'],
            summary: 'High quality extraction with rigorous taxonomic fidelity.',
         };

         const adapter = new MockJudgeAdapter(mockPayload);
         const evaluator = new OkfEntryEvaluator();

         const report = await evaluator.evaluateWithAdapter(
            adapter,
            {
               sourceText: 'ACANTHUS MOLLIS Acanthe molle Plante vivace de 30-80 cm...',
               extracted: {
                  metadata: {
                     type: 'catalog-entry',
                     title: 'Acanthe molle',
                     scientificName: 'Acanthus mollis',
                     family: 'Acanthaceae',
                  },
                  body: '# Acanthe molle\nPlante vivace...',
               },
            },
            'gemini',
            'gemini-2.5-flash'
         );

         expect(report.judge).toBe('gemini');
         expect(report.model).toBe('gemini-2.5-flash');
         expect(report.grade).toBe('A+');
         expect(report.verdict).toBe('PASS');
         expect(report.dimensions.taxonomicAccuracy).toBe(95);
         expect(report.hallucinations.length).toBe(0);
         expect(report.strengths).toContain('Accurate Latin binomial Acanthus mollis');
      });

      it('should penalize and flag hallucinations in report', async () => {
         const mockPayloadWithHallucination = {
            factualFidelity: 20,
            taxonomicAccuracy: 10,
            bioIndicationCompleteness: 70,
            multilingualQuality: 60,
            structureCompliance: 90,
            hallucinations: [
               {
                  field: 'scientificName',
                  severity: 'critical',
                  claimed: 'Foeniculum vulgare',
                  sourceReality: 'Source was Acanthus mollis or undetermined margin',
                  explanation: 'Model hallucinated Giant Fennel from noisy margin artifact.',
               },
            ],
            omissions: ['Actual botanical family omitted'],
            strengths: ['Well-formed JSON structure'],
            recommendations: ['Set scientificName to Undetermined if title is noisy'],
            summary: 'Critical hallucination detected: invented plant species.',
         };

         const adapter = new MockJudgeAdapter(mockPayloadWithHallucination);
         const evaluator = new OkfEntryEvaluator();

         const report = await evaluator.evaluateWithAdapter(
            adapter,
            {
               sourceText: 'ACANTHACÉES Plante vivace de 30-80 cm...',
               extracted: {
                  title: 'Fenouil géant',
                  scientificName: 'Foeniculum vulgare',
               },
            },
            'gemini',
            'gemini-2.5-flash'
         );

         expect(report.verdict).toBe('FAIL');
         expect(report.hallucinations.length).toBe(1);
         expect(report.hallucinations[0].severity).toBe('critical');
         expect(report.hallucinations[0].claimed).toBe('Foeniculum vulgare');
      });
   });

   describe('Composite Evaluation & Consensus Synthesis', () => {
      it('should synthesize multiple judge reports into a unified consensus report', () => {
         const geminiReport: OkfEvaluationReport = {
            judge: 'gemini',
            model: 'gemini-2.5-flash',
            score: 85,
            grade: 'A',
            verdict: 'PASS',
            dimensions: {
               factualFidelity: 85,
               taxonomicAccuracy: 90,
               bioIndicationCompleteness: 80,
               multilingualQuality: 85,
               structureCompliance: 90,
            },
            hallucinations: [
               {
                  field: 'edition',
                  severity: 'minor',
                  claimed: '3rd edition',
                  sourceReality: 'Unspecified',
                  explanation: 'Implied but not explicitly written',
               },
            ],
            omissions: ['Omitted flowering period'],
            strengths: ['Great soil diagnosis'],
            recommendations: ['Keep edition empty if unstated'],
            summary: 'Solid extraction.',
            evaluatedAt: new Date().toISOString(),
         };

         const chatGptReport: OkfEvaluationReport = {
            judge: 'chatgpt',
            model: 'gpt-4o',
            score: 83,
            grade: 'A',
            verdict: 'PASS',
            dimensions: {
               factualFidelity: 80,
               taxonomicAccuracy: 90,
               bioIndicationCompleteness: 85,
               multilingualQuality: 80,
               structureCompliance: 85,
            },
            hallucinations: [
               {
                  field: 'edition',
                  severity: 'minor',
                  claimed: '3rd edition',
                  sourceReality: 'Unspecified',
                  explanation: 'Extrapolated from year',
               },
            ],
            omissions: ['Flowering months missing'],
            strengths: ['Good taxonomy'],
            recommendations: [],
            summary: 'Accurate and structured.',
            evaluatedAt: new Date().toISOString(),
         };

         const claudeReport: OkfEvaluationReport = {
            judge: 'claude',
            model: 'claude-3-5-sonnet',
            score: 88,
            grade: 'A',
            verdict: 'PASS',
            dimensions: {
               factualFidelity: 90,
               taxonomicAccuracy: 95,
               bioIndicationCompleteness: 80,
               multilingualQuality: 85,
               structureCompliance: 95,
            },
            hallucinations: [],
            omissions: ['Secondary biotope omitted'],
            strengths: ['Taxonomy perfectly aligned with APG IV'],
            recommendations: [],
            summary: 'Very high quality.',
            evaluatedAt: new Date().toISOString(),
         };

         const composite = OkfEntryEvaluator.synthesizeComposite([
            geminiReport,
            chatGptReport,
            claudeReport,
         ]);

         expect(composite.activeJudges).toEqual(['gemini', 'chatgpt', 'claude']);
         // Average score: (85 + 83 + 88) / 3 = 85.3
         expect(composite.overallScore).toBe(85.3);
         expect(composite.overallGrade).toBe('A');
         expect(composite.verdict).toBe('PASS');

         // Score variance: 88 - 83 = 5
         expect(composite.scoreVariance).toBe(5);

         // Consensus hallucination: 'edition:3rd edition' was flagged by 2 judges (Gemini and ChatGPT)
         expect(composite.consensusHallucinations.length).toBe(1);
         expect(composite.consensusHallucinations[0].agreementCount).toBe(2);
         expect(composite.consensusHallucinations[0].consensus).toBe(true);

         // Consolidated omissions
         expect(composite.consensusOmissions.length).toBeGreaterThanOrEqual(2);
      });

      it('should detect divergence when judges disagree significantly', () => {
         const judgeA: OkfEvaluationReport = {
            judge: 'gemini',
            model: 'gemini-2.5-flash',
            score: 90,
            grade: 'A+',
            verdict: 'PASS',
            dimensions: {
               factualFidelity: 90,
               taxonomicAccuracy: 90,
               bioIndicationCompleteness: 90,
               multilingualQuality: 90,
               structureCompliance: 90,
            },
            hallucinations: [],
            omissions: [],
            strengths: [],
            recommendations: [],
            summary: 'Passes easily.',
            evaluatedAt: new Date().toISOString(),
         };

         const judgeB: OkfEvaluationReport = {
            judge: 'chatgpt',
            model: 'gpt-4o',
            score: 45,
            grade: 'F',
            verdict: 'FAIL',
            dimensions: {
               factualFidelity: 30,
               taxonomicAccuracy: 40,
               bioIndicationCompleteness: 50,
               multilingualQuality: 60,
               structureCompliance: 70,
            },
            hallucinations: [
               {
                  field: 'scientificName',
                  severity: 'critical',
                  claimed: 'Wrong species',
                  sourceReality: 'Other species',
                  explanation: 'Severe error.',
               },
            ],
            omissions: [],
            strengths: [],
            recommendations: [],
            summary: 'Failed.',
            evaluatedAt: new Date().toISOString(),
         };

         const composite = OkfEntryEvaluator.synthesizeComposite([judgeA, judgeB]);
         expect(composite.scoreVariance).toBe(45); // 90 - 45 = 45
         expect(composite.verdict).toBe('FAIL'); // Critical hallucination triggers FAIL
         expect(composite.summary).toContain('High variance');
      });
   });
});
