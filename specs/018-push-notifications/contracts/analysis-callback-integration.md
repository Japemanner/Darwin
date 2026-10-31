# Contract: integratie in `analysis-run-callback`

**Feature**: 018-push-notifications | **Datum**: 2026-10-31

## Context

De n8n-flow meldt resultaat en fout via `POST /functions/v1/analysis-run-callback`
(zie `specs/008-risico-analyse-ui/contracts/run-callback.md`). Die functie is
**niet in deze repository** aanwezig: er is geen `analysis_runs`-migratie en
geen callback-broncode. Of hij in het Supabase-project is gedeployed, moet via
Supabase MCP worden vastgesteld (Phase A1 van het plan).

Dit contract beschrijft de enige wijziging die deze feature in de callback
aanbrengt: na een **daadwerkelijke** statusovergang naar `succeeded` of
`failed` één melding versturen. De rest van het callbackgedrag blijft
ongewijzigd.

## Verplichte volgorde

1. Valideer de payload en werk `analysis_runs` bij (bestaand gedrag).
2. Bepaal of de update écht een overgang was — bijvoorbeeld met
   `UPDATE analysis_runs SET status = ... WHERE id = $1 AND status IN ('queued','running') RETURNING advisor_id`.
   Alleen dan volgt een melding.
3. Roep `push-send` aan (zie hieronder).
4. Retourneer de bestaande callbackrespons aan n8n.

Stap 2 is de idempotentie-eis (FR-019): een herhaalde callback voor dezelfde
run levert geen tweede melding op. Als de bestaande callback al idempotent is
(008: "de tweede wint niet van een succeeded-status"), is een extra
`WHERE`-voorwaarde op de update voldoende; er komt **geen** extra tabel of
deduplicatiemechanisme.

## Aanroep

```ts
// Pseudocode — geen nieuwe abstractie, één fetch in de bestaande handler.
async function notifyAnalysisOutcome(input: {
  advisorId: string;
  runId: string;
  outcome: "succeeded" | "failed";
}): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/push-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Push-Token": Deno.env.get("PUSH_SEND_TOKEN")!,
      },
      body: JSON.stringify({
        user_id: input.advisorId,
        kind: input.outcome === "succeeded" ? "analysis_succeeded" : "analysis_failed",
        url: `/analyse/${input.runId}`,
      }),
      signal: controller.signal,
    });
  } catch {
    // Bewust stil: een pushfout mag de callback nooit laten falen.
    console.error(JSON.stringify({ code: "PUSH_SEND_FAILED" }));
  } finally {
    clearTimeout(timer);
  }
}
```

Aanroep na de geslaagde update:

```ts
await notifyAnalysisOutcome({
  advisorId: run.advisor_id,
  runId: run.id,
  outcome: status === "ok" ? "succeeded" : "failed",
});
```

## Harde eisen

| Eis | Reden |
|---|---|
| Alleen na een echte statusovergang | FR-019; geen dubbele meldingen |
| `advisor_id` komt uit de run-rij, nooit uit de n8n-payload | FR-007; een melding gaat alleen naar de startende adviseur |
| Timeout van 5 s, fout wordt opgevangen | FR-013; callback faalt nooit door push |
| Geen `await` op de responsinhoud | De callback heeft de aantallen niet nodig |
| Geen klantgegevens in de logregel | Constitution III |
| `PUSH_SEND_TOKEN` als Supabase secret | Voorkomt misbruik van de service-role-functie |
| Geen wijziging aan de n8n-flow of het callback-payloadformaat | Buiten scope |

## Als de callback niet bestaat

Dan wordt deze integratie **niet** verzonnen. `push-send`, de abonnementen en
de UI worden opgeleverd en getest; de hook blijft een gedocumenteerde
afhankelijkheid voor het backend dat `analysis-run-callback` beheert. De
oplevering vermeldt dit expliciet in FEATURES.md en het opleververslag.
