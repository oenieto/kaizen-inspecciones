"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { MapaRuta } from "@/components/mapa-ruta"
import { hora } from "@/lib/format"
import type { InspeccionFila } from "@/lib/types"

type Cita = InspeccionFila & { lat: number; lng: number; direccion: string }

function hoyISO() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function RutaDelDia({ citas, inspectores, mapboxToken }: { citas: Cita[]; inspectores: { id: string; nombre: string }[]; mapboxToken: string }) {
  const [dia, setDia] = useState(hoyISO)
  const [inspector, setInspector] = useState(inspectores[0]?.id ?? "")

  const paradas = useMemo(() => {
    const inicio = new Date(`${dia}T00:00:00`)
    const fin = new Date(inicio.getTime() + 86_400_000)
    return citas
      .filter((c) => c.inspectorId === inspector && new Date(c.fecha) >= inicio && new Date(c.fecha) < fin)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [citas, dia, inspector])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ruta del día</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Día" />
          <NativeSelect value={inspector} onChange={(e) => setInspector(e.target.value)} aria-label="Inspector" className="w-full">
            {inspectores.map((i) => (
              <NativeSelectOption key={i.id} value={i.id}>{i.nombre}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <MapaRuta token={mapboxToken} paradas={paradas.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, titulo: p.cliente }))} />
        <ol className="space-y-2">
          {paradas.map((p, i) => (
            <li key={p.id}>
              <Link href={`/inspecciones/${p.id}`} className="flex gap-3 rounded-md p-2 text-sm hover:bg-muted">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block font-medium">{hora(p.fecha)} · {p.cliente}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.instalacion} · {p.direccion}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
