"use client"

import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts"
import type { SkillState } from "@/lib/types"
import { masteryColor } from "@/lib/skills"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

const chartConfig = {
  mastery: { label: "Mastery" },
} satisfies ChartConfig

export function SkillBarChart({ skills }: { skills: SkillState[] }) {
  const data = skills.map((s) => ({
    skill: s.zhLabel,
    mastery: s.mastery,
  }))

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <XAxis
          dataKey="skill"
          tickLine={false}
          axisLine={false}
          interval={0}
          tick={{ fontSize: 11 }}
          height={48}
        />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11 }} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="mastery" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={masteryColor(entry.mastery)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
