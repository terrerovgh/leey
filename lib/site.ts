/** Canonical site constants — used by UI, SEO and contact CTAs. */
export const SITE = {
  domain: "leeyhernandez.com",
  url: "https://leeyhernandez.com",
  agent: {
    fullName: "Leyanis Hernandez",
    shortName: "Leey",
    displayName: 'Leyanis “Leey” Hernandez',
    title: "Realtor",
    phoneDisplay: "(229) 890-8062",
    phoneTel: "+12298908062",
    email: "leey@lockandkeyrealty.com",
    portrait: "/assets/leey-portrait.jpg",
  },
  brokerage: {
    name: "Lock & Key Realty",
    legalName: "Lock and Key Realty",
    url: "https://lockandkeyrealty.com/",
    /** Transparent PNG for light backgrounds */
    logo: "/assets/lock-and-key-logo.png",
    /** Original on black — use on dark surfaces if needed */
    logoDark: "/assets/lock-and-key-logo-dark.png",
  },
  areas: [
    "Valdosta",
    "Hahira",
    "Adel",
    "Sparks",
    "Lenox",
    "Ray City",
    "Moultrie",
    "Thomasville",
    "Nashville",
    "Tifton",
  ] as const,
  states: ["Georgia", "Florida"] as const,
  zillow: {
    /** Public agent profile URL — set when known; used by sync script */
    profileUrl: null as string | null,
    agentName: "Leyanis Hernandez",
    location: "Valdosta, GA",
  },
} as const;
