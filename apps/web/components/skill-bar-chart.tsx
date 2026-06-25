"use client"

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"
import type { SkillState } from "@/lib/types"
import { masteryColor, sortByMasteryAsc } from "@/lib/skills"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

const chartConfig = {
  mastery: { label: "Mastery" },
} satisfies ChartConfig

const ROW_HEIGHT = 42
const CHART_PADDING = 84
const MIN_CHART_HEIGHT = 320
const LABEL_LINE_LENGTH = 16

type SkillTickProps = {
  x?: number
  y?: number
  payload?: {
    value?: string | number
  }
}

function wrapSkillLabel(label: string): string[] {
  const words = label.split(/\s+/).filter(Boolean)

  if (words.length <= 1 || label.length <= LABEL_LINE_LENGTH) {
    return [label]
  }

  const lines = words.reduce<string[]>((wrapped, word) => {
    const current = wrapped[wrapped.length - 1] ?? ""
    const next = current ? `${current} ${word}` : word

    if (!current || next.length <= LABEL_LINE_LENGTH) {
      wrapped[wrapped.length - 1] = next
      return wrapped
    }

    wrapped.push(word)
    return wrapped
  }, [""])

  if (lines.length <= 2) {
    return lines
  }

  return [lines[0], `${lines.slice(1).join(" ").slice(0, LABEL_LINE_LENGTH - 3)}...`]
}

function SkillTick({ x = 0, y = 0, payload }: SkillTickProps) {
  const lines = wrapSkillLabel(String(payload?.value ?? ""))
  const firstLineOffset = lines.length === 1 ? 4 : -5

  return (
    <text x={x} y={y + firstLineOffset} textAnchor="end" className="fill-muted-foreground text-[11px]">
      {lines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? 0 : 12}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

export function SkillBarChart({ skills }: { skills: SkillState[] }) {
  const data = sortByMasteryAsc(skills).map((s) => ({
    skill: s.label,
    mastery: s.mastery,
  }))
  const chartHeight = Math.max(MIN_CHART_HEIGHT, data.length * ROW_HEIGHT + CHART_PADDING)

  return (
    <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height: chartHeight }}>
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 20, left: 4, bottom: 8 }}
        barCategoryGap={10}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => `${value}`}
          allowDecimals={false}
        />
        <YAxis
          dataKey="skill"
          type="category"
          tickLine={false}
          axisLine={false}
          width={128}
          interval={0}
          tick={<SkillTick />}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="mastery" radius={[0, 6, 6, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={masteryColor(entry.mastery)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
