export const POINT_CHANGES = [0.5, -0.5] as const;

export function isPointChange(value: number): value is (typeof POINT_CHANGES)[number] {
  return POINT_CHANGES.some((change) => change === value);
}
