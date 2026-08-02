import { Quotes } from "@phosphor-icons/react";
import { getHistoricalCitation } from "../historicalCitations.js";

export function HistoricalCitation({ event, tone = "ink" }) {
  if (!event) return null;
  const citation = event.citation || getHistoricalCitation(event);

  return (
    <section className={`historical-citation historical-citation--${tone}`}>
      <span className="historical-citation__label">
        <Quotes weight="duotone" />
        {citation.kind}
      </span>
      <blockquote>“{citation.quote}”</blockquote>
      <a href={citation.url} target="_blank" rel="noreferrer">
        出处 · {citation.source}
      </a>
    </section>
  );
}
