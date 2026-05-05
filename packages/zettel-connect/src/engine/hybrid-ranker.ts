import { App, Notice, TFile } from "obsidian";
import { Candidate, SeedInfo, VaultIndex } from "../types";
import { scoreStructural } from "./structural-score";
import { cosine, EmbeddingEngine, progressNotice } from "./embeddings";

function diagnoseOllama(reason: string): { short: string; hint: string } {
  const r = reason.toLowerCase();
  if (r.includes("연결 실패") || r.includes("econnrefused") || r.includes("fetch failed")) {
    return {
      short: "⚠ Ollama 서버 꺼짐 — 구조 점수만 사용",
      hint: "터미널에서 `ollama serve` 실행하거나 설정에서 임베딩을 OFF로.",
    };
  }
  if (r.includes("not found") || r.includes("없음") || r.includes("404")) {
    return {
      short: "⚠ Ollama 모델 없음 — 구조 점수만 사용",
      hint: "`ollama pull nomic-embed-text` 또는 설정에서 설치된 모델로 변경.",
    };
  }
  if (r.includes("embedding") && r.includes("지원")) {
    return {
      short: "⚠ 선택한 모델이 임베딩 미지원",
      hint: "임베딩 전용 모델(nomic-embed-text, bge-m3)로 바꾸세요.",
    };
  }
  return {
    short: "⚠ 의미 임베딩 실패 — 구조 점수만 사용",
    hint: reason,
  };
}

export interface HybridOptions {
  poolSize: number; // top N by structural score to re-rank
  topK: number; // final output size
  structuralWeight: number; // 0..1
  semanticWeight: number; // 0..1
}

export interface RankingResult {
  candidates: Candidate[];
  /** Non-fatal warnings (e.g. semantic layer fell back to structural). */
  warnings: string[];
}

/**
 * Hybrid ranker.
 *
 * Step 1 — Structural score produces up to `poolSize` candidates.
 * Step 2 — If embeddings are enabled, compute cosine similarity between
 *          seed claim and each candidate claim, then blend:
 *             final = α · normalize(structural) + (1-α) · cosine
 *          When disabled or unavailable, returns structural-only ranking.
 */
export async function rankHybrid(
  app: App,
  seed: SeedInfo,
  index: VaultIndex,
  embedder: EmbeddingEngine,
  options: HybridOptions,
  findFileById: (id: string) => TFile | null,
): Promise<RankingResult> {
  const warnings: string[] = [];
  const pool = scoreStructural(seed, index, options.poolSize);
  if (pool.length === 0) return { candidates: [], warnings };

  // Normalize structural score to [0, 1] based on pool min/max.
  const scores = pool.map((c) => c.score.structural);
  const sMin = Math.min(...scores);
  const sMax = Math.max(...scores);
  const range = sMax - sMin;
  const norm = (s: number) => (range === 0 ? 1 : (s - sMin) / range);

  const structuralOnly = (note?: string): RankingResult => {
    const out = pool
      .map((c) => ({
        ...c,
        score: { ...c.score, combined: c.score.structural },
      }))
      .slice(0, options.topK);
    if (note) warnings.push(note);
    return { candidates: out, warnings };
  };

  if (!embedder.isEnabled()) {
    return structuralOnly();
  }

  // Embed seed
  const notice = progressNotice(`🧠 의미 임베딩 (후보 ${pool.length}개 중)`);
  const seedVec = await embedder.embed(seed.claim);

  if (!seedVec) {
    const reason =
      embedder.lastError ??
      "알 수 없는 이유로 임베딩 제공자가 응답하지 않았습니다.";
    const { short, hint } = diagnoseOllama(reason);
    notice.done(short);
    new Notice(`${short}\n→ ${hint}`, 10000);
    return structuralOnly(`${short} — ${hint} (원인: ${reason})`);
  }

  // Embed pool in parallel (cached by mtime)
  const items = pool.map((c) => ({
    id: c.id,
    claim: c.claim,
    file: findFileById(c.id),
  }));
  const vecMap = await embedder.embedMany(items, 4, (d, t) =>
    notice.update(d, t),
  );
  const finalTopK = Math.min(options.topK, pool.length);
  notice.done(
    `🧠 ${pool.length}개 후보 중 상위 ${finalTopK}개 선정 완료`,
  );

  if (vecMap.size === 0) {
    return structuralOnly(
      `⚠ 후보 임베딩 모두 실패 — 구조 점수만 사용. 원인: ${embedder.lastError ?? "unknown"}`,
    );
  }

  // Compute blended scores
  const α = options.structuralWeight;
  const β = options.semanticWeight;

  const ranked = pool.map((c) => {
    const vec = vecMap.get(c.id);
    const sem = vec ? cosine(seedVec, vec) : 0;
    const combined = α * norm(c.score.structural) + β * sem;
    return {
      ...c,
      score: {
        structural: c.score.structural,
        semantic: sem,
        combined,
      },
      reasons: attachSemanticReason(c.reasons, sem),
    } as Candidate;
  });

  ranked.sort((a, b) => (b.score.combined ?? 0) - (a.score.combined ?? 0));
  return { candidates: ranked.slice(0, options.topK), warnings };
}

function attachSemanticReason(reasons: string[], sem: number): string[] {
  if (sem <= 0) return reasons;
  const label = `의미 유사도 ${sem.toFixed(2)}`;
  return [label, ...reasons];
}
