// §82/§83/§84: "do not award points for unknown information." Every score
// in this module is assembled from named components so the portal can
// show exactly why a target was ranked the way it was — "explainable by
// construction," not by convention someone has to remember.
export interface ScoreComponent {
  name: string;
  points: number;
  max: number;
  evidence: string;
  known: boolean;
}

export interface ExplainableScore {
  score: number;
  max: number;
  components: ScoreComponent[];
  unknowns: string[];
}

export class UnknownAwardedPointsError extends Error {}

export function assemble(components: ScoreComponent[]): ExplainableScore {
  for (const c of components) {
    if (!c.known && c.points !== 0) {
      throw new UnknownAwardedPointsError(`Component '${c.name}' awarded ${c.points} points for unknown information — this is the exact thing §82/§83/§84 forbid`);
    }
  }
  return {
    score: components.reduce((sum, c) => sum + c.points, 0),
    // The denominator is never reduced for unknowns — an unknown visibly
    // costs score rather than silently shrinking the scale.
    max: components.reduce((sum, c) => sum + c.max, 0),
    components,
    unknowns: components.filter((c) => !c.known).map((c) => c.name),
  };
}
