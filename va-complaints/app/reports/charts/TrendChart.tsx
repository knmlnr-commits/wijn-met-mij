"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/reports/mi";
import styles from "../reports.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`;

const TICK = { fontFamily: "var(--font-body)", fontSize: 11, fill: "var(--text-muted)" };
const MARGIN = { top: 8, right: 12, bottom: 0, left: 0 };

interface TipProps {
  active?: boolean;
  label?: string | number;
  payload?: readonly { payload?: TrendPoint }[];
}

function Tip({ active, label, payload }: TipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className={styles.tooltip}>
      <strong>{monthLabel(String(label))}</strong>
      <span>Received: {point.received}</span>
      <span>
        Within deadline:{" "}
        {point.percentInTime === null ? "no final responses yet" : `${point.percentInTime.toFixed(1)}% of ${point.finalResponses}`}
      </span>
    </div>
  );
}

/**
 * Complaints received per month (bars) and, underneath on the same months, the share of final
 * responses within deadline (line). Two panels, so each measure keeps its own honest scale;
 * hovering one shows the same month in the other.
 */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const interval = points.length > 8 ? Math.ceil(points.length / 7) - 1 : 0;
  return (
    <div className={styles.trend}>
      <h3 className={styles.panelTitle}>Complaints received</h3>
      <div className={styles.trendPanel} role="img" aria-label={`Complaints received per month: ${points.map((p) => `${monthLabel(p.month)} ${p.received}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} syncId="trend" margin={MARGIN} barCategoryGap="25%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={interval} />
            <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} width={34} />
            <Tooltip content={<Tip />} cursor={{ fill: "var(--chart-track)" }} />
            <Bar dataKey="received" name="Received" fill="var(--chart-navy)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3 className={styles.panelTitle}>Final responses within deadline, by month received</h3>
      <div
        className={styles.trendPanelSmall}
        role="img"
        aria-label={`Percent of final responses within deadline per month received: ${points
          .map((p) => `${monthLabel(p.month)} ${p.percentInTime === null ? "none" : `${p.percentInTime}%`}`)
          .join(", ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} syncId="trend" margin={MARGIN}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="month" scale="band" tickFormatter={monthLabel} tick={TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={interval} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} tick={TICK} tickLine={false} axisLine={false} width={34} />
            <Tooltip content={<Tip />} cursor={{ stroke: "var(--border)" }} />
            <Line
              dataKey="percentInTime"
              name="Within deadline"
              type="linear"
              stroke="var(--chart-turquoise)"
              strokeWidth={2}
              connectNulls
              dot={{ r: 4, fill: "var(--chart-turquoise)", stroke: "var(--surface)", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className={styles.tableToggle}>
        <summary>Show these figures as a table</summary>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col" className="num">Received</th>
                <th scope="col" className="num">Final responses</th>
                <th scope="col" className="num">Within deadline</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.month}>
                  <th scope="row">{monthLabel(p.month)}</th>
                  <td className="num">{p.received}</td>
                  <td className="num">{p.finalResponses}</td>
                  <td className="num">{p.percentInTime === null ? "Not applicable" : `${p.percentInTime.toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
