import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const paginationParsers = {
  after: parseAsString,
  before: parseAsString,
};

export const paginationSearchParams = createSearchParamsCache(paginationParsers);
