export type AiAnalysisResult = {
  score: number
  summary: string
  findings: string[]
  compliance: string[]
  releaseReady?: boolean
  rulesChecked?: Array<{ id: string; label: string; status: string }>
  recommendations?: ProductRecommendation[]
  recommendationNotice?: string
  catalogCount?: number
}

export type ProductRecommendation = {
  id: string
  name: string
  brand: string
  model: string
  category: string
  description: string
  standards: string[]
  bisLicenceNumber: string
  bisSourceUrl: string
  certificationStatus: string
  verificationEvidence?: { verifiedBy: string; checkedAt: string; sourceUrl: string; bisLicenceNumber: string; method: string } | null
  sourceName: string
  matchScore: number
  matchedTerms: string[]
}

const API_BASE_URL = 'http://localhost:4001'

export async function fetchGovernmentSourceText(url: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/fetch-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  })

  const data = await response.json()

  if (!response.ok || data.error) {
    throw new Error(data.error || 'Source fetch failed.')
  }

  return data.text
}

export async function analyzeTenderDocument(text: string, source = 'uploaded-document'): Promise<AiAnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source })
  })

  const data = await response.json()

  if (!response.ok || data.error) {
    throw new Error(data.error || 'AI analysis failed.')
  }

  return {
    score: Number(data.score ?? 84),
    summary: String(data.summary ?? 'Tender reviewed successfully.'),
    findings: Array.isArray(data.findings) ? data.findings.map(String) : [],
    compliance: Array.isArray(data.compliance) ? data.compliance.map(String) : [],
    releaseReady: Boolean(data.releaseReady),
    rulesChecked: Array.isArray(data.rulesChecked) ? data.rulesChecked.map((rule: { id?: unknown; label?: unknown; status?: unknown }) => ({ id: String(rule.id ?? ''), label: String(rule.label ?? ''), status: String(rule.status ?? '') })) : [],
    recommendations: Array.isArray(data.recommendations) ? data.recommendations.map((product: ProductRecommendation) => ({ ...product, verificationEvidence: product.verificationEvidence ?? null })) : [],
    recommendationNotice: String(data.recommendationNotice ?? ''),
    catalogCount: Number(data.catalogCount ?? 0)
  }
}

export async function uploadPdfToProxy(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/api/upload-pdf`, {
    method: 'POST',
    body: formData
  })

  const data = await response.json()

  if (!response.ok || data.error) {
    throw new Error(data.error || 'PDF upload failed.')
  }

  return data.text
}
