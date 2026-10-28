import type { CSSProperties } from "react";
export type IconName =
  | "home"
  | "book"
  | "code"
  | "chart"
  | "arrow"
  | "check"
  | "clock"
  | "box"
  | "branch"
  | "repeat"
  | "spark"
  | "chevron"
  | "close"
  | "user";
const paths: Record<IconName, string> = {
  home: "m3 10 9-7 9 7v10H3V10m6 10v-7h6v7",
  book: "M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V6",
  code: "m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16",
  chart: "M4 3v17h17M8 16v-5m5 5V7m5 9V4",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  clock: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  box: "m3 7 9-4 9 4-9 5-9-5v10l9 4 9-4V7M12 12v9",
  branch: "M7 3v12m0 0-4-4m4 4 4-4M7 7h6a5 5 0 0 1 5 5v8m-4-4 4 4 4-4",
  repeat: "M4 9a8 8 0 0 1 14-4l2 3m0-5v5h-5M20 15A8 8 0 0 1 6 19l-2-3m0 5v-5h5",
  spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7",
  chevron: "m9 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  user: "M20 21a8 8 0 0 0-16 0m12-14a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
};
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
