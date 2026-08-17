import type { Strings } from "./es";

export const en: Strings = {
  nav: {
    home: "Home",
    listings: "Listings",
    about: "About",
    services: "Services",
    areas: "Areas",
    testimonials: "Stories",
    contact: "Contact",
    call: "Call",
    lang: "ES",
  },

  hero: {
    title: "Your next home in South Georgia.",
    subtitle:
      "Valdosta, Hahira, Adel, Sparks, Lenox, Ray City, Moultrie, Thomasville, Nashville, Tifton, and North Florida. Spanish or English.",
    cta1: "View homes for sale",
    cta2: "Talk to Leey",
    speakEs: "Hablamos español",
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
      "My name is Leyanis Hernandez. I was born in Havana, Cuba, and immigrated to the United States in 1998. I’m a mother of two daughters and a son, and a grandmother to two granddaughters. With my husband, we run a home restoration and remodeling business.",
    paragraph2:
      "That work led me into real estate: guiding families not only to improve a space, but to own their home. I’m licensed in Georgia and Florida. I work in Spanish and English.",
    signature: "Leey.",
  },

  services: {
    eyebrow: "Services",
    title: "How I help",
    items: [
      {
        title: "Buying",
        desc: "Local search, tours, offers, and closing. Clear numbers, no rush.",
      },
      {
        title: "Selling",
        desc: "Honest pricing, home prep, and negotiation through the finish line.",
      },
      {
        title: "First-time buyers",
        desc: "Financing, inspections, and paperwork without the jargon.",
      },
      {
        title: "Georgia & Florida",
        desc: "Licensed in both states when your move crosses the line.",
      },
    ],
  },

  process: {
    eyebrow: "Process",
    title: "Five steps",
    steps: [
      {
        n: "01",
        title: "We talk",
        desc: "Budget, timeline, and what you actually want.",
      },
      {
        n: "02",
        title: "Local plan",
        desc: "Areas, structure, and investment with a remodeler’s eye.",
      },
      {
        n: "03",
        title: "Search or list",
        desc: "Curated showings, or we prep your home for market.",
      },
      {
        n: "04",
        title: "Negotiate",
        desc: "Offer and terms that protect your interest.",
      },
      {
        n: "05",
        title: "Close",
        desc: "Inspection, appraisal, financing, and keys.",
      },
    ],
  },

  areas: {
    eyebrow: "Areas",
    title: "Where I work",
    subtitle: "South Georgia, plus opportunities across the Florida line.",
    items: [
      {
        city: "Valdosta",
        desc: "South Georgia’s hub. Established neighborhoods and easy access.",
        highlight: true,
      },
      {
        city: "Hahira",
        desc: "Close-knit town, wider lots, minutes from Valdosta.",
      },
      {
        city: "Adel",
        desc: "Cook County. Solid value and a family feel.",
      },
      {
        city: "Sparks",
        desc: "Attainable options next to Adel.",
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
        desc: "Buy and sell south of the state line.",
      },
    ],
  },

  listings: {
    eyebrow: "Homes",
    title: "Homes for sale in South Georgia",
    subtitle:
      "Local market inventory so you can see what’s moving in each town. Every card connects you with me at Lock & Key Realty for tours and offers.",
    viewAll: "View all",
    filters: "Filters",
    liveLabel: "Inventory updated",
    marketLabel: "Local market · not only Leey’s listings",
    previewLabel: "Preview · connect Zillow or MLS for live inventory",
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
          "Knew the Valdosta market and walked us through repairs before listing. Clean sale.",
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
    title: "Let’s talk.",
    subtitle: "I usually reply the same day.",
    formTitle: "Message",
    formName: "Name",
    formEmail: "Email",
    formPhone: "Phone",
    formMessage: "How can I help?",
    formSend: "Send",
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

  footer: {
    tagline: "Realtor · South Georgia & Florida",
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
