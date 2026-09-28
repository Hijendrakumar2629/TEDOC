import express from 'express'
import cors from 'cors'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const app = express()
const upload = multer({ dest: 'uploads/' })
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadDir = path.join(__dirname, 'uploads')
const corpusPath = path.join(uploadDir, 'tender-corpus.json')
const productCatalogPath = path.join(uploadDir, 'product-catalog.json')
fs.mkdirSync(uploadDir, { recursive: true })

const tnRules = [
  { id: 'eligibility', label: 'Eligibility and bidder documents', terms: ['eligibility', 'experience', 'registration', 'certificate'], correction: 'Define objective eligibility, experience, registrations, certificates, and the exact submission format.' },
  { id: 'scope', label: 'Scope and technical specification', terms: ['scope of work', 'technical specification', 'specification', 'quantity'], correction: 'Add an unambiguous scope, quantities, delivery location, technical specifications, and acceptance criteria.' },
  { id: 'security', label: 'Bid security and performance security', terms: ['bid security', 'earnest money', 'emd', 'performance security', 'security deposit'], correction: 'State the applicable bid security and performance security amount, form, exemption, validity, and refund/forfeiture conditions.' },
  { id: 'deadline', label: 'Submission deadline and bid validity', terms: ['last date', 'submission deadline', 'bid validity', 'opening date', 'due date'], correction: 'State publication, clarification, submission, opening dates, time zone, location, and bid validity period.' },
  { id: 'evaluation', label: 'Transparent evaluation method', terms: ['evaluation criteria', 'technical evaluation', 'financial bid', 'l1', 'scoring'], correction: 'Publish objective technical and financial evaluation criteria, weightage, pass marks, and the award method.' },
  { id: 'terms', label: 'Contract, dispute, and cancellation terms', terms: ['arbitration', 'dispute', 'termination', 'cancellation', 'liquidated damages'], correction: 'Include contract conditions for disputes, arbitration, termination, delay damages, cancellation, and governing authority.' },
  { id: 'contact', label: 'Authority and clarification contact', terms: ['clarification', 'contact officer', 'procuring entity', 'address', 'email'], correction: 'Identify the procuring entity, authorised officer, address, clarification process, and official contact channel.' },
]

function readCorpus() {
  try { return JSON.parse(fs.readFileSync(corpusPath, 'utf8')) } catch { return [] }
}

function saveCorpus(entry) {
  const corpus = readCorpus().filter(item => item.fileName !== entry.fileName)
  corpus.push(entry)
  fs.writeFileSync(corpusPath, JSON.stringify(corpus.slice(-25), null, 2))
}

function readProductCatalog() {
  try { return JSON.parse(fs.readFileSync(productCatalogPath, 'utf8')) } catch { return [] }
}

function getProductRecommendations(text) {
  const normalized = text.toLowerCase()
  const catalog = readProductCatalog()
  const matches = catalog.map(product => {
    const ignoredTerms = new Set(['with', 'from', 'that', 'this', 'shall', 'must', 'their', 'which', 'where', 'when', 'work', 'supply', 'item', 'items', 'tender', 'technical', 'specification', 'required', 'product', 'standard'])
    const productTerms = [...new Set(`${product.category} ${product.name} ${product.description} ${(product.standards || []).join(' ')}`.toLowerCase().match(/[a-z0-9]{4,}/g) || [])].filter(term => !ignoredTerms.has(term))
    const matchedTerms = productTerms.filter(term => normalized.includes(term))
    return { ...product, matchedTerms, matchScore: productTerms.length ? Math.round(matchedTerms.length / productTerms.length * 100) : 0 }
  }).filter(product => product.matchedTerms.length >= 2 && product.matchScore >= 20)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5)
    .map(({ matchScore, matchedTerms, ...product }) => ({ ...product, matchScore, matchedTerms }))

  return {
    recommendations: matches,
    recommendationNotice: matches.length
      ? 'Catalog matches are suggestions only. Confirm technical fit and current BIS licence status with the official BIS verification service before procurement.'
      : 'No matching products are loaded in the local catalog. No brand or ISI/BIS approval is being assumed. Import a verified product catalog to enable product matches.',
    catalogCount: catalog.length,
  }
}

function localTenderDoctor(text, source) {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ')
  const corpusCount = readCorpus().length
  const productResults = getProductRecommendations(text)
  const missing = tnRules.filter(rule => !rule.terms.some(term => normalized.includes(term)))
  const present = tnRules.length - missing.length
  const score = Math.max(0, Math.min(100, Math.round((present / tnRules.length) * 100)))
  const findings = missing.map(rule => `${rule.label}: ${rule.correction}`)
  const compliance = [
    `Reviewed ${tnRules.length} TN tender release controls; ${present} control areas were detected in the document.`,
    'Release only after the buyer validates every finding against the applicable Tamil Nadu procurement instructions and tender authority requirements.',
    `Document source: ${source || 'uploaded tender'}. Local Tender Doctor reference corpus contains ${corpusCount} uploaded document${corpusCount === 1 ? '' : 's'}. This assessment is a decision-support review, not a legal opinion.`,
  ]
  return {
    score,
    summary: missing.length === 0 ? 'Tender Doctor found all configured release controls in the document. Perform officer approval before publication.' : `Tender Doctor found ${missing.length} release control gap${missing.length === 1 ? '' : 's'}. Resolve the findings before publishing this tender.`,
    findings: findings.length ? findings : ['No configured release-control gap was detected. Verify the final tender manually before publication.'],
    compliance,
    releaseReady: missing.length === 0,
    rulesChecked: tnRules.map(rule => ({ id: rule.id, label: rule.label, status: missing.includes(rule) ? 'Needs review' : 'Detected' })),
    ...productResults,
  }
}

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.post('/api/fetch-url', async (req, res) => {
  try {
    const { url } = req.body || {}

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A public URL is required.' })
    }

    const response = await fetch(url)

    if (!response.ok) {
      return res.status(400).json({ error: `Source fetch failed with status ${response.status}.` })
    }

    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()

    if (contentType.includes('application/pdf')) {
      return res.json({ type: 'pdf', text })
    }

    const cleaned = text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!cleaned) {
      return res.status(400).json({ error: 'The page returned no readable text.' })
    }

    res.json({ type: 'html', text: cleaned })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to fetch source.' })
  }
})

app.post('/api/analyze', async (req, res) => {
  try {
    const { text, source } = req.body || {}

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Tender text is required.' })
    }

    const apiKey = process.env.OPENAI_API_KEY
    const groundedReview = localTenderDoctor(text, source)

    if (!apiKey) {
      return res.json(groundedReview)
    }

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are Tender Doctor, an evidence-grounded tender document analyzer for Tamil Nadu procurement. Analyze only the supplied tender text. Never invent a product, brand, IS/BIS standard number, clause, certificate, or legal requirement. For every concern quote a short exact evidence excerpt or say evidence not located and mark Needs Verification. Return valid JSON with summary, findings (array of objects with category, issue, evidence, recommendation), requiredDocuments (array of objects with category, requirement, status, evidence, recommendation), standards (array with reference, relevance, status, evidence), and procurementNotes (array of strings). Distinguish extracted facts from recommendations. Do not say any product is ISI/BIS approved; product suggestions are selected separately from the backend catalog and must carry recorded BIS evidence. Human procurement officer approval is always required.`
          },
          {
            role: 'user',
            content: `Source: ${source || 'uploaded document'}\n\nTender text:\n${text}`
          }
        ]
      })
    })

    if (!openAiResponse.ok) {
      return res.status(502).json({ error: 'OpenAI API request failed.' })
    }

    const data = await openAiResponse.json()
    const content = data?.choices?.[0]?.message?.content || ''

    try {
      const parsed = JSON.parse(content)
      res.json({
        ...groundedReview,
        summary: typeof parsed.summary === 'string' ? `${groundedReview.summary} ${parsed.summary}` : groundedReview.summary,
        findings: [...groundedReview.findings, ...(Array.isArray(parsed.findings) ? parsed.findings.map(item => typeof item === 'string' ? item : `${item.category || 'Review'}: ${item.issue || 'Finding'} | Evidence: ${item.evidence || 'Not located; needs verification'} | Recommendation: ${item.recommendation || 'Officer review required'}`) : [])],
        compliance: [...groundedReview.compliance, ...(Array.isArray(parsed.procurementNotes) ? parsed.procurementNotes.map(String) : [])],
        requiredDocuments: Array.isArray(parsed.requiredDocuments) ? parsed.requiredDocuments : [],
        standards: Array.isArray(parsed.standards) ? parsed.standards : [],
      })
    } catch {
      res.json({
        score: 84,
        summary: content || 'AI response generated successfully.',
        findings: ['Review the full AI output for TN compliance issues.', 'Ensure bid terms and evaluation criteria are explicit.'],
        compliance: ['Check eligibility and documentation requirements.', 'Validate fairness and transparency of scoring.'],
        ...getProductRecommendations(text),
      })
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'AI review failed.' })
  }
})

app.get('/api/products', (_req, res) => {
  res.json({ products: readProductCatalog(), count: readProductCatalog().length })
})

app.post('/api/products/import', (req, res) => {
  const rows = Array.isArray(req.body?.products) ? req.body.products : []
  if (!rows.length) return res.status(400).json({ error: 'Provide a products array to import.' })

  const catalog = readProductCatalog()
  const imported = rows.filter(product => product && typeof product === 'object' && product.name && product.category).map(product => ({
    id: String(product.id || `${product.brand || 'unknown'}-${product.model || product.name}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 120),
    name: String(product.name).slice(0, 160),
    brand: String(product.brand || 'Not specified').slice(0, 100),
    model: String(product.model || 'Not specified').slice(0, 100),
    category: String(product.category).slice(0, 120),
    description: String(product.description || '').slice(0, 2000),
    standards: Array.isArray(product.standards) ? product.standards.map(String).slice(0, 20) : [],
    bisLicenceNumber: String(product.bisLicenceNumber || '').slice(0, 100),
    bisSourceUrl: String(product.bisSourceUrl || '').slice(0, 500),
    certificationStatus: 'Needs Verification',
    verificationEvidence: null,
    sourceName: String(product.sourceName || 'User-provided catalog').slice(0, 160),
    importedAt: new Date().toISOString(),
  }))

  if (!imported.length) return res.status(400).json({ error: 'No valid products found. Each product needs a name and category.' })
  const updated = [...catalog.filter(existing => !imported.some(product => product.id === existing.id)), ...imported].slice(-1000)
  fs.writeFileSync(productCatalogPath, JSON.stringify(updated, null, 2))
  res.status(201).json({ imported: imported.length, message: 'Products imported. Certification remains Needs Verification until checked against an authoritative BIS source.' })
})

app.post('/api/products/:id/verify', (req, res) => {
  const { humanReviewed, verifiedBy, bisSourceUrl, bisLicenceNumber } = req.body || {}
  let source
  try { source = new URL(bisSourceUrl) } catch { return res.status(400).json({ error: 'Provide an official BIS source URL for the manual review record.' }) }
  if (source.hostname !== 'bis.gov.in' && !source.hostname.endsWith('.bis.gov.in')) {
    return res.status(400).json({ error: 'Only an official bis.gov.in source can be recorded for BIS review.' })
  }
  if (humanReviewed !== true || !String(verifiedBy || '').trim() || !String(bisLicenceNumber || '').trim()) {
    return res.status(400).json({ error: 'Human review confirmation, reviewer name, and BIS licence number are required.' })
  }
  const catalog = readProductCatalog()
  const product = catalog.find(item => item.id === req.params.id)
  if (!product) return res.status(404).json({ error: 'Product not found in the local catalog.' })
  product.certificationStatus = 'Manually Verified'
  product.bisSourceUrl = source.toString()
  product.bisLicenceNumber = String(bisLicenceNumber).trim().slice(0, 100)
  product.verificationEvidence = {
    verifiedBy: String(verifiedBy).trim().slice(0, 120),
    checkedAt: new Date().toISOString(),
    sourceUrl: source.toString(),
    bisLicenceNumber: String(bisLicenceNumber).trim().slice(0, 100),
    method: 'Human review recorded; no live BIS API verification was performed by this prototype.',
  }
  fs.writeFileSync(productCatalogPath, JSON.stringify(catalog, null, 2))
  res.json({ product, message: 'Manual verification record saved. This is not an automated BIS certification.' })
})

app.post('/api/upload-pdf', upload.single('file'), async (req, res) => {
  try {
    const file = req.file

    if (!file) {
      return res.status(400).json({ error: 'Please upload a PDF file.' })
    }

    const filePath = path.join(__dirname, file.path)
    const stats = fs.statSync(filePath)

    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      fs.unlinkSync(filePath)
      return res.status(400).json({ error: 'Only PDF files are supported.' })
    }

    let text = ''
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const document = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(filePath)) }).promise
      const pages = []
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        const content = await page.getTextContent()
        pages.push(content.items.map(item => item.str || '').join(' '))
      }
      text = pages.join('\n').trim()
    } catch (error) {
      text = ''
    }

    if (!text) text = `Uploaded PDF: ${file.originalname}. No selectable text was found; OCR/manual review is required.`
    saveCorpus({ fileName: file.originalname, uploadedAt: new Date().toISOString(), text: text.slice(0, 200000) })
    fs.unlinkSync(filePath)
    res.json({ type: 'pdf-upload', text, fileName: file.originalname, extracted: !text.startsWith('Uploaded PDF:') })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'PDF upload failed.' })
  }
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'tender-ai-proxy' })
})

const port = process.env.PORT || 4001
app.listen(port, () => {
  console.log(`Tender AI proxy ready on http://localhost:${port}`)
})
