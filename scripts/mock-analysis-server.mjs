// Mock analysis server for the Risico-analyse UI feature.
// Contract: specs/008-risico-analyse-ui/contracts/{n8n-submit,run-callback,run-status}.md
// Deterministic timelines; scenarios via MOCK_SCENARIO=rich|thin|error|slow.
// Fixtures contain no real client data.

import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.env.PORT ?? 4010)
const SCENARIO = process.env.MOCK_SCENARIO ?? 'rich'

const RICH_RESULT = {
  risicos: [
    'Inkomensderving bij arbeidsongeschaktheid gedurende de eerste twee jaar.',
    'Waardevermindering van de woonhuis bij waterschade in de kruipruimte.',
    'Stijgende zorgkosten zonder aanvullende dekking.',
  ],
  dekking: 'Huidige polis dekt waterschade aan de constructie, maar geen inhoud in de kruipruimte.',
  restgat: 'Arbeidsongeschaktheid buiten de wettelijke tweejaarstermijn blijft volledig ongedekt.',
  draagkracht: 'Maandlasten laten circa 12% van het netto-inkomen als buffer over.',
  opties: [
    {
      titel: 'Volledige verzekering',
      voor: ['Volledige afdekking van het restgat', 'Vaste premie'],
      tegen: ['Hogere maandlasten', 'Mogelijk dubbele dekking'],
    },
    {
      titel: 'Gedeeltelijke verzekering',
      voor: ['Lagere premie', 'Risico grotendeels beperkt'],
      tegen: ['Eigen risico blijft bestaan'],
    },
    {
      titel: 'Zelf dragen',
      voor: ['Geen premie', 'Maximale flexibiliteit'],
      tegen: ['Volledig eigen risico bij schade'],
    },
  ],
  lacunes: [
    'Huidige polisnummer van de opdrachtgever',
    'Jaaropgave van de afgelopen 12 maanden',
    'Overzicht van bestaande schades uit de afgelopen 5 jaar',
    'Gegevens over de gezondheidssituatie die relevant zijn voor de acceptatie',
  ],
  intern_signalen: [
    'Op basis van het beschikbare patroon lijkt sprake van een beperkt restgat.',
    'Interne overweging: het dossier is mogelijk geschikt voor premie-optimalisatie.',
    'Interne overweging: mogelijk bestaat een verwante lopende polis elders.',
  ],
  bronnen: [
    { id: 'K1', document: 'Polisvoorwaarden Woonhuis 2026', locatie: 'Artikel 4.2, pagina 12', passage: 'Decking geldt uitsluitend voor schade aan de constructie, niet voor inhoud in kruipruimten.' },
    { id: 'K2', document: 'Kennisbank Verzekeringswijzer', locatie: 'Hoofdstuk 3, paragraaf 1', passage: 'De wettelijke tweejaarstermening voor arbeidsongeschaktheid eindigt na 104 weken.' },
    { id: 'R1', document: 'Regeling zorgverzekering 2026', locatie: 'Artikel 2.14', passage: 'De basisverzekering omvat geen tandartskosten boven de leeftijd van 18 jaar.' },
    { id: 'R2', document: 'Regeling inkomensvoorziening', locatie: 'Artikel 3:5, lid 2', passage: 'Aanvullende dekking is niet verplicht gesteld voor zelfstandigen.' },
    { id: 'A1', document: 'Bijlage draagkracht berekening', locatie: 'Tabel 2, rij 4', passage: 'Een buffer van ten minste 10 procent van het netto-inkomen is gangbaar.' },
    { id: 'A2', document: 'Bijlage klantgesprek intake', locatie: 'Vraag 7', passage: 'De opdrachtgever heeft geen lopende schadeclaims gemeld.' },
  ],
}

const THIN_RESULT = {
  risicos: ['Inkomensderving bij langdurige arbeidsongeschaktheid.'],
  dekking: 'Onvoldoende gegevens om de huidige dekking vast te stellen.',
  restgat: 'Onvoldoende gegevens om het restgat te bepalen.',
  draagkracht: 'Onvoldoende gegevens om de draagkracht te beoordelen.',
  opties: [
    {
      titel: 'Verzekeren',
      voor: ['Risico afgedekt'],
      tegen: ['Premie onbekend zonder draagkrachtgegevens'],
    },
  ],
  lacunes: [
    'Huidige polissen en dekkingsgebieden',
    'Netto maandinkomen en vaste lasten',
    'Gezondheidssituatie relevant voor acceptatie',
    'Gezinssituatie en gezamenlijke inkomsten',
    'Bestaande vermogensopbouw',
    'Loopbaanperspectief en verwachte inkomensontwikkeling',
    'Kostwinnersstatus',
  ],
  intern_signalen: ['De ingediende informatie is karig; de analyse beperkt zich tot wat vaststaat.'],
  bronnen: [
    { id: 'K1', document: 'Kennisbank Basisinformatie', locatie: 'Inleiding', passage: 'Zonder volledige klantsituatie blijft de analyse oppervlakkig.' },
  ],
}

const RICH_MARKDOWN = `## Risico's
- Inkomensderving bij arbeidsongeschaktheid gedurende de eerste twee jaar [K2]
- Waardevermindering van de woonhuis bij waterschade in de kruipruimte [K1]
- Stijgende zorgkosten zonder aanvullende dekking [R1]

## Dekking en restgat
De huidige polis dekt waterschade aan de constructie [K1]. Arbeidsongeschaktheid buiten de wettelijke tweejaarstermijn blijft volledig ongedekt [K2].

## Draagkracht
Maandlasten laten circa 12% van het netto-inkomen als buffer over [A1].

## Opties met voor en tegen
- Volledige verzekering: volledige afdekking tegen hogere maandlasten [R2]
- Gedeeltelijke verzekering: lagere premie, eigen risico blijft bestaan
- Zelf dragen: maximale flexibiliteit, volledig eigen risico bij schade [A1]

## Interne signalen
Op basis van het beschikbare patroon lijkt sprake van een beperkt restgat [A2]. Mogelijk bestaat een verwante lopende polis elders.`

const THIN_MARKDOWN = `## Risico's
- Inkomensderving bij langdurige arbeidsongeschaktheid [K1]

## Dekking en restgat
Onvoldoende gegevens om de huidige dekking vast te stellen [K1].

## Draagkracht
Onvoldoende gegevens om de draagkracht te beoordelen.

## Opties met voor en tegen
- Verzekeren: risico afgedekt, premie onbekend zonder draagkrachtgegevens

## Interne signalen
De ingediende informatie is karig; de analyse beperkt zich tot wat vaststaat.`

// runId -> run record (in-memory; resets on restart)
const runs = new Map()

function nowIso() {
  return new Date().toISOString()
}

function createRun(input) {
  const id = input.run_id || randomUUID()
  const startedAt = nowIso()
  const finishedAt = new Date(Date.now() + DURATION_MS[SCENARIO] ?? 10_000)
  const run = {
    id,
    assistant_id: input.assistant_id ?? randomUUID(),
    advisor_id: input.advisor_id ?? randomUUID(),
    client_reference: input.klant_ref ?? 'referentie',
    status: 'queued',
    started_at: startedAt,
    finished_at: null,
    error_code: null,
    error_message: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    result: null,
    intern_markdown: null,
    dossier_docx_url: null,
    scenario: SCENARIO,
    pendingUntil: Date.now() + (SCENARIO === 'slow' ? 125_000 : SCENARIO === 'error' ? 5_000 : 9_000),
  }
  runs.set(id, run)
  return run
}

function advanceRun(run) {
  if (run.status === 'queued' && Date.now() >= run.pendingUntil - (SCENARIO === 'slow' ? 120_000 : SCENARIO === 'error' ? 0 : 5_000)) {
    run.status = 'running'
  }
  if (run.status === 'running' && Date.now() >= run.pendingUntil) {
    if (run.scenario === 'error') {
      run.status = 'failed'
      run.finished_at = nowIso()
      run.error_code = 'N8N_WORKFLOW_ERROR'
      run.error_message = 'De analyse-workflow kon niet worden voltooid. Probeer het opnieuw of neem contact op met de beheerder.'
    } else {
      run.status = 'succeeded'
      run.finished_at = nowIso()
      const rich = run.scenario !== 'thin'
      run.result = rich ? RICH_RESULT : THIN_RESULT
      run.intern_markdown = rich ? RICH_MARKDOWN : THIN_MARKDOWN
      run.dossier_docx_url = `http://localhost:${PORT}/fixtures/dossier-${run.id}.docx`
    }
  }
  return run
}

function publicRun(run) {
  return {
    id: run.id,
    assistant_id: run.assistant_id,
    advisor_id: run.advisor_id,
    client_reference: run.client_reference,
    status: run.status,
    started_at: run.started_at,
    finished_at: run.finished_at,
    error_code: run.error_code,
    error_message: run.error_message,
    expires_at: run.expires_at,
    result: run.status === 'succeeded' ? run.result : null,
    intern_markdown: run.status === 'succeeded' ? run.intern_markdown : null,
    dossier_docx_url: run.status === 'succeeded' ? run.dossier_docx_url : null,
  }
}

function publicRecent(run) {
  return {
    id: run.id,
    assistant_id: run.assistant_id,
    client_reference: run.client_reference,
    status: run.status,
    started_at: run.started_at,
    finished_at: run.finished_at,
    error_code: run.error_code,
  }
}

const DURATION_MS = { rich: 10_000, thin: 9_000, error: 8_000, slow: 125_000 }

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end(JSON.stringify(body))
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    return res.end()
  }

  if (req.method === 'POST' && url.pathname === '/analysis-runs') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      let input = {}
      try {
        input = body ? JSON.parse(body) : {}
      } catch {
        input = {}
      }
      if (!input.klant_ref || !input.verzekeringsvraagstuk) {
        return send(res, 422, { error: 'VALIDATION', message: 'klant_ref en verzekeringsvraagstuk zijn verplicht.' })
      }
      const hasGroup = Boolean(input.klantsituatie) || (input.bestanden && input.bestanden.length > 0) || (input.urls && input.urls.length > 0)
      if (!hasGroup) {
        return send(res, 422, { error: 'GROUP_VALIDATION', message: 'Vul minimaal één van Klantsituatie, Bestanden of URL\u2019s.' })
      }
      const run = createRun(input)
      return send(res, 202, { run_id: run.id })
    })
    return
  }

  const runMatch = url.pathname.match(/^\/analysis-runs\/([0-9a-f-]{36})$/)
  if (req.method === 'GET' && runMatch) {
    const run = runs.get(runMatch[1])
    if (!run) return send(res, 404, { error: 'NOT_FOUND', message: 'Run niet gevonden.' })
    return send(res, 200, publicRun(advanceRun(run)))
  }

  if (req.method === 'GET' && url.pathname === '/analysis-runs') {
    const advisorId = url.searchParams.get('advisor_id')
    const limit = Number(url.searchParams.get('limit') ?? 10)
    const list = [...runs.values()]
      .filter((r) => !advisorId || r.advisor_id === advisorId)
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .slice(0, limit)
      .map(publicRecent)
    return send(res, 200, list)
  }

  if (req.method === 'GET' && url.pathname.startsWith('/fixtures/dossier-')) {
    // Minimal valid docx placeholder (not a real document)
    const buf = Buffer.from('UEsDBBQABgAIAAAA', 'base64')
    res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Access-Control-Allow-Origin': '*' })
    return res.end(buf)
  }

  return send(res, 404, { error: 'NOT_FOUND', message: 'Onbekend endpoint.' })
}).listen(PORT, () => {
  console.log(`[mock-analysis-server] listening on http://localhost:${PORT} (scenario: ${SCENARIO})`)
})