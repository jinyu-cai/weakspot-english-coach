"use client"

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { SkillState } from "@/lib/types"

export function WeaknessRadar({ skills }: { skills: SkillState[] }) {
  const data = skills.map((s) => ({ skill: s.zhLabel, mastery: s.mastery }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">能力雷达 Weakness radar</CardTitle>
        <CardDescription>各项技能掌握度的整体分布。</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{ mastery: { label: "掌握度", color: "var(--chart-1)" } }}
          className="mx-auto aspect-square max-h-[320px]"
        >
          <RadarChart data={data} outerRadius="72%">
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis
              dataKey="skill"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <Radar
              dataKey="mastery"
              fill="var(--color-mastery)"
              fillOpacity={0.35}
              stroke="var(--color-mastery)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
