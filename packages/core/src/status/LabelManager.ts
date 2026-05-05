// LabelManager — ProjectMeta.customLabels 의 순수 함수 매니저.
// StatusManager 와 동일 패턴이지만 customLabels 필드를 다룬다.

import { LabelDef, ProjectMeta } from "../project/schema";
import { isValidColor } from "./colors";

function cloneMeta(meta: ProjectMeta): ProjectMeta {
  return {
    ...meta,
    customStatuses: meta.customStatuses.map((s) => ({ ...s })),
    customLabels: meta.customLabels.map((l) => ({ ...l })),
    sourceNotes: [...meta.sourceNotes],
  };
}

export const LabelManager = {
  list(meta: ProjectMeta): LabelDef[] {
    return meta.customLabels.map((l) => ({ ...l }));
  },

  add(meta: ProjectMeta, label: LabelDef): ProjectMeta {
    if (!label.id || typeof label.id !== "string") {
      throw new Error("LabelManager.add: id가 필요합니다");
    }
    if (!label.name || typeof label.name !== "string") {
      throw new Error("LabelManager.add: name이 필요합니다");
    }
    if (!isValidColor(label.color)) {
      throw new Error(`LabelManager.add: 유효하지 않은 color: ${label.color}`);
    }
    if (meta.customLabels.some((l) => l.id === label.id)) {
      throw new Error(`LabelManager.add: 이미 존재하는 id: ${label.id}`);
    }
    const next = cloneMeta(meta);
    if (label.default) {
      for (const l of next.customLabels) l.default = false;
    }
    next.customLabels.push({ ...label });
    return next;
  },

  update(
    meta: ProjectMeta,
    id: string,
    patch: Partial<Omit<LabelDef, "id">>,
  ): ProjectMeta {
    const idx = meta.customLabels.findIndex((l) => l.id === id);
    if (idx === -1) {
      throw new Error(`LabelManager.update: id를 찾을 수 없습니다: ${id}`);
    }
    if (patch.color !== undefined && !isValidColor(patch.color)) {
      throw new Error(
        `LabelManager.update: 유효하지 않은 color: ${patch.color}`,
      );
    }
    const next = cloneMeta(meta);
    if (patch.default === true) {
      for (const l of next.customLabels) l.default = false;
    }
    const cur = next.customLabels[idx];
    next.customLabels[idx] = { ...cur, ...patch };
    return next;
  },

  remove(meta: ProjectMeta, id: string): ProjectMeta {
    const idx = meta.customLabels.findIndex((l) => l.id === id);
    if (idx === -1) {
      throw new Error(`LabelManager.remove: id를 찾을 수 없습니다: ${id}`);
    }
    if (meta.customLabels[idx].default) {
      throw new Error(
        `LabelManager.remove: default label은 제거할 수 없습니다`,
      );
    }
    const next = cloneMeta(meta);
    next.customLabels.splice(idx, 1);
    return next;
  },

  setDefault(meta: ProjectMeta, id: string): ProjectMeta {
    const idx = meta.customLabels.findIndex((l) => l.id === id);
    if (idx === -1) {
      throw new Error(`LabelManager.setDefault: id를 찾을 수 없습니다: ${id}`);
    }
    const next = cloneMeta(meta);
    for (const l of next.customLabels) l.default = false;
    next.customLabels[idx].default = true;
    return next;
  },

  getDefault(meta: ProjectMeta): LabelDef | null {
    const def = meta.customLabels.find((l) => l.default);
    if (def) return { ...def };
    if (meta.customLabels.length > 0) return { ...meta.customLabels[0] };
    return null;
  },

  exists(meta: ProjectMeta, id: string): boolean {
    return meta.customLabels.some((l) => l.id === id);
  },
};
