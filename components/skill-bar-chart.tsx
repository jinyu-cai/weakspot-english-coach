"use client"

import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { masteryFill } from "@/lib/severity"
import type { SkillState } from "@/lib/types"

export function SkillBarChart({ skills }: { skills: SkillState[] }) {
  const data = [...skills]
    .sort((a, b) => a.mastery - b.mastery)
    .map((s) => ({ skill: s.zhLabel, mastery: s.mastery, fill: masteryFill(s.mastery) }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">技能掌握度 Skill mastery</CardTitle>
        <CardDescription>
          柱越短代表越薄弱。红色 &lt; 50，琥珀 &lt; 75，绿色为较好掌握。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{ mastery: { label: "掌握度" } }}
          className="h-[320px] w-full"
        >
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="skill"
              tickLine={false}
              axisLine={false}
              width={80}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="mastery" radius={6} barSize={22}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="mastery"
                position="right"
                className="fill-foreground"
                fontSize={12}
                formatter={(v: number) => `${v}%`}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
