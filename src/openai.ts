export type AiAnalysisResult = {
  score: number
  summary: string
  findings: string[]
  compliance: string[]
}

export async function fetchGovernmentSourceText(url: string): Promise<string> {
  const safeUrl = url.trim()

  if (!safeUrl) {
    throw new Error('Please enter a government tender URL.')
  }

  let response: Response

  try {
    response = await fetch(safeUrl, { mode: 'cors' })
  } catch {
    throw new Error('The government page blocked browser access or is not publicly accessible. Try a public HTML page or upload the tender PDF instead.')
  }

  if (!response.ok) {
    throw new Error(`Public source request failed with status ${response.status}. Use a public government page or upload the tender file directly.`)
  }

  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/pdf')) {
    throw new Error('Direct PDF fetch is not supported in the browser without a server-side PDF parser. Please upload the PDF or paste the tender text instead.')
  }

  const rawHtml = await response.text()
  const cleaned = rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) {
    throw new Error('The government page did not return readable text. Please upload a PDF or paste the tender text.')
  }

  return cleaned
}

const defaultDemoResult: AiAnalysisResult = {
  score: 84,
  summary: 'Document reviewed against TN tender compliance standards. Key issues include missing clause specificity, certificate requirements, and bid security validation.',
  findings: [
    'Testing standard is not clearly named in the tender requirement.',
    'Certificate validity, issuer and coverage are not explicitly specified.',
    'Bid security and eligibility conditions need clearer validation checks.',
  ],
  compliance: [
    'Verify eligibility documents before publication.',
    'Define evaluation scoring and technical criteria explicitly.',
    'Confirm bid security, validity period and submission format before issue.',
  ],
}

function normalizeAiResponse(raw: string): AiAnalysisResult {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return {
        score: Number(parsed.score ?? 84),
        summary: String(parsed.summary ?? defaultDemoResult.summary),
        findings: Array.isArray(parsed.findings) ? parsed.findings.map(String) : defaultDemoResult.findings,
        compliance: Array.isArray(parsed.compliance) ? parsed.compliance.map(String) : defaultDemoResult.compliance,
      }
    }
  } catch {
    // ignore and fall back to a readable summary extracted from the plain text response
  }

  const summary = raw.replace(/\s+/g, ' ').trim() || defaultDemoResult.summary
  return {
    score: defaultDemoResult.score,
    summary,
    findings: defaultDemoResult.findings,
    compliance: defaultDemoResult.compliance,
  }
}

export async function analyzeTenderDocument(text: string): Promise<AiAnalysisResult> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY

  if (!apiKey) {
    return defaultDemoResult
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a Tamil Nadu tender compliance reviewer. Review the tender text and return valid JSON only with fields: score, summary, findings, compliance. Keep score between 0 and 100. findings and compliance must be arrays of strings. Focus on TN procurement compliance, bid eligibility, clarity, fairness, security, and documentation rules.',
        },
        {
          role: 'user',
          content: `Review this tender text for TN procurement compliance:\n\n${text}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error('AI analysis failed. Please check the API key and network access.')
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content ?? ''

  return normalizeAiResponse(content)
}
