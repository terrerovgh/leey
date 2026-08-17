import type { Strings } from "./es";

export const en: Strings = {
  nav: {
    home: "Home",
    listings: "Homes",
    blog: "Blog",
    about: "About",
    services: "Services",
    areas: "Areas",
    testimonials: "Stories",
    contact: "Contact",
    call: "Call",
    lang: "ES",
  },

  hero: {
    title: "Buy or sell in South Georgia with an agent who speaks your language.",
    subtitle:
      "Leyanis “Leey” Hernandez, Lock & Key Realty. Licensed in Georgia and Florida. Valdosta, Hahira, Adel, Sparks, Lenox, Ray City, Moultrie, Thomasville, Nashville, Tifton, and North Florida.",
    cta1: "View homes for sale",
    cta2: "Talk to Leey",
    speakEs: "Spanish and English service",
  },

  marquee: {
    items: [
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
      "North Florida",
    ],
  },

  about: {
    eyebrow: "About",
    title: "I’m Leey.",
    paragraph1:
      "My name is Leyanis Hernandez. I was born in Havana, Cuba, and immigrated to the United States in 1998. I’m a mother of two daughters and a son, and a grandmother to two granddaughters. With my husband, I run a home restoration and remodeling business in South Georgia.",
    paragraph2:
      "That builder’s eye is what I bring to every deal: not just a pretty address, but a solid home. I’m licensed in Georgia and Florida. I work in Spanish and English — calm process, clear numbers, no artificial rush.",
    signature: "Leey.",
  },

  services: {
    eyebrow: "Services",
    title: "How I work with you",
    items: [
      {
        title: "Buying",
        desc: "Local search, tours, offers, and closing. I filter what doesn’t fit and explain why.",
      },
      {
        title: "Selling",
        desc: "Honest pricing, home prep, and negotiation through the finish line — fewer surprises.",
      },
      {
        title: "First-time buyers",
        desc: "Financing, inspections, and paperwork in plain language. One step at a time.",
      },
      {
        title: "Georgia & Florida",
        desc: "One agent licensed in both states when your move crosses the line.",
      },
    ],
  },

  process: {
    eyebrow: "Process",
    title: "How we work",
    steps: [
      {
        n: "01",
        title: "We talk",
        desc: "Budget, timeline, and what you actually need — not a generic catalog.",
      },
      {
        n: "02",
        title: "Local plan",
        desc: "Areas, structure, and investment with a remodeler’s eye and real market data.",
      },
      {
        n: "03",
        title: "Search or list",
        desc: "Curated showings, or we prep your home so it enters the market strong.",
      },
      {
        n: "04",
        title: "Negotiate",
        desc: "Offer and terms designed to protect your money and your time.",
      },
      {
        n: "05",
        title: "Close",
        desc: "Inspection, appraisal, financing, and keys — no loose ends.",
      },
    ],
  },

  areas: {
    eyebrow: "Areas",
    title: "Where I work",
    subtitle:
      "South Georgia, plus opportunities across the Florida line — markets I know up close.",
    items: [
      {
        city: "Valdosta",
        desc: "South Georgia’s hub. Established neighborhoods, campus life, and I-75 access.",
        highlight: true,
      },
      {
        city: "Hahira",
        desc: "Close-knit town, wider lots, minutes from Valdosta.",
      },
      {
        city: "Adel",
        desc: "Cook County. Strong value and a family pace.",
      },
      {
        city: "Sparks",
        desc: "More attainable options next to Adel.",
      },
      {
        city: "Lenox",
        desc: "Quiet town living near the I-75 corridor.",
      },
      {
        city: "Ray City",
        desc: "Berrien County. Homes with land and community.",
      },
      {
        city: "Moultrie",
        desc: "Colquitt County. Active town with solid residential stock.",
      },
      {
        city: "Thomasville",
        desc: "Thomas County. Historic charm and established neighborhoods.",
      },
      {
        city: "Nashville",
        desc: "Berrien County. Small-town pace and attainable options.",
      },
      {
        city: "Tifton",
        desc: "Tift County. Campus energy, retail corridors, family homes.",
      },
      {
        city: "North Florida",
        desc: "Buy and sell south of the state line — Florida license included.",
      },
    ],
  },

  listings: {
    eyebrow: "Homes",
    title: "Lock & Key Realty listings",
    subtitle:
      "Lock & Key Realty homes across South Georgia and North Florida. Every card connects you with me for tours and offers.",
    viewAll: "View all",
    filters: "Filters",
    liveLabel: "Inventory updated",
    marketLabel: "Lock & Key Realty only",
    previewLabel: "Preview · no Lock & Key listings loaded yet",
    emptyAgent:
      "There are no active Lock & Key listings on the site right now. Message me and I’ll pull what’s on MLS today.",
    loadingLabel: "Loading inventory…",
    search: {
      placeholder: "City, address, or ZIP",
      type: "Type",
      beds: "Beds",
      price: "Max price",
      city: "City",
      all: "All",
      any: "Any",
      from: "From",
      upTo: "Up to",
      clear: "Clear",
      apply: "Apply",
      noResults: "No results with those filters. Try another city or raise the price cap.",
      nResults: (n: number) =>
        `${n} ${n === 1 ? "property" : "properties"}`,
    },
    types: {
      house: "House",
      townhouse: "Townhouse",
      condo: "Condo",
      land: "Land",
      multifamily: "Multifamily",
      commercial: "Commercial",
    },
    badges: {
      new: "New",
      hot: "Active",
      reduced: "Reduced",
      exclusive: "Exclusive",
    },
    fields: {
      beds: "bd",
      baths: "ba",
      sqft: "sq ft",
      yearBuilt: "Built",
      lotSize: "Lot",
      hoa: "HOA",
    },
    cta: "Schedule a tour",
    contactForPrice: "Inquire for price",
    sort: {
      newest: "Newest",
      priceAsc: "Price: low to high",
      priceDesc: "Price: high to low",
      sqftDesc: "Largest",
    },
  },

  testimonials: {
    eyebrow: "Clients",
    title: "What they say",
    items: [
      {
        quote:
          "Leey walked us through every paper calmly. We bought in Hahira without feeling lost.",
        name: "The M. Family",
        role: "Hahira, GA",
      },
      {
        quote:
          "She knew the Valdosta market and walked us through repairs before listing. Clean sale.",
        name: "J. & A. Thompson",
        role: "Valdosta, GA",
      },
      {
        quote:
          "We crossed from Florida into Georgia. An agent licensed in both states saved us months.",
        name: "Carlos R.",
        role: "Lowndes / N. Florida",
      },
    ],
  },

  contact: {
    eyebrow: "Contact",
    title: "Tell me what you’re looking for.",
    subtitle: "I usually reply the same day. Spanish or English.",
    formTitle: "Message",
    formName: "Name",
    formEmail: "Email",
    formPhone: "Phone",
    formMessage: "Buying, selling, or want a tour?",
    formSend: "Send message",
    formSending: "Sending…",
    formSent: "Thank you. I’ll write soon.",
    formPrivacy: "Your information is never shared.",
    directTitle: "Direct",
    phone: "Phone",
    email: "Email",
    office: "Brokerage",
    officeValue: "Lock & Key Realty",
    hours: "Mon–Sat · 9 am – 7 pm",
  },

  blog: {
    eyebrow: "Notes from Leey",
    title: "Homes, towns, and good taste in South Georgia",
    subtitle:
      "Practical notes on buying, selling, remodeling, and décor — the way I would tell a family at the kitchen table.",
    featured: "Latest",
    readMore: "Read note",
    minRead: "min read",
    empty: "No notes published yet.",
    emptyHint: "Check back soon, or call if you want to talk about a home today.",
    ctaTitle: "Does this sound like your house?",
    ctaBody: "Message me. A short conversation beats sitting with the question.",
    back: "All notes",
    notFound: "I could not find that note.",
    talkEyebrow: "Let’s talk",
    talkTitle: "If this hit close to home",
    talkBody:
      "I can look at your house or your search around Valdosta — in Spanish or English.",
    moreNotes: "More notes",
  },

  footer: {
    tagline: "Bilingual realtor · South Georgia & Florida",
    columns: {
      navigate: "Navigate",
      services: "Services",
      legal: "Legal",
      contact: "Contact",
    },
    legalLinks: {
      privacy: "Privacy",
      fairHousing: "Equal Housing",
      license: "Licensed GA & FL",
    },
    copyright: "Leyanis Hernandez",
    fairHousingNote: "Equal Housing Opportunity.",
  },
};
