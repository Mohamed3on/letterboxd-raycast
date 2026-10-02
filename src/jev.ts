import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Title } from "./catalog";

/** Jev's top pick is acted on alone (opened) at this probability; below it, a clear lead is only preselected. */
const SURE = 0.8;

/** The TypeSafe API key: the extension preference, else `TYPESAFE_API_KEY` in ~/.config/typesafe/env. */
export function typesafeKey(preference?: string): string | undefined {
  if (preference?.trim()) return preference.trim();
  try {
    return readFileSync(join(homedir(), ".config/typesafe/env"), "utf8")
      .match(/^TYPESAFE_API_KEY=(.+)$/m)?.[1]
      .trim();
  } catch {
    return undefined;
  }
}

/**
 * Jev's (TypeSafe's) probability for each option, or undefined without a key, after 1.5 s, or on any error: this sits
 * on an interactive path, so callers just carry on as if it weren't there.
 */
async function jevChoice(
  key: string | undefined,
  state: unknown,
  instructions: string,
  options: Record<string, string>,
) {
  if (!key) return undefined;
  try {
    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "jev-latest",
        state,
        questions: {
          pick: { type: "choice", instructions, criteria: options },
        },
      }),
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return undefined;
    const { answers } = (await response.json()) as {
      answers: { pick: { probabilities: Record<string, number> } };
    };
    return answers.pick.probabilities;
  } catch {
    return undefined;
  }
}

const describe = (title: Title) =>
  [
    `“${title.name}”`,
    title.originalName && title.originalName !== title.name && `(original title “${title.originalName}”)`,
    `${title.kind === "film" ? "film" : "TV show"}, ${title.year ?? "year unknown"},`,
    `${title.votes ?? 0} votes`,
  ]
    .filter(Boolean)
    .join(" ");

/**
 * Jev's pick of the film or show a selection names, for when no title matches it outright (a year or director in the
 * selection, a sequel numbered differently, a dropped accent or colon): the title, and whether it's sure enough to
 * open. Null when it picks none of them, or its pick doesn't clearly lead (twice the runner-up); undefined when Jev
 * can't be asked.
 */
export async function guessTitle(titles: Title[], selection: string, key: string | undefined) {
  const options = Object.fromEntries(titles.map((title, i) => [`t${i}`, describe(title)]));
  const probabilities = await jevChoice(
    key,
    { selection },
    "`selection` is text someone highlighted to open one film or TV show. Which search result is it? Its title may be partial, misspelled, missing accents or punctuation, or number a sequel differently, and words around the title only help identify it: a year, a director or actor, a network or streaming service (HBO, FX, Netflix), or words like film, series or miniseries.",
    {
      ...options,
      none: "None of them: `selection` names a different film or show, a person, or something that isn't a title",
    },
  );
  if (!probabilities) return undefined;
  const [[label, p], [, runnerUp] = ["", 0]] = Object.entries(probabilities).sort(([, a], [, b]) => b - a);
  if (label === "none" || p < 2 * runnerUp) return null;
  return { title: titles[Number(label.slice(1))], sure: p >= SURE };
}
