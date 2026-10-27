export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "greater_than"
  | "greater_or_equal"
  | "less_than"
  | "less_or_equal";
export interface FilterRule {
  propertyId: string;
  operator: FilterOperator;
  value?: string | number | boolean | null;
}
export interface FilterGroup {
  conjunction: "and" | "or";
  rules: Array<FilterRule | FilterGroup>;
}
export interface SortRule {
  propertyId: string;
  direction: "ascending" | "descending";
}
export interface QueryRow {
  documentId: string;
  title: string;
  values: Record<string, unknown>;
}
export interface QueryProperty {
  id: string;
  type: string;
  options?: string[];
}
export interface DatabaseQuery {
  filter?: FilterGroup;
  sorts?: SortRule[];
  search?: string;
}
const operators: FilterOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "is_empty",
  "is_not_empty",
  "greater_than",
  "greater_or_equal",
  "less_than",
  "less_or_equal",
];
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Decode untrusted view/query JSON before recursion or property lookup. */
export function validateDatabaseQuery(
  value: unknown,
  properties: readonly QueryProperty[],
): asserts value is DatabaseQuery {
  if (!record(value)) throw new Error("조회 설정이 올바르지 않습니다.");
  const ids = new Set(["title", ...properties.map((p) => p.id)]);
  if (
    value.search !== undefined &&
    (typeof value.search !== "string" || value.search.length > 200)
  )
    throw new Error("검색어는 200자 이내로 입력하세요.");
  let count = 0;
  const validateGroup = (group: unknown, depth: number) => {
    if (
      !record(group) ||
      !["and", "or"].includes(String(group.conjunction)) ||
      !Array.isArray(group.rules) ||
      depth > 3
    )
      throw new Error(
        "필터 그룹은 AND/OR로 최대 3단계까지 구성할 수 있습니다.",
      );
    for (const rule of group.rules) {
      if (++count > 100 || !record(rule))
        throw new Error("필터 조건은 최대 100개입니다.");
      if ("conjunction" in rule) {
        validateGroup(rule, depth + 1);
        continue;
      }
      if (
        typeof rule.propertyId !== "string" ||
        !ids.has(rule.propertyId) ||
        !operators.includes(rule.operator as FilterOperator)
      )
        throw new Error("필터 속성 또는 연산자를 확인하세요.");
      if (
        rule.value !== undefined &&
        rule.value !== null &&
        !["string", "number", "boolean"].includes(typeof rule.value)
      )
        throw new Error("필터 비교 값이 올바르지 않습니다.");
      if (
        (typeof rule.value === "number" && !Number.isFinite(rule.value)) ||
        (typeof rule.value === "string" && rule.value.length > 1000)
      )
        throw new Error("필터 비교 값의 범위를 확인하세요.");
    }
  };
  if (value.filter !== undefined) validateGroup(value.filter, 1);
  if (
    value.sorts !== undefined &&
    (!Array.isArray(value.sorts) ||
      value.sorts.length > 20 ||
      !value.sorts.every(
        (sort) =>
          record(sort) &&
          typeof sort.propertyId === "string" &&
          ids.has(sort.propertyId) &&
          ["ascending", "descending"].includes(String(sort.direction)),
      ))
  )
    throw new Error("정렬 속성과 방향을 확인하세요.");
}

const normalize = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase();
const empty = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && !value.length);
const field = (row: QueryRow, id: string) =>
  id === "title" ? row.title : row.values[id];
function matches(row: QueryRow, rule: FilterRule | FilterGroup): boolean {
  if ("conjunction" in rule) {
    // An empty group does not hide every row while the user is editing it.
    if (!rule.rules.length) return true;
    return rule.conjunction === "and"
      ? rule.rules.every((child) => matches(row, child))
      : rule.rules.some((child) => matches(row, child));
  }
  const actual = field(row, rule.propertyId),
    expected = rule.value;
  switch (rule.operator) {
    case "is_empty":
      return empty(actual);
    case "is_not_empty":
      return !empty(actual);
    case "equals":
      return typeof actual === "string" && typeof expected === "string"
        ? normalize(actual) === normalize(expected)
        : actual === expected;
    case "not_equals":
      return !matches(row, { ...rule, operator: "equals" });
    case "contains":
      return Array.isArray(actual)
        ? actual.some((value) => normalize(value) === normalize(expected))
        : normalize(actual).includes(normalize(expected));
    case "not_contains":
      return !matches(row, { ...rule, operator: "contains" });
    case "starts_with":
      return normalize(actual).startsWith(normalize(expected));
    case "ends_with":
      return normalize(actual).endsWith(normalize(expected));
    default: {
      if (empty(actual) || expected === null || expected === undefined)
        return false;
      let comparison: number;
      if (typeof actual === "number" && typeof expected === "number")
        comparison = actual - expected;
      else if (typeof actual === "string" && typeof expected === "string")
        comparison = actual === expected ? 0 : actual > expected ? 1 : -1;
      else return false;
      return rule.operator === "greater_than"
        ? comparison > 0
        : rule.operator === "greater_or_equal"
          ? comparison >= 0
          : rule.operator === "less_than"
            ? comparison < 0
            : comparison <= 0;
    }
  }
}

/** Operates only on the already authorized row set supplied by the caller. */
export function queryDatabaseRows<T extends QueryRow>(
  rows: readonly T[],
  properties: readonly QueryProperty[],
  query: DatabaseQuery,
): T[] {
  validateDatabaseQuery(query, properties);
  const propertiesById = new Map(properties.map((prop) => [prop.id, prop]));
  const search = normalize(query.search ?? "");
  const result = rows.filter(
    (row) =>
      (!query.filter || matches(row, query.filter)) &&
      (!search ||
        [row.title, ...Object.values(row.values)].some((value) =>
          normalize(value).includes(search),
        )),
  );
  if (query.sorts?.length)
    result.sort((a, b) => {
      for (const sort of query.sorts ?? []) {
        const x = field(a, sort.propertyId),
          y = field(b, sort.propertyId);
        // Keep unset values at the end for both directions.
        if (empty(x) !== empty(y)) return empty(x) ? 1 : -1;
        const prop = propertiesById.get(sort.propertyId);
        let order: number;
        if (typeof x === "number" && typeof y === "number") order = x - y;
        else if (typeof x === "boolean" && typeof y === "boolean")
          order = Number(x) - Number(y);
        else if (
          prop?.options &&
          typeof x === "string" &&
          typeof y === "string"
        )
          order = prop.options.indexOf(x) - prop.options.indexOf(y);
        else
          order = normalize(x).localeCompare(normalize(y), "ko", {
            numeric: true,
          });
        if (order) return sort.direction === "descending" ? -order : order;
      }
      return a.documentId.localeCompare(b.documentId);
    });
  return result;
}
