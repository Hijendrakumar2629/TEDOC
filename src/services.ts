export type User = { id: string; name: string; email: string }
export type Tender = { id: string; name: string; product: string; score: number }
export type TenderRequirement = { id: string; text: string; category: string; status: 'Covered' | 'Review' | 'Missing' | 'Potential Conflict' }
export type Standard = { id: string; title: string; version: string; demo: boolean }
export type StandardClause = { id: string; standardId: string; reference: string; excerpt: string }
export type StandardRelationship = { from: string; to: string; kind: 'safety' | 'test' | 'installation' | 'normative' }
export type Analysis = { id: string; tenderId: string; score: number; completedAt: string }
export type Issue = { id: string; severity: string; title: string; requirementId: string }
export type Evidence = { id: string; issueId: string; source: string; interpretation: string; recommendation: string }
export type RevisionSuggestion = { id: string; issueId: string; original: string; suggested: string; rationale: string }
export type Report = { id: string; analysisId: string; sections: string[] }

export const documentParser = { parse: async (input: string) => ({ source: input, pages: 8 }) }
export const requirementExtractor = { extract: async (_document: unknown): Promise<TenderRequirement[]> => [] }
export const standardRetriever = { search: async (_query: string): Promise<Standard[]> => [] }
export const standardMatcher = { match: async (_requirement: TenderRequirement, _standards: Standard[]) => [] }
export const issueDetector = { detect: async (_requirements: TenderRequirement[]) => [] as Issue[] }
export const evidenceMapper = { map: async (_issue: Issue): Promise<Evidence[]> => [] }
export const revisionAssistant = { suggest: async (_issue: Issue): Promise<RevisionSuggestion | null> => null }
export const reportGenerator = { generate: async (_analysis: Analysis): Promise<Report> => ({ id: 'demo-report', analysisId: _analysis.id, sections: ['Tender summary', 'Evidence', 'Revision suggestions'] }) }
