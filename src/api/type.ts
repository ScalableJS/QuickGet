import type { components as SchemaComponents } from "./schema.js";

export type {
  ApiRequest,
  ApiResponse,
  components,
  operations,
  paths,
} from "./schema.js";

export type DownloadJob = SchemaComponents["schemas"]["DownloadJob"];
export type DownloadJobsListResponse = SchemaComponents["schemas"]["DownloadJobsListResponse"];
export type BaseResponse = SchemaComponents["schemas"]["BaseResponse"];
