export interface GapsPanelProps {
  lacunes: string[]
}

export function GapsPanel({ lacunes }: GapsPanelProps) {
  return (
    <section
      aria-labelledby="gaps-panel-title"
      className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4"
    >
      <h3 id="gaps-panel-title" className="mb-3 text-base font-semibold">
        Ontbrekende informatie voor het gesprek
      </h3>
      {lacunes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Er is geen ontbrekende informatie vastgesteld.
        </p>
      ) : (
        <ul className="space-y-2">
          {lacunes.map((lacune, index) => (
            <li key={index} className="flex items-start gap-2">
              <input
                type="checkbox"
                id={`gap-${index}`}
                className="mt-0.5 rounded border-input"
                aria-label={lacune}
              />
              <label htmlFor={`gap-${index}`} className="cursor-pointer text-sm">
                {lacune}
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}