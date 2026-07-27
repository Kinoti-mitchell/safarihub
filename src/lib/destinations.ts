export type DestinationGuide = {
  slug: string;
  countySlug: string;
  title: string;
  headline: string;
  blurb: string;
  bestSeason: string;
  weatherNote: string;
  safetyTips: string[];
  highlights: string[];
};

/** Curated destination hubs mapped onto live counties. */
export const DESTINATION_GUIDES: DestinationGuide[] = [
  {
    slug: "maasai-mara",
    countySlug: "narok",
    title: "Maasai Mara",
    headline: "Savanna, big cats, and the Great Migration",
    blurb:
      "Kenya’s most iconic safari landscape — game drives, Maasai culture, and golden-hour plains in Narok County.",
    bestSeason: "Jul–Oct (migration); year-round for wildlife",
    weatherNote:
      "Cool mornings and warm afternoons. Pack layers, sun protection, and a light rain jacket in the long rains (Mar–May).",
    safetyTips: [
      "Book licensed operators and stay on marked tracks during game drives.",
      "Keep valuables in lodge safes; tip guides via your host.",
      "Emergency: 999 / 112 · Kenya Tourism Police: 020 604767",
    ],
    highlights: ["Safari lodges", "Game drives", "Cultural visits"],
  },
  {
    slug: "diani-south-coast",
    countySlug: "kwale",
    title: "Diani & South Coast",
    headline: "White sand, reefs, and palm-lined beaches",
    blurb:
      "Kwale’s coast around Diani is built for beach days, snorkelling, and slow evenings by the Indian Ocean.",
    bestSeason: "Dec–Mar & Jul–Oct for dry beach weather",
    weatherNote:
      "Hot and humid. Swim when lifeguards or hosts advise; watch reef currents and afternoon sun.",
    safetyTips: [
      "Use hotel/beach security for belongings; avoid isolated beaches after dark.",
      "Agree taxi or tuk-tuk fares before you ride.",
      "Emergency: 999 / 112 · Coast Guard via your hotel desk",
    ],
    highlights: ["Beach stays", "Water sports", "Seafood"],
  },
  {
    slug: "mombasa",
    countySlug: "mombasa",
    title: "Mombasa",
    headline: "Old Town spice, harbour energy, and coast culture",
    blurb:
      "Kenya’s coastal city — Fort Jesus, Swahili streets, and easy hops to nearby beaches.",
    bestSeason: "Jan–Mar & Jul–Oct",
    weatherNote:
      "Tropical heat year-round. Hydrate, cover up at midday, and expect short showers in the long rains.",
    safetyTips: [
      "Use registered taxis or ride-hailing after dark in the CBD.",
      "Keep phones and cameras secured in crowded markets.",
      "Emergency: 999 / 112",
    ],
    highlights: ["City stays", "Culture", "Day trips"],
  },
  {
    slug: "nakuru",
    countySlug: "nakuru",
    title: "Nakuru",
    headline: "Rift Valley lakes, flamingos, and highland air",
    blurb:
      "Lake Nakuru and the surrounding highlands — birdlife, rhino sanctuary vibes, and a base for Rift road trips.",
    bestSeason: "Jun–Oct & Dec–Feb",
    weatherNote:
      "Cooler than the coast. Mornings can be misty; bring a jacket for early game drives.",
    safetyTips: [
      "Stick to park rules and vehicle guides inside national parks.",
      "Altitude and sun can dehydrate — carry water.",
      "Emergency: 999 / 112",
    ],
    highlights: ["Park lodges", "Birding", "Scenic drives"],
  },
  {
    slug: "nairobi",
    countySlug: "nairobi",
    title: "Nairobi",
    headline: "City base for safaris, food, and nightlife",
    blurb:
      "Kenya’s capital — national park on the edge of town, great dining, and the usual launchpad for onward trips.",
    bestSeason: "Year-round; Jul–Oct for cooler dry days",
    weatherNote:
      "Mild highland climate. Evenings can be cool; afternoon thunderstorms are common in the rains.",
    safetyTips: [
      "Use hotel-recommended transport at night.",
      "Keep bags zipped in markets and matatu areas.",
      "Emergency: 999 / 112 · Tourist helpline via your hotel",
    ],
    highlights: ["Urban stays", "Dining", "Day safaris"],
  },
  {
    slug: "laikipia",
    countySlug: "laikipia",
    title: "Laikipia",
    headline: "Conservancies, walking safaris, and big skies",
    blurb:
      "North of Mt Kenya — exclusive conservancies, rhino projects, and intimate wildlife experiences.",
    bestSeason: "Jun–Oct & Jan–Feb",
    weatherNote:
      "Dry and dusty in peak season; nights are cold — pack warm layers.",
    safetyTips: [
      "Follow camp briefing rules on walking safaris.",
      "Malaria risk varies — ask your host about prophylaxis.",
      "Emergency: 999 / 112 · Camp radio / sat phone via lodge",
    ],
    highlights: ["Conservancy stays", "Walking safaris", "Star skies"],
  },
  {
    slug: "kisumu",
    countySlug: "kisumu",
    title: "Kisumu & Lake Victoria",
    headline: "Lakeside city, fish markets, and western Kenya",
    blurb:
      "Gateway to Lake Victoria — sunsets, tilapia, and a gentler pace than Nairobi or the Mara.",
    bestSeason: "Dec–Feb & Jun–Sep",
    weatherNote:
      "Warm and humid by the lake. Evenings are sticky; light cotton works best.",
    safetyTips: [
      "Swim only in advised spots; lake currents and water quality vary.",
      "Use known boats and life jackets for lake trips.",
      "Emergency: 999 / 112",
    ],
    highlights: ["Lakeside stays", "Local food", "Island day trips"],
  },
  {
    slug: "lamu",
    countySlug: "lamu",
    title: "Lamu",
    headline: "UNESCO Swahili island — dhows and stone streets",
    blurb:
      "A car-free archipelago of coral stone, donkey taxis, and slow coastal living.",
    bestSeason: "Dec–Mar & Jul–Oct",
    weatherNote:
      "Hot days, sea breezes. Modest dress is appreciated in Old Town.",
    safetyTips: [
      "Respect local customs in mosques and Old Town lanes.",
      "Confirm boat transfers with your guesthouse.",
      "Emergency: 999 / 112",
    ],
    highlights: ["Heritage stays", "Dhow sails", "Quiet beaches"],
  },
];

export function guideBySlug(slug: string): DestinationGuide | undefined {
  return DESTINATION_GUIDES.find((g) => g.slug === slug);
}

export function guideByCountySlug(
  countySlug: string,
): DestinationGuide | undefined {
  return DESTINATION_GUIDES.find((g) => g.countySlug === countySlug);
}
