// StatusManager — ProjectMeta.customStatuses 의 순수 함수 매니저.
//
// 모든 함수는 immutable: 입력 meta 를 변경하지 않고 새 meta 를 반환한다.
// 검증 규칙:
//   - id 는 프로젝트 내 unique
//   - color 는 isValidColor 통과
//   - default 는 단 하나만
//   - default 로 표시된 status 는 제거 불가 (먼저 다른 항목을 default 로 지정 필요)

import { ProjectMeta, StatusDef } from "../project/schema";
import { isValidColor } from "./colors";

function cloneMeta(meta: ProjectMeta): ProjectMeta {
  return {
    ...meta,
    customStatuses: meta.customStatuses.map((s) => ({ ...s })),
    customLabels: meta.customLabels.map((l) => ({ ...l })),
    sourceNotes: [...meta.sourceNotes],
  };
}

export const StatusManager = {
  list(meta: ProjectMeta): StatusDef[] {
    return meta.customStatuses.map((s) => ({ ...s }));
  },

  /** 새 status 추가. id 중복 시 throw. */
  add(meta: ProjectMeta, status: StatusDef): ProjectMeta {
    if (!status.id || typeof status.id !== "string") {
      throw new Error("StatusManager.add: id가 필요합니다");
    }
    if (!status.name || typeof status.name !== "string") {
      throw new Error("StatusManager.add: name이 필요합니다");
    }
    if (!isValidColor(status.color)) {
      throw new Error(
        `StatusManager.add: 유효하지 않은 color: ${status.color}`,
      );
    }
    if (meta.customStatuses.some((s) => s.id === status.id)) {
      throw new Error(`StatusManager.add: 이미 존재하는 id: ${status.id}`);
    }
    const next = cloneMeta(meta);
    if (status.default) {
      // 기존 default 해제
      for (const s of next.customStatuses) s.default = false;
    }
    next.customStatuses.push({ ...status });
    return next;
  },

  /** 기존 status 의 일부 필드만 변경. */
  update(
    meta: ProjectMeta,
    id: string,
    patch: Partial<Omit<StatusDef, "id">>,
  ): ProjectMeta {
    const idx = meta.customStatuses.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw new Error(`StatusManager.update: id를 찾을 수 없습니다: ${id}`);
    }
    if (patch.color !== undefined && !isValidColor(patch.color)) {
      throw new Error(
        `StatusManager.update: 유효하지 않은 color: ${patch.color}`,
      );
    }
    const next = cloneMeta(meta);
    if (patch.default === true) {
      for (const s of next.customStatuses) s.default = false;
    }
    const cur = next.customStatuses[idx];
    next.customStatuses[idx] = { ...cur, ...patch };
    // patch.default 가 false 인 경우, 명시적으로 설정만 — 별도 default 가 없을 수 있음
    return next;
  },

  /** 항목 제거. default 항목은 거부. */
  remove(meta: ProjectMeta, id: string): ProjectMeta {
    const idx = meta.customStatuses.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw new Error(`StatusManager.remove: id를 찾을 수 없습니다: ${id}`);
    }
    if (meta.customStatuses[idx].default) {
      throw new Error(
        `StatusManager.remove: default status는 제거할 수 없습니다 (먼저 다른 항목에 default를 지정하세요)`,
      );
    }
    const next = cloneMeta(meta);
    next.customStatuses.splice(idx, 1);
    return next;
  },

  /** 특정 id 를 default 로 지정 (다른 default 는 자동 해제). */
  setDefault(meta: ProjectMeta, id: string): ProjectMeta {
    const idx = meta.customStatuses.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw new Error(`StatusManager.setDefault: id를 찾을 수 없습니다: ${id}`);
    }
    const next = cloneMeta(meta);
    for (const s of next.customStatuses) s.default = false;
    next.customStatuses[idx].default = true;
    return next;
  },

  /** default 로 지정된 항목, 없으면 첫 항목, 없으면 null. */
  getDefault(meta: ProjectMeta): StatusDef | null {
    const def = meta.customStatuses.find((s) => s.default);
    if (def) return { ...def };
    if (meta.customStatuses.length > 0) return { ...meta.customStatuses[0] };
    return null;
  },

  /** 특정 id 의 status 가 존재하는지. */
  exists(meta: ProjectMeta, id: string): boolean {
    return meta.customStatuses.some((s) => s.id === id);
  },
};
