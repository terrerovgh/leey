/** Canonical site constants — used by UI, SEO and contact CTAs. */
export const SITE = {
  domain: "leeyrealty.com",
  url: "https://leeyrealty.com",
  agent: {
    fullName: "Leyanis Hernandez",
    shortName: "Leey",
    displayName: 'Leyanis “Leey” Hernandez',
    title: "Realtor",
    phoneDisplay: "(404) 403-8306",
    phoneTel: "+14044038306",
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
    /** Public agent profile — Zillow username leey63 */
    profileUrl: "https://www.zillow.com/profile/leey63/" as string,
    agentName: "Leyanis Hernandez",
    username: "leey63",
    location: "Valdosta, GA",
  },
} as const;
