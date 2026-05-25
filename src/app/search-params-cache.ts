import "server-only";
import { createSearchParamsCache } from "nuqs/server";
import { paginationParsers } from "./search-params";

export const paginationSearchParams = createSearchParamsCache(
  paginationParsers,
);
