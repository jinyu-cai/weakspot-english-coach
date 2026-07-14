import type { CoachPictureMission } from "@/lib/types"

type SceneProps = {
  assetKey: CoachPictureMission["assetKey"]
  title: string
}

function RainyBusStop() {
  return (
    <>
      <rect width="720" height="540" fill="#eef3ee" />
      <rect y="360" width="720" height="180" fill="#cbd9d2" />
      <path d="M0 405C120 380 220 430 340 402C470 372 570 422 720 390V540H0Z" fill="#b5cac5" />
      <g stroke="#99b5b2" strokeWidth="4" strokeLinecap="round" opacity=".72">
        {Array.from({ length: 14 }, (_, index) => (
          <path key={index} d={`M${34 + index * 51} ${30 + (index % 3) * 12}l-18 35`} />
        ))}
      </g>
      <rect x="96" y="162" width="404" height="24" rx="12" fill="#7f6555" />
      <path d="M124 186v230M472 186v230" stroke="#685346" strokeWidth="15" strokeLinecap="round" />
      <rect x="116" y="196" width="366" height="176" rx="18" fill="#f8f1df" fillOpacity=".58" stroke="#d3c7ae" strokeWidth="5" />
      <rect x="142" y="324" width="282" height="22" rx="11" fill="#9d725d" />
      <path d="M176 346v54M390 346v54" stroke="#815d4c" strokeWidth="12" strokeLinecap="round" />
      <circle cx="268" cy="250" r="33" fill="#b96d50" />
      <path d="M235 286c17-25 53-28 73-2l22 75h-114z" fill="#d99167" />
      <path d="M269 282v76" stroke="#765046" strokeWidth="12" strokeLinecap="round" />
      <path d="M250 357l-22 68M294 357l25 68" stroke="#504f4d" strokeWidth="15" strokeLinecap="round" />
      <path d="M260 214c8-18 37-21 48-1" stroke="#544741" strokeWidth="12" strokeLinecap="round" />
      <path d="M358 190c30-51 87-51 118 0" fill="none" stroke="#d7a642" strokeWidth="11" strokeLinecap="round" />
      <path d="M352 190h132c-5 38-31 62-66 62s-61-24-66-62z" fill="#e6ba58" />
      <path d="M605 326c-24-8-50 1-66 22l-18 26 92 1z" fill="#6d907d" />
      <circle cx="586" cy="304" r="29" fill="#7f513e" />
      <path d="M561 299c8-25 40-34 57-9" stroke="#3f3a37" strokeWidth="12" strokeLinecap="round" />
      <path d="M554 350l-22 75M603 353l25 72" stroke="#4d5661" strokeWidth="15" strokeLinecap="round" />
      <rect x="536" y="358" width="46" height="52" rx="8" fill="#cf785d" />
      <g fill="#88a9ac">
        <ellipse cx="82" cy="445" rx="42" ry="10" />
        <ellipse cx="468" cy="456" rx="58" ry="12" />
        <ellipse cx="646" cy="428" rx="38" ry="9" />
      </g>
    </>
  )
}

function MarketMorning() {
  return (
    <>
      <rect width="720" height="540" fill="#f6ecd7" />
      <rect y="380" width="720" height="160" fill="#d8c9ad" />
      <path d="M54 128h416l-32 96H85z" fill="#d96f55" />
      <path d="M54 128h416" stroke="#7b5142" strokeWidth="12" strokeLinecap="round" />
      <path d="M102 128l-16 96M166 128l-14 96M230 128l-10 96M294 128l-6 96M358 128v96M422 128l10 96" stroke="#fff3dc" strokeWidth="25" opacity=".8" />
      <rect x="92" y="224" width="353" height="160" rx="14" fill="#a46b50" />
      <rect x="109" y="248" width="318" height="92" rx="10" fill="#f4d59a" />
      <g fill="#87a85c">
        <circle cx="145" cy="290" r="23" /><circle cx="188" cy="286" r="20" /><circle cx="232" cy="295" r="24" />
      </g>
      <g fill="#dd7857">
        <circle cx="291" cy="287" r="21" /><circle cx="332" cy="294" r="24" /><circle cx="378" cy="286" r="20" />
      </g>
      <circle cx="252" cy="206" r="34" fill="#8d5a45" />
      <path d="M218 242c14-27 56-33 78-7l23 75H197z" fill="#6d9478" />
      <path d="M228 197c8-25 43-31 58-6" stroke="#403d38" strokeWidth="13" strokeLinecap="round" />
      <path d="M285 273l80 32" stroke="#8d5a45" strokeWidth="14" strokeLinecap="round" />
      <circle cx="513" cy="284" r="35" fill="#c27a59" />
      <path d="M474 325c19-29 67-28 83 4l27 99H448z" fill="#d49b56" />
      <path d="M486 278c5-29 43-40 63-16" stroke="#665047" strokeWidth="13" strokeLinecap="round" />
      <path d="M478 347l-46 49M546 348l53 33" stroke="#c27a59" strokeWidth="14" strokeLinecap="round" />
      <path d="M479 425l-15 83M550 425l17 83" stroke="#4b5561" strokeWidth="17" strokeLinecap="round" />
      <rect x="603" y="226" width="70" height="154" rx="9" fill="#6d8ea1" />
      <rect x="615" y="241" width="46" height="64" rx="5" fill="#d8ebea" />
      <path d="M620 334h36" stroke="#f1d382" strokeWidth="9" strokeLinecap="round" />
    </>
  )
}

function KitchenSurprise() {
  return (
    <>
      <rect width="720" height="540" fill="#f2e7d7" />
      <rect y="356" width="720" height="184" fill="#d8b99a" />
      <rect x="45" y="78" width="220" height="238" rx="16" fill="#c58d6d" />
      <rect x="66" y="100" width="78" height="84" rx="8" fill="#f7eddc" />
      <rect x="164" y="100" width="78" height="84" rx="8" fill="#f7eddc" />
      <rect x="66" y="203" width="176" height="92" rx="8" fill="#a77359" />
      <rect x="315" y="108" width="350" height="37" rx="12" fill="#8a6a57" />
      <path d="M347 145v93M620 145v93" stroke="#7b5f4f" strokeWidth="13" strokeLinecap="round" />
      <rect x="304" y="237" width="374" height="120" rx="15" fill="#f9f0df" />
      <ellipse cx="464" cy="272" rx="84" ry="28" fill="#bf6b4f" />
      <ellipse cx="464" cy="264" rx="70" ry="23" fill="#edb457" />
      <path d="M408 254c17-30 37-43 57-43 23 0 44 14 62 43" fill="#f2d08d" />
      <circle cx="488" cy="200" r="8" fill="#db7c5c" />
      <circle cx="454" cy="190" r="8" fill="#db7c5c" />
      <circle cx="519" cy="223" r="8" fill="#db7c5c" />
      <circle cx="228" cy="350" r="36" fill="#986044" />
      <path d="M186 392c21-31 70-34 92-2l31 112H155z" fill="#76937b" />
      <path d="M198 343c9-30 48-38 67-14" stroke="#4a423d" strokeWidth="14" strokeLinecap="round" />
      <path d="M196 414l-64-25M267 411l71-50" stroke="#986044" strokeWidth="15" strokeLinecap="round" />
      <circle cx="340" cy="358" r="12" fill="#e6c16f" />
      <path d="M132 389l-41-38" stroke="#6f9275" strokeWidth="11" strokeLinecap="round" />
      <path d="M99 334l-8 17 17-2" fill="none" stroke="#6f9275" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M557 428c23-26 63-26 86 0" fill="#d16f58" />
      <circle cx="599" cy="397" r="31" fill="#b66f50" />
      <path d="M572 394c7-27 41-34 58-13" stroke="#4a423d" strokeWidth="12" strokeLinecap="round" />
      <path d="M578 424l-38 48M624 424l34 48" stroke="#b66f50" strokeWidth="13" strokeLinecap="round" />
    </>
  )
}

export function CoachScene({ assetKey, title }: SceneProps) {
  const accessibilityDescriptions: Record<string, string> = {
    market_morning: "At a warm outdoor produce market, a vendor stands behind fruit and vegetables while a shopper gestures toward the stall. Another person is nearby beside a public notice board.",
    rainy_bus_stop: "At a city bus stop in heavy rain, one person waits under the shelter with an umbrella while another approaches carrying a bag. Puddles cover the road.",
    kitchen_surprise: "In a home kitchen after a small cooking surprise, two people react beside a counter with a decorated dish, scattered clues, and an object that appears to have fallen.",
  }
  const content = assetKey === "market_morning"
    ? <MarketMorning />
    : assetKey === "kitchen_surprise"
      ? <KitchenSurprise />
      : <RainyBusStop />

  return (
    <figure className="overflow-hidden rounded-3xl border border-border bg-muted/40 shadow-sm">
      <svg
        role="img"
        aria-labelledby={`coach-scene-title-${assetKey} coach-scene-description-${assetKey}`}
        viewBox="0 0 720 540"
        className="aspect-4/3 h-auto w-full object-contain"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={`coach-scene-title-${assetKey}`}>{title}</title>
        <desc id={`coach-scene-description-${assetKey}`}>
          {accessibilityDescriptions[assetKey] ?? "A first-party illustration for an English description mission."}
        </desc>
        {content}
      </svg>
    </figure>
  )
}
