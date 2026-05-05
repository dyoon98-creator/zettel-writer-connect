// Adapter barrel — re-export all interfaces and in-memory implementations.

export type {
  VaultAdapter,
  VaultEvent,
  VaultDirEntry,
} from "./VaultAdapter";
export type { NoticeAdapter } from "./NoticeAdapter";
export type { FrontmatterAdapter } from "./FrontmatterAdapter";
export type { ResultSink } from "./ResultSink";

export {
  InMemoryVaultAdapter,
  type InMemoryVaultAdapterOptions,
} from "./InMemoryVaultAdapter";
export {
  InMemoryNoticeAdapter,
  type CapturedNotice,
  type NoticeKind,
} from "./InMemoryNoticeAdapter";
export { InMemoryFrontmatterAdapter } from "./InMemoryFrontmatterAdapter";
