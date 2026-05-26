import {
  createSerializer,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [1, 25, 50, 100] as const;

export const paginationParsers = {
  size: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
  after: parseAsString,
  before: parseAsString,
  page: parseAsInteger.withDefault(1),
};

export const serializePagination = createSerializer(paginationParsers);
