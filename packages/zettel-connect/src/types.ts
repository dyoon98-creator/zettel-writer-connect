export interface VaultNote {
  id: string;
  claim: string;
  cluster: string;
  tags: string[];
  links: string[];
}

export interface CandidateScore {
  structural: number;
  semantic?: number;
  combined: number;
}

export interface Candidate {
  id: string;
  claim: string;
  cluster: string;
  tags: string[];
  score: CandidateScore;
  reasons: string[];
}

export interface VaultIndex {
  notes: Map<string, VaultNote>;
  /** backlinks[id] = set of ids that link TO id */
  backlinks: Map<string, Set<string>>;
  /** ids that appeared more than once in VAULT_INDEX — collisions */
  duplicateIds: Set<string>;
  /** lastParsedAt epoch ms */
  loadedAt: number;
}

export interface SeedInfo {
  id: string;
  claim: string;
  cluster: string;
  tags: string[];
  links: string[];
  /** true if the seed is a raw/fleeting note (no Folgezettel id).
   *  For raw notes `id` is a synthetic value derived from the filename. */
  isRaw: boolean;
  /** Vault-relative path of the seed file (used when promoting raw → permanent). */
  sourcePath: string;
}
