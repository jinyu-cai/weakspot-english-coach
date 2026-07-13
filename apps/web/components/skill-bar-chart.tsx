"use client"

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"
import type { SkillState } from "@/lib/types"
import { masteryColor, sortByMasteryAsc } from "@/lib/skills"
import { skillLabel as localizedSkillLabel } from "@/lib/practice"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { useLanguage } from "@/components/language-provider"

const ROW_HEIGHT = 42
const CHART_PADDING = 84
const MIN_CHART_HEIGHT = 320
const LABEL_LINE_LENGTH = 16
const LABEL_WIDTH = 156

type SkillTickProps = {
  x?: number
  y?: number
  payload?: {
    value?: string | number
  }
}

function wrapSkillLabel(label: string): string[] {
  const words = label
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => {
      if (word.length <= LABEL_LINE_LENGTH) return [word]
      return Array.from(
        { length: Math.ceil(word.length / LABEL_LINE_LENGTH) },
        (_, index) => word.slice(index * LABEL_LINE_LENGTH, (index + 1) * LABEL_LINE_LENGTH),
      )
    })

  if (label.length <= LABEL_LINE_LENGTH) {
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

  return lines
}

function SkillTick({ x = 0, y = 0, payload }: SkillTickProps) {
  const lines = wrapSkillLabel(String(payload?.value ?? ""))
  const firstLineOffset = 4 - ((lines.length - 1) * 6)

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
  const { language, t } = useLanguage()
  const chartConfig = {
    mastery: { label: t.common.mastery },
  } satisfies ChartConfig
  const data = sortByMasteryAsc(skills).map((s) => ({
    skill: localizedSkillLabel(s.skillCode, language),
    mastery: s.mastery,
  }))
  const maxLabelLines = Math.max(1, ...data.map((entry) => wrapSkillLabel(entry.skill).length))
  const rowHeight = Math.max(ROW_HEIGHT, (maxLabelLines * 12) + 22)
  const chartHeight = Math.max(MIN_CHART_HEIGHT, data.length * rowHeight + CHART_PADDING)

  return (
    <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height: chartHeight }}>
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 20, left: 12, bottom: 8 }}
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
          width={LABEL_WIDTH}
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
