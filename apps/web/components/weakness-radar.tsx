"use client"

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts"
import type { SkillState } from "@/lib/types"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

const chartConfig = {
  mastery: { label: "Mastery", color: "var(--chart-1)" },
} satisfies ChartConfig

export function WeaknessRadar({ skills }: { skills: SkillState[] }) {
  const data = skills.map((s) => ({
    skill: s.label,
    mastery: s.mastery,
  }))

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square h-72">
      <RadarChart data={data} outerRadius="70%">
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <PolarGrid />
        <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
        <Radar
          dataKey="mastery"
          fill="var(--color-mastery)"
          fillOpacity={0.5}
          stroke="var(--color-mastery)"
          strokeWidth={2}
          dot={{ r: 3, fillOpacity: 1 }}
        />
      </RadarChart>
    </ChartContainer>
  )
}
