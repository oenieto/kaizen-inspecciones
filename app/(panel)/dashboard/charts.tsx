"use client"

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const ejes = { fontSize: 12, stroke: "var(--muted-foreground)" }
const tooltip = { borderRadius: 8, border: "1px solid var(--border)", boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)", fontSize: 13 }

export function DictamenesPorMes({ data }: { data: { mes: string; cumple: number; noCumple: number }[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="mes" tickLine={false} axisLine={false} {...ejes} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} {...ejes} />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="cumple" name="Cumple" stackId="a" fill="var(--chart-1)" />
          <Bar dataKey="noCumple" name="No cumple" stackId="a" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ProductividadInspectores({ data }: { data: { inspector: string; dictaminadas: number; pendientes: number }[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} {...ejes} />
          <YAxis type="category" dataKey="inspector" tickLine={false} axisLine={false} width={110} {...ejes} />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="dictaminadas" name="Dictaminadas" fill="var(--chart-1)" radius={[0, 6, 6, 0]} barSize={14} />
          <Bar dataKey="pendientes" name="Pendientes" fill="var(--chart-2)" radius={[0, 6, 6, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
