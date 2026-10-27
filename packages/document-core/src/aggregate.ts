export const AGGREGATION_LABELS = {
  count: "연결 개수",
  count_values: "값 개수",
  count_unique: "고유 값 개수",
  count_empty: "빈 값 개수",
  count_not_empty: "비어 있지 않은 값 개수",
  percent_empty: "빈 값 비율",
  percent_not_empty: "비어 있지 않은 값 비율",
  sum: "합계",
  average: "평균",
  median: "중앙값",
  min: "최솟값",
  max: "최댓값",
  range: "범위",
  earliest_date: "가장 이른 날짜",
  latest_date: "가장 늦은 날짜",
  date_range: "날짜 범위 (일)",
  show_original: "원본 표시",
  show_unique: "고유 값 표시",
} as const;
export type Aggregation = keyof typeof AGGREGATION_LABELS;
export const NUMERIC_AGGREGATIONS: readonly Aggregation[] = [
  "sum",
  "average",
  "median",
  "min",
  "max",
  "range",
];
export const DATE_AGGREGATIONS: readonly Aggregation[] = [
  "earliest_date",
  "latest_date",
  "date_range",
];
export type AggregateValue =
  | string
  | number
  | boolean
  | null
  | Array<string | number | boolean | null>;
const empty = (value: AggregateValue | undefined) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && !value.length);

/** The caller supplies only authorized related rows. Zero and false are values. */
export function aggregateValues(
  values: Array<AggregateValue | undefined>,
  aggregation: Aggregation,
): AggregateValue {
  const flattened = values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(
      (value) => value !== undefined && value !== null && value !== "",
    ) as Array<string | number | boolean>;
  const filled = values.filter((value) => !empty(value)).length;
  const unique = [
    ...new Map(
      flattened.map((value) => [`${typeof value}:${String(value)}`, value]),
    ).values(),
  ];
  switch (aggregation) {
    case "count":
      return values.length;
    case "count_values":
      return flattened.length;
    case "count_unique":
      return unique.length;
    case "count_empty":
      return values.length - filled;
    case "count_not_empty":
      return filled;
    case "percent_empty":
      return values.length ? (values.length - filled) / values.length : 0;
    case "percent_not_empty":
      return values.length ? filled / values.length : 0;
    case "show_original":
      return flattened;
    case "show_unique":
      return unique;
  }
  if (DATE_AGGREGATIONS.includes(aggregation)) {
    const dates = flattened
      .filter(
        (v): v is string =>
          typeof v === "string" && Number.isFinite(Date.parse(v)),
      )
      .sort((a, b) => Date.parse(a) - Date.parse(b));
    if (!dates.length) return null;
    if (aggregation === "earliest_date") return dates[0]!;
    if (aggregation === "latest_date") return dates.at(-1)!;
    return (Date.parse(dates.at(-1)!) - Date.parse(dates[0]!)) / 86400000;
  }
  const numbers = flattened
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    )
    .sort((a, b) => a - b);
  if (!numbers.length) return aggregation === "sum" ? 0 : null;
  const sum = numbers.reduce((a, b) => a + b, 0);
  switch (aggregation) {
    case "sum":
      return sum;
    case "average":
      return sum / numbers.length;
    case "min":
      return numbers[0]!;
    case "max":
      return numbers.at(-1)!;
    case "range":
      return numbers.at(-1)! - numbers[0]!;
    case "median": {
      const mid = Math.floor(numbers.length / 2);
      return numbers.length % 2
        ? numbers[mid]!
        : (numbers[mid - 1]! + numbers[mid]!) / 2;
    }
    default:
      throw new Error("지원하지 않는 집계 방식입니다.");
  }
}
