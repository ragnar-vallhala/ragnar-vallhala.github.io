// ──────────────────────────────────────────────────────────────
//  SITE CONFIG  —  edit everything about your site from this file
// ──────────────────────────────────────────────────────────────

export default {
  // Your identity
  name: "Ashutosh Vishwakarma",
  role: "Systems & Embedded Engineer · Co-Founder, NAVRobotec",
  // A short intro shown on the home page. Plain text or light HTML.
  intro:
    "I build low-level systems, and I read far outside them. " +
    "Flight stacks and kernels to humanities. " +
    "The verse below is the closest thing to my method. " +
    "Do the work fully. Hold the results loosely.",

  // A line I keep close — shown as an epigraph under the intro.
  epigraph: {
    sanskrit:
      "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\n" +
      "मा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥",
    gloss:
      "The right is to the work alone, never to its fruits. " +
      "Let results not move you; nor cling to inaction.",
    citation: "Bhagavad Gītā 2.47",
    href: "https://vedabase.io/en/library/bg/2/47/",
  },

  // Where the site will live (used for absolute links / meta tags).
  url: "https://ragnar-vallhala.github.io",

  // Footer + meta
  email: "ashutoshvishwakarma208@gmail.com",
  year: 2026,

  // Social / external links.
  links: [
    { label: "GitHub", href: "https://github.com/ragnar-vallhala" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/ashutosh-vishwakarma-083305257/" },
    { label: "Email", href: "mailto:ashutoshvishwakarma208@gmail.com" },
  ],

  // Selected work shown on the home page.
  projects: [
    {
      title: "Vayu — Indigenous Flight Stack",
      year: "2025–26",
      blurb:
        "A UAV autopilot owned from PCB to ground station. NavHAL (HAL), VaiOS (1 kHz RTOS), and Vayu (flight control). Built at NAVRobotec.",
      href: "https://navrobotec.com",
      tags: ["Embedded", "RTOS", "C", "STM32"],
    },
    {
      title: "Navigator — Ground Control Station",
      year: "2025–26",
      blurb:
        "A ~25k-LOC Qt6 ground station for the Vayu drone. Custom CRC-framed telemetry, real-time plots, and a packet analyzer. Plus an embedded SITL sim with a 1 kHz physics daemon.",
      href: "https://navrobotec.com",
      tags: ["Qt6", "C++", "Simulation", "OpenGL"],
    },
    {
      title: "gem5 AVR ISA Extension",
      year: "2025–26",
      blurb:
        "Extended the gem5 simulator with the AVR instruction set. Enables cycle-accurate simulation of microcontroller workloads. Validated in the loop against real silicon.",
      href: "https://github.com/ragnar-vallhala/gem5",
      tags: ["Computer Architecture", "C++", "gem5"],
    },
    {
      title: "NavHAL",
      year: "2025",
      blurb:
        "A zero-cost, vendor-agnostic HAL for Cortex-M chips. It covers 7+ peripherals across 5+ MCU families. Modular Kconfig and CMake build.",
      href: "https://github.com/ragnar-vallhala/NavHAL",
      tags: ["Embedded", "C", "Cortex-M"],
    },
    {
      title: "AVR-XPU — SIMD Coprocessor Study",
      year: "2026",
      blurb:
        "A feasibility study for an AVR-derived coprocessor. It targets edge inference and flight-control math. Roofline analysis showed the real bottleneck is memory bandwidth, not SIMD width.",
      href: "https://github.com/ragnar-vallhala/AVR-XPU",
      tags: ["Research", "Architecture"],
    },
    {
      title: "Moleculizer",
      year: "2024",
      blurb:
        "A 3D molecule visualizer for .xyz files. Built in C++ with OpenGL, GLFW, and ImGui. Translate, rotate, and scale models. Session state is preserved between runs.",
      href: "https://github.com/ragnar-vallhala/Moleculizer",
      tags: ["C++", "OpenGL", "Graphics"],
    },
  ],
};
