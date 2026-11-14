/** The R2 and Workers AI binding subsets this Worker uses, so it needs no platform type package. */
type R2Object = { key: string; size: number; etag: string; uploaded: Date };
type R2Body = R2Object & { text(): Promise<string>; json<T>(): Promise<T> };
export type Bucket = {
  get(key: string): Promise<R2Body | null>;
  put(
    key: string,
    value: string | ArrayBuffer | Uint8Array,
    options?: {
      httpMetadata?: { contentType?: string };
      onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string };
    },
  ): Promise<R2Object | null>;
};
export interface Ai {
  run(model: string, input: unknown): Promise<unknown>;
}
