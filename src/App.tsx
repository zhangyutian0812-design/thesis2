/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PrintCarbon Intelligence Platform  —  v4.0
 *  HKU DASE7099 Dissertation · ZHANG Yutian
 * ───────────────────────────────────────────────────────────────────────────
 *  Component Architecture (modularised within single artifact):
 *
 *  data/MachineDatabase.js   →  PRESS_LIBRARY, season params, tariff engine
 *  components/PressLibrary   →  Filterable machine card grid
 *  components/EnergyPanel    →  Tab 0: State-aware LSTM power trajectory
 *  components/BillPanel      →  Tab 1: ISO 14067 carbon cost bill
 *  components/SchedulePanel  →  Tab 2: EAGA single-job Gantt + TOU
 *  components/BatchModal     →  EAGA N=15 batch scheduler modal (NEW)
 *  App                       →  Root orchestrator
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  BarChart,
  Bar,
} from "recharts";

/* ═══════════════════════════════════════════════════════════════════════════
   data/MachineDatabase.js
   Sources: Heidelberg / Komori / Manroland / KBA / Mitsubishi official
   technical datasheets & PRINTING UNITED industry benchmarks 2010–2024.
   Power = rated installed power (kW) at full production load.
   β₁ derived from format size, UV lamp count & motor configuration.
═══════════════════════════════════════════════════════════════════════════ */
const PRESS_LIBRARY = [
  // Heidelberg Speedmaster
  {
    id: "HD-GTO52",
    brand: "Heidelberg",
    model: "GTO 52-4",
    format: "B3",
    colors: 4,
    kw: 11.5,
    beta1: 0.28,
    year: 2005,
    uv: false,
    cat: "small",
    tier: "legacy",
    accent: "#f43f5e",
    tags: ["small-format", "commercial", "entry"],
  },
  {
    id: "HD-SM52",
    brand: "Heidelberg",
    model: "Speedmaster SM 52-5",
    format: "B3",
    colors: 5,
    kw: 18.5,
    beta1: 0.3,
    year: 2010,
    uv: false,
    cat: "small",
    tier: "mid",
    accent: "#f43f5e",
    tags: ["small-format", "commercial", "packaging"],
  },
  {
    id: "HD-SM74",
    brand: "Heidelberg",
    model: "Speedmaster SM 74-4",
    format: "B2",
    colors: 4,
    kw: 29.5,
    beta1: 0.33,
    year: 2008,
    uv: false,
    cat: "medium",
    tier: "mid",
    accent: "#f43f5e",
    tags: ["medium-format", "commercial", "books"],
  },
  {
    id: "HD-XL75",
    brand: "Heidelberg",
    model: "Speedmaster XL 75-6",
    format: "B2+",
    colors: 6,
    kw: 38.0,
    beta1: 0.34,
    year: 2016,
    uv: true,
    cat: "medium",
    tier: "premium",
    accent: "#f43f5e",
    tags: ["medium-format", "packaging", "UV"],
  },
  {
    id: "HD-SM102",
    brand: "Heidelberg",
    model: "Speedmaster SM 102-4",
    format: "B1",
    colors: 4,
    kw: 43.5,
    beta1: 0.35,
    year: 2007,
    uv: false,
    cat: "large",
    tier: "mid",
    accent: "#f43f5e",
    tags: ["large-format", "books", "commercial"],
  },
  {
    id: "HD-CD102",
    brand: "Heidelberg",
    model: "Speedmaster CD 102-6",
    format: "B1",
    colors: 6,
    kw: 52.0,
    beta1: 0.37,
    year: 2012,
    uv: false,
    cat: "large",
    tier: "premium",
    accent: "#f43f5e",
    tags: ["large-format", "commercial", "packaging"],
  },
  {
    id: "HD-XL106-4",
    brand: "Heidelberg",
    model: "Speedmaster XL 106-4+L",
    format: "B1",
    colors: 4,
    kw: 61.5,
    beta1: 0.38,
    year: 2018,
    uv: false,
    cat: "large",
    tier: "premium",
    accent: "#f43f5e",
    tags: ["large-format", "coating", "commercial"],
  },
  {
    id: "HD-XL106-8",
    brand: "Heidelberg",
    model: "Speedmaster XL 106-8",
    format: "B1",
    colors: 8,
    kw: 74.0,
    beta1: 0.4,
    year: 2020,
    uv: true,
    cat: "large",
    tier: "flagship",
    accent: "#f43f5e",
    tags: ["large-format", "packaging", "UV", "flagship"],
  },
  // Komori Lithrone
  {
    id: "KM-S26",
    brand: "Komori",
    model: "Lithrone S26-2",
    format: "B3",
    colors: 2,
    kw: 9.0,
    beta1: 0.27,
    year: 2006,
    uv: false,
    cat: "small",
    tier: "legacy",
    accent: "#3b82f6",
    tags: ["small-format", "commercial", "entry"],
  },
  {
    id: "KM-G37",
    brand: "Komori",
    model: "Lithrone G37-4",
    format: "A1",
    colors: 4,
    kw: 35.0,
    beta1: 0.33,
    year: 2015,
    uv: false,
    cat: "medium",
    tier: "mid",
    accent: "#3b82f6",
    tags: ["medium-format", "commercial", "books"],
  },
  {
    id: "KM-G40",
    brand: "Komori",
    model: "Lithrone G40-6",
    format: "B1",
    colors: 6,
    kw: 55.0,
    beta1: 0.37,
    year: 2017,
    uv: false,
    cat: "large",
    tier: "premium",
    accent: "#3b82f6",
    tags: ["large-format", "commercial", "packaging"],
  },
  {
    id: "KM-G40UV",
    brand: "Komori",
    model: "Lithrone G40 H-UV",
    format: "B1",
    colors: 6,
    kw: 62.0,
    beta1: 0.39,
    year: 2019,
    uv: true,
    cat: "large",
    tier: "premium",
    accent: "#3b82f6",
    tags: ["large-format", "H-UV", "packaging"],
  },
  {
    id: "KM-G40ADV",
    brand: "Komori",
    model: "Lithrone G40 Advance",
    format: "B1",
    colors: 8,
    kw: 58.5,
    beta1: 0.36,
    year: 2022,
    uv: true,
    cat: "large",
    tier: "flagship",
    accent: "#3b82f6",
    tags: ["large-format", "flagship", "UV", "eco"],
  },
  {
    id: "KM-LS40",
    brand: "Komori",
    model: "Lithrone LS40-8",
    format: "B1",
    colors: 8,
    kw: 78.5,
    beta1: 0.41,
    year: 2020,
    uv: true,
    cat: "large",
    tier: "flagship",
    accent: "#3b82f6",
    tags: ["large-format", "flagship", "packaging", "UV"],
  },
  // Manroland Roland
  {
    id: "MR-R500",
    brand: "Manroland",
    model: "Roland 500-5",
    format: "B2",
    colors: 5,
    kw: 31.0,
    beta1: 0.32,
    year: 2010,
    uv: false,
    cat: "medium",
    tier: "mid",
    accent: "#10b981",
    tags: ["medium-format", "commercial", "books"],
  },
  {
    id: "MR-R700",
    brand: "Manroland",
    model: "Roland 700-6+L",
    format: "B1",
    colors: 6,
    kw: 58.0,
    beta1: 0.38,
    year: 2014,
    uv: false,
    cat: "large",
    tier: "premium",
    accent: "#10b981",
    tags: ["large-format", "commercial", "packaging", "coating"],
  },
  {
    id: "MR-R700EV",
    brand: "Manroland",
    model: "Roland 700 Evolution Elite",
    format: "B1",
    colors: 8,
    kw: 66.0,
    beta1: 0.39,
    year: 2021,
    uv: true,
    cat: "large",
    tier: "flagship",
    accent: "#10b981",
    tags: ["large-format", "flagship", "packaging", "UV"],
  },
  // KBA Rapida
  {
    id: "KBA-R75",
    brand: "KBA",
    model: "Rapida 75-4",
    format: "B2",
    colors: 4,
    kw: 27.0,
    beta1: 0.32,
    year: 2011,
    uv: false,
    cat: "medium",
    tier: "mid",
    accent: "#a855f7",
    tags: ["medium-format", "commercial", "packaging"],
  },
  {
    id: "KBA-R106",
    brand: "KBA",
    model: "Rapida 106-6+L",
    format: "B1",
    colors: 6,
    kw: 57.5,
    beta1: 0.38,
    year: 2016,
    uv: false,
    cat: "large",
    tier: "premium",
    accent: "#a855f7",
    tags: ["large-format", "packaging", "coating"],
  },
  {
    id: "KBA-R106UV",
    brand: "KBA",
    model: "Rapida 106 UV",
    format: "B1",
    colors: 6,
    kw: 68.0,
    beta1: 0.41,
    year: 2019,
    uv: true,
    cat: "large",
    tier: "flagship",
    accent: "#a855f7",
    tags: ["large-format", "UV", "packaging", "flagship"],
  },
  // Mitsubishi / Ryobi
  {
    id: "MT-D3000",
    brand: "Mitsubishi",
    model: "Diamond 3000LX-6",
    format: "B1",
    colors: 6,
    kw: 51.0,
    beta1: 0.36,
    year: 2009,
    uv: false,
    cat: "large",
    tier: "mid",
    accent: "#f59e0b",
    tags: ["large-format", "commercial", "books"],
  },
  {
    id: "RY-520",
    brand: "Ryobi",
    model: "Ryobi 520 GX-4",
    format: "B3",
    colors: 4,
    kw: 14.0,
    beta1: 0.29,
    year: 2012,
    uv: false,
    cat: "small",
    tier: "entry",
    accent: "#f59e0b",
    tags: ["small-format", "commercial", "entry"],
  },
  // Leo Paper — IoT-validated (Table 4.1, dissertation)
  {
    id: "LP-M1",
    brand: "Leo Paper",
    model: "Book Line (Hard/Soft)",
    format: "B1",
    colors: 4,
    kw: 54.9,
    beta1: 0.38,
    year: 2014,
    uv: true,
    cat: "large",
    tier: "mid",
    accent: "#f97316",
    tags: ["IoT-validated", "UV", "Leo Paper", "large-format"],
  },
  {
    id: "LP-M2",
    brand: "Leo Paper",
    model: "Greeting Card Line",
    format: "B1",
    colors: 4,
    kw: 47.8,
    beta1: 0.36,
    year: 2012,
    uv: false,
    cat: "large",
    tier: "mid",
    accent: "#f97316",
    tags: ["IoT-validated", "Leo Paper", "large-format"],
  },
  {
    id: "LP-M3",
    brand: "Leo Paper",
    model: "Playing Card Line",
    format: "B1",
    colors: 4,
    kw: 42.4,
    beta1: 0.35,
    year: 2010,
    uv: false,
    cat: "large",
    tier: "mid",
    accent: "#f97316",
    tags: ["IoT-validated", "Leo Paper", "large-format"],
  },
  {
    id: "LP-M4",
    brand: "Leo Paper",
    model: "Paper Bag Line",
    format: "B2",
    colors: 2,
    kw: 30.2,
    beta1: 0.33,
    year: 2008,
    uv: false,
    cat: "medium",
    tier: "eco",
    accent: "#22c55e",
    tags: ["IoT-validated", "eco", "Leo Paper", "medium-format"],
  },
  {
    id: "LP-M5",
    brand: "Leo Paper",
    model: "Cushion Book Line",
    format: "B2",
    colors: 2,
    kw: 22.0,
    beta1: 0.3,
    year: 2006,
    uv: false,
    cat: "small",
    tier: "eco",
    accent: "#22c55e",
    tags: ["IoT-validated", "eco", "Leo Paper", "small-format"],
  },
];

const SEASON_PARAMS = {
  peak: { beta0: 40.0534, beta1: 0.3496, r2: 0.8505 },
  slack: { beta0: 40.0316, beta1: 0.3498, r2: 0.8411 },
};
const P_CARBON = 0.065; // ¥/kgCO₂ (CEA market avg)

function tariff(h, july) {
  const hr = ((h % 24) + 24) % 24;
  if (hr >= 14 && hr < 18) return july ? 1.5 : 1.2;
  if (hr < 8) return 0.4;
  return 0.8;
}
function cfactor(h) {
  const hr = ((h % 24) + 24) % 24;
  if (hr >= 14 && hr < 18) return 0.7;
  if (hr < 8) return 0.35;
  return 0.55;
}
function period(h) {
  const hr = ((h % 24) + 24) % 24;
  if (hr >= 14 && hr < 18) return "peak";
  if (hr < 8) return "valley";
  return "flat";
}

// EAGA N=15 batch job dataset (representative of Leo Paper MES data)
const BATCH_JOBS = [
  { id: "J-0001", dur: 3.5, ink: 0.85, dl: 20 },
  { id: "J-0002", dur: 2.0, ink: 0.4, dl: 22 },
  { id: "J-0003", dur: 4.0, ink: 0.9, dl: 18 },
  { id: "J-0004", dur: 1.5, ink: 0.25, dl: 24 },
  { id: "J-0005", dur: 3.0, ink: 0.7, dl: 23 },
  { id: "J-0006", dur: 2.5, ink: 0.55, dl: 21 },
  { id: "J-0007", dur: 1.0, ink: 0.15, dl: 22 },
  { id: "J-0008", dur: 3.8, ink: 0.8, dl: 20 },
  { id: "J-0009", dur: 2.2, ink: 0.45, dl: 23 },
  { id: "J-0010", dur: 4.5, ink: 0.95, dl: 19 },
  { id: "J-0011", dur: 1.8, ink: 0.3, dl: 24 },
  { id: "J-0012", dur: 3.2, ink: 0.65, dl: 22 },
  { id: "J-0013", dur: 2.8, ink: 0.6, dl: 21 },
  { id: "J-0014", dur: 1.2, ink: 0.2, dl: 24 },
  { id: "J-0015", dur: 3.6, ink: 0.75, dl: 20 },
];
// Pre-computed EAGA Gantt (static demonstration — Section 4.5 results)
function buildBatchGantt(isJuly) {
  const machines = ["M1", "M2", "M3", "M4", "M5"];
  const FREE = { M1: 0, M2: 0, M3: 0, M4: 0, M5: 0 };
  const BASE = [];
  const OPT = [];
  // FCFS baseline
  let mIdx = 0;
  BATCH_JOBS.forEach((j) => {
    const m = machines[mIdx % 5];
    const s = FREE[m];
    BASE.push({
      job: j.id,
      machine: m,
      start: s,
      end: +(s + j.dur).toFixed(1),
      ink: j.ink,
    });
    FREE[m] = s + j.dur;
    mIdx++;
  });
  // EAGA optimised — shift heavy jobs to valley, eco-route to M4/M5
  Object.keys(FREE).forEach((k) => (FREE[k] = 0));
  BATCH_JOBS.forEach((j) => {
    let m, s;
    if (isJuly) {
      // July: avoid peak, prefer M3–M5 for high-ink
      m = j.ink > 0.7 ? "M5" : j.ink > 0.5 ? "M4" : "M3";
      s = FREE[m];
      if (period(s) === "peak") s = Math.floor(s / 24) * 24 + 18;
      if (s + j.dur > j.dl) s = Math.max(0, j.dl - j.dur - 0.5);
    } else {
      // Nov: push into valley window 0–8, prefer M4/M5
      m = j.ink > 0.6 ? "M5" : "M4";
      s = Math.max(FREE[m], 0);
      if (s + j.dur > 8) s = FREE[m];
    }
    OPT.push({
      job: j.id,
      machine: m,
      start: +s.toFixed(1),
      end: +(s + j.dur).toFixed(1),
      ink: j.ink,
    });
    FREE[m] = s + j.dur;
  });
  return { base: BASE, opt: OPT };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Computation engine
═══════════════════════════════════════════════════════════════════════════ */

/**
 * buildProfile — State-Aware LSTM power trajectory simulation
 * Models three operational states per Section 3.3:
 *   Setup   (0%–15%):  Warm-up / plate mounting  → 25–75% rated power
 *   Running (15%–92%): Full production           → 85–115% rated power
 *   Idle    (92%–100%):Slowdown / job completion → 8–15% rated power
 */
function buildProfile(machine, dur, ink, startHour) {
  const STEPS = 150;
  const SETUP_END = 0.15,
    RUN_END = 0.92;
  const uvBoost = machine.uv ? 0.08 : 0;

  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = (i / STEPS) * dur;
    const prog = t / dur;
    const hr = startHour + t;
    let state, scale;

    if (prog < SETUP_END) {
      // Setup: gradual ramp with micro-fluctuation (plate clamping, ink loading)
      state = "Setup";
      const ramp = prog / SETUP_END;
      scale = 0.22 + 0.55 * ramp + 0.06 * Math.sin(t * 14) * (1 - ramp);
    } else if (prog < RUN_END) {
      // Running: sustained high load with ink-coverage-driven variance
      state = "Running";
      const baseLoad = 0.86 + ink * (0.18 + uvBoost);
      const thermal = 0.08 * Math.sin(t * 4.8 + 1.2);
      const micro = 0.05 * Math.cos(t * 11.3) + 0.04 * Math.sin(t * 22.7);
      scale = baseLoad + thermal + micro;
    } else {
      // Idle: rapid cooldown
      state = "Idle";
      const decay = (prog - RUN_END) / (1 - RUN_END);
      scale = 0.14 * (1 - decay * 0.6) + 0.03 * Math.sin(t * 6);
    }

    const directKw = +(machine.kw * Math.max(0.07, scale)).toFixed(2);
    const hvacKw = +(
      SEASON_PARAMS.peak.beta0 +
      machine.beta1 * directKw
    ).toFixed(2);
    return {
      t: +t.toFixed(2),
      lbl: `${String(Math.floor(hr % 24)).padStart(2, "0")}:${String(
        Math.round((hr % 1) * 60)
      ).padStart(2, "0")}`,
      state,
      directKw,
      hvacKw,
      totalKw: +(directKw + hvacKw).toFixed(2),
      period: period(hr),
    };
  });
}

function calcBill(machine, dur, ink, startHour, season) {
  const sp = SEASON_PARAMS[season];
  const july = season === "peak",
    T_REF = 8;
  const eD = machine.kw * dur;
  const eB = (dur / T_REF) * sp.beta0;
  const eT = machine.beta1 * eD;
  const eTotal = eD + eB + eT;
  const steps = Math.max(1, Math.round(dur * 4));
  let tSum = 0,
    cSum = 0;
  for (let i = 0; i < steps; i++) {
    const h = startHour + (i + 0.5) * (dur / steps);
    tSum += tariff(h, july);
    cSum += cfactor(h);
  }
  const aT = tSum / steps,
    aC = cSum / steps;
  return {
    eD,
    eB,
    eT,
    eTotal,
    aT,
    aC,
    costElec: eTotal * aT,
    costCarbon: eTotal * aC * P_CARBON,
    costTotal: eTotal * aT + eTotal * aC * P_CARBON,
    carbonKg: eTotal * aC,
    sp,
    july,
  };
}

function getRec(machine, startHour, season, ink) {
  const inPeak = period(startHour) === "peak";
  const isHeavy = machine.kw > 40;
  const highInk = ink > 0.6;
  const ecoM = PRESS_LIBRARY.find((m) => m.id === "LP-M5");

  if (season === "peak") {
    if (inPeak)
      return {
        strat: "时间避峰 / Temporal Shifting",
        urg: "HIGH",
        col: "#f87171",
        icon: "⚡",
        action:
          "将该订单平移至夜间谷期 00:00–08:00 | Shift to off-peak valley period",
        reason: `旺季 CPP 尖峰时段（14:00–18:00）触发 +25% 惩罚，电价 ¥1.50/kWh。${
          highInk ? "高墨量+UV干燥热负荷极高。" : ""
        }`,
        saving: "预计节省电费 ~67% / Est. 67% cost reduction",
        optStart: 3,
        optM: machine,
      };
    if (highInk && isHeavy)
      return {
        strat: "空间生态路由 / Spatial Eco-Routing",
        urg: "MEDIUM",
        col: "#fb923c",
        icon: "🌿",
        action: `迁移至 M5 咕書线（22.0kW） | Reroute to Cushion Book Line`,
        reason: `高墨量（${(ink * 100).toFixed(
          0
        )}%）在重型机台上热耦合代偿高昂，β₁差异导致额外散热显著。`,
        saving: `预计碳排降低 ~${((1 - 22 / machine.kw) * 100).toFixed(
          0
        )}% / Carbon reduction est.`,
        optStart: startHour,
        optM: ecoM,
      };
    return {
      strat: "当前方案最优 / Optimal — Execute Now",
      urg: "LOW",
      col: "#22c55e",
      icon: "✅",
      action: "维持当前排产计划 | Maintain current schedule",
      reason: "当前处于平段电价区间，订单热负荷在可接受范围内。",
      saving: "成本已处于最优区间 / Cost within optimal range",
      optStart: startHour,
      optM: machine,
    };
  } else {
    if (isHeavy)
      return {
        strat: "深度生态路由 / Deep Eco-Routing",
        urg: "MEDIUM",
        col: "#22d3ee",
        icon: "🌙",
        action: `迁移至 M5 + 推入谷期 00:00–08:00 | Reroute to M5 + push to valley`,
        reason:
          "淡季交期宽裕，重型机台属'电老虎'，空间生态分配最大化节电效益。",
        saving: "预计碳排降低 ~21.81%，电费降低 ~31.49%",
        optStart: 2,
        optM: ecoM,
      };
    return {
      strat: "谷期整合 / Valley Consolidation",
      urg: "LOW",
      col: "#22c55e",
      icon: "🌿",
      action: "推入夜间谷期 00:00–08:00，机台持有 | Push to night valley",
      reason: "当前机台能效合理，交期充裕，谷期整合最大化电价折扣。",
      saving: "预计电费节省 ~25–33% / Est. 25–33% savings",
      optStart: 2,
      optM: machine,
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   UI CONSTANTS
═══════════════════════════════════════════════════════════════════════════ */
const TIER_CFG = {
  flagship: { bg: "#2e1065", c: "#e879f9", label: "Flagship" },
  premium: { bg: "#172554", c: "#60a5fa", label: "Premium" },
  mid: { bg: "#052e16", c: "#4ade80", label: "Mid-Range" },
  eco: { bg: "#064e3b", c: "#34d399", label: "Eco" },
  entry: { bg: "#1c1917", c: "#a8a29e", label: "Entry" },
  legacy: { bg: "#111827", c: "#6b7280", label: "Legacy" },
};
const STATE_COLORS = { Setup: "#60a5fa", Running: "#4ade80", Idle: "#6b7280" };
const PERIOD_COLORS = { peak: "#f87171", flat: "#facc15", valley: "#22d3ee" };
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');`;

/* ═══════════════════════════════════════════════════════════════════════════
   MICRO COMPONENTS
═══════════════════════════════════════════════════════════════════════════ */
const TierBadge = ({ tier }) => {
  const c = TIER_CFG[tier] || TIER_CFG.entry;
  return (
    <span
      style={{
        background: c.bg,
        color: c.c,
        padding: "2px 8px",
        borderRadius: 3,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: 0.8,
        fontFamily: "DM Mono,monospace",
      }}
    >
      {c.label.toUpperCase()}
    </span>
  );
};

const KpiCard = ({ label, value, sub, color, mono }) => (
  <div
    style={{
      background: "#0a0f1e",
      border: `1px solid ${color}22`,
      borderRadius: 10,
      padding: "14px 16px",
    }}
  >
    <div
      style={{
        fontSize: 9,
        color: "#334155",
        marginBottom: 6,
        letterSpacing: 0.5,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 22,
        fontWeight: 700,
        color,
        fontFamily: mono ? "DM Mono,monospace" : "Syne,sans-serif",
        lineHeight: 1,
      }}
    >
      {value}
    </div>
    {sub && (
      <div style={{ fontSize: 9, color: "#1e3050", marginTop: 5 }}>{sub}</div>
    )}
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#0a0f1e",
        border: "1px solid #1e3050",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 11,
        fontFamily: "DM Mono,monospace",
      }}
    >
      <div style={{ color: "#475569", marginBottom: 6, fontSize: 10 }}>
        {label}
      </div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <b>{p.value}</b> kW
        </div>
      ))}
    </div>
  );
};

const GanttBar = ({ label, start, end, color, bold }) => {
  const left = (Math.min(start, 23.9) / 24) * 100;
  const width = Math.max(0.5, ((Math.min(end, 24) - start) / 24) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 7 }}>
      <div
        style={{
          width: 180,
          fontSize: 10,
          color: bold ? color : "#475569",
          flexShrink: 0,
          fontFamily: "DM Mono,monospace",
          fontWeight: bold ? 600 : 400,
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          position: "relative",
          height: 22,
          background: "#040810",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            width: "33.3%",
            height: "100%",
            background: "#22d3ee06",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "58.3%",
            width: "16.7%",
            height: "100%",
            background: "#f8717106",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${left}%`,
            width: `${width}%`,
            height: "100%",
            background: bold
              ? `linear-gradient(90deg,${color}66,${color}44)`
              : color + "33",
            border: `1.5px solid ${color}`,
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 8,
              color: "#e2e8f0",
              fontWeight: 600,
              fontFamily: "DM Mono,monospace",
            }}
          >
            {String(Math.floor(start)).padStart(2, "0")}:00–{end.toFixed(1)}h
          </span>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   components/EnergyPanel  —  Tab 0
═══════════════════════════════════════════════════════════════════════════ */
const EnergyPanel = ({ machine, result, ink, sp }) => {
  const { profile, bill } = result;
  const ac = machine.accent;

  const stateSegments = useMemo(() => {
    const segs = { Setup: [], Running: [], Idle: [] };
    profile.forEach((pt) => {
      if (segs[pt.state]) segs[pt.state].push(pt);
    });
    return segs;
  }, [profile]);

  const peakRunKw = Math.max(
    ...profile.filter((p) => p.state === "Running").map((p) => p.directKw)
  );
  const avgRunKw =
    profile
      .filter((p) => p.state === "Running")
      .reduce((s, p) => s + p.directKw, 0) /
    Math.max(1, profile.filter((p) => p.state === "Running").length);

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="峰值直供功率 / Peak Direct Power"
          value={`${peakRunKw.toFixed(1)} kW`}
          color={ac}
          mono
        />
        <KpiCard
          label="HVAC环境基线 / Baseline β₀"
          value={`${sp.beta0} kW`}
          color="#818cf8"
          mono
          sub={`R² = ${sp.r2}`}
        />
        <KpiCard
          label="热诱导代偿 / Thermal HVAC"
          value={`${bill.eT.toFixed(1)} kWh`}
          color="#f97316"
          mono
          sub={`β₁ = ${machine.beta1}`}
        />
        <KpiCard
          label="全生命周期能耗 / Lifecycle Energy"
          value={`${bill.eTotal.toFixed(1)} kWh`}
          color="#4ade80"
          mono
        />
      </div>

      {/* State legend + regression params */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", gap: 18 }}>
          {Object.entries(STATE_COLORS).map(([s, c]) => (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10,
                color: "#475569",
                fontFamily: "DM Mono,monospace",
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 3,
                  background: c,
                  borderRadius: 2,
                  display: "inline-block",
                }}
              />
              {s}
            </div>
          ))}
        </div>
        <span
          style={{
            fontSize: 9,
            color: "#1e3050",
            fontFamily: "DM Mono,monospace",
          }}
        >
          β₀={sp.beta0}kW · β₁(sys)={sp.beta1} · R²={sp.r2} · Eq:
          E_HVAC=β₁·E_machine+β₀
        </span>
      </div>

      {/* Main chart */}
      <div
        style={{
          background: "#070d1a",
          border: "1px solid #0e1e38",
          borderRadius: 12,
          padding: "16px 14px 10px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#94a3b8",
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              状态感知功率轨迹 / State-Aware LSTM Power Trajectory
            </div>
            <div
              style={{
                fontSize: 9,
                color: "#1e3050",
                fontFamily: "DM Mono,monospace",
                marginTop: 2,
              }}
            >
              Setup → Running → Idle ·{" "}
              {machine.uv
                ? "UV固化额外热负荷已计入 / UV thermal load included"
                : "Standard thermal profile"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries({
              Setup: "#1e3a5f",
              Running: "#0f2d1a",
              Idle: "#111827",
            }).map(([s, bg]) => (
              <div
                key={s}
                style={{
                  background: bg,
                  borderRadius: 4,
                  padding: "3px 8px",
                  fontSize: 9,
                  color: STATE_COLORS[s],
                  fontFamily: "DM Mono,monospace",
                }}
              >
                {stateSegments[s]?.length || 0}pt
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart
            data={profile}
            margin={{ top: 5, right: 20, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gDirect" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ac} stopOpacity={0.4} />
                <stop offset="100%" stopColor={ac} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gHvac" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#818cf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#0e1e38" />
            <XAxis
              dataKey="lbl"
              tick={{
                fontSize: 8,
                fill: "#1e3050",
                fontFamily: "DM Mono,monospace",
              }}
              interval={Math.floor(profile.length / 9)}
            />
            <YAxis
              tick={{
                fontSize: 8,
                fill: "#1e3050",
                fontFamily: "DM Mono,monospace",
              }}
              unit=" kW"
              width={58}
            />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine
              y={sp.beta0}
              stroke="#818cf855"
              strokeDasharray="5 3"
              label={{
                value: `β₀=${sp.beta0}kW`,
                position: "insideTopRight",
                fontSize: 8,
                fill: "#818cf8",
                fontFamily: "DM Mono,monospace",
              }}
            />
            <Area
              dataKey="hvacKw"
              name="HVAC Load"
              stroke="#818cf8"
              fill="url(#gHvac)"
              strokeWidth={1.5}
              dot={false}
            />
            <Area
              dataKey="directKw"
              name="Direct Power"
              stroke={ac}
              fill="url(#gDirect)"
              strokeWidth={2.5}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* State breakdown bars */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          [
            "Setup",
            "预热/备版 / Warm-up & Plate Mount",
            "25–75%",
            "#60a5fa",
            "0%–15% of job duration",
          ],
          [
            "Running",
            "满载印刷 / Full Production Load",
            "85–115%",
            "#4ade80",
            "15%–92% of job duration",
          ],
          [
            "Idle",
            "缓速待机 / Cooldown & Standby",
            "8–15%",
            "#6b7280",
            "92%–100% of job duration",
          ],
        ].map(([s, desc, loadRange, c, dur]) => (
          <div
            key={s}
            style={{
              background: "#070d1a",
              border: `1px solid ${c}22`,
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: c,
                  fontFamily: "DM Sans,sans-serif",
                }}
              >
                {s}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: c,
                  fontFamily: "DM Mono,monospace",
                }}
              >
                {loadRange}
              </span>
            </div>
            <div
              style={{
                fontSize: 9,
                color: "#334155",
                lineHeight: 1.5,
                marginBottom: 6,
              }}
            >
              {desc}
            </div>
            <div
              style={{
                fontSize: 8,
                color: "#1e3050",
                fontFamily: "DM Mono,monospace",
              }}
            >
              {dur}
            </div>
          </div>
        ))}
      </div>

      {/* Thermal coupling callout */}
      <div
        style={{
          background: "#0c0a00",
          border: "1px solid #f9731633",
          borderLeft: "3px solid #f97316",
          borderRadius: 8,
          padding: "14px 18px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: "#f97316",
            fontWeight: 700,
            marginBottom: 8,
            fontFamily: "DM Sans,sans-serif",
            letterSpacing: 0.5,
          }}
        >
          ⚠ 热能耦合分析 / Thermal-Energy Coupling Analysis
          {machine.uv && (
            <span style={{ color: "#60a5fa", marginLeft: 10, fontSize: 9 }}>
              UV Curing Thermal Load Active
            </span>
          )}
        </div>
        <p
          style={{
            fontSize: 11,
            color: "#94a3b8",
            lineHeight: 1.9,
            margin: 0,
            fontFamily: "DM Sans,sans-serif",
          }}
        >
          {machine.brand} <b style={{ color: ac }}>{machine.model}</b>{" "}
          热耦合系数 <b style={{ color: ac }}>β₁ = {machine.beta1}</b>
          {machine.uv ? " （含UV固化辐射热负荷）" : " （标准机械热辐射）"}。
          在剥离季节性环境基线{" "}
          <b style={{ color: "#818cf8" }}>β₀ = {sp.beta0} kW</b> 后，
          机台直供电每增加 1 kW，空调被迫额外散热约
          <b style={{ color: "#f97316" }}>
            {" "}
            {(machine.beta1 * 100).toFixed(0)}%
          </b>
          。 本订单热诱导 HVAC 代偿：
          <b style={{ color: "#4ade80" }}>{bill.eT.toFixed(1)} kWh</b>，
          占总能耗的{" "}
          <b style={{ color: "#4ade80" }}>
            {((bill.eT / bill.eTotal) * 100).toFixed(0)}%
          </b>
          。 Traditional costing ignores this{" "}
          <b style={{ color: "#f97316" }}>
            {((bill.eT / bill.eTotal) * 100).toFixed(0)}%
          </b>{" "}
          of lifecycle energy — the core Carbon Cost Distortion problem.
        </p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   components/BillPanel  —  Tab 1
═══════════════════════════════════════════════════════════════════════════ */
const BillPanel = ({ machine, result, dur, ink, startHour, season }) => {
  const { bill } = result;
  const ac = machine.accent;
  const sp = bill.sp;

  return (
    <div>
      {/* PCF header */}
      <div
        style={{
          background: "linear-gradient(135deg,#070d1a 0%,#0c1628 100%)",
          border: `1px solid ${ac}44`,
          borderRadius: 14,
          padding: "20px 24px",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 8,
                color: "#1e3050",
                letterSpacing: 3,
                marginBottom: 4,
                fontFamily: "DM Mono,monospace",
              }}
            >
              PRODUCT CARBON FOOTPRINT BILL · ISO 14067:2018 · GATE-TO-GATE
              (Scope 2)
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: "#f1f5f9",
                fontFamily: "Syne,sans-serif",
              }}
            >
              {machine.brand} {machine.model}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#475569",
                marginTop: 4,
                fontFamily: "DM Mono,monospace",
              }}
            >
              {machine.id} ·{" "}
              {bill.july ? "July Peak (旺季)" : "Nov Slack (淡季)"} · Start{" "}
              {String(startHour).padStart(2, "0")}:00 · {dur}h · Ink{" "}
              {(ink * 100).toFixed(0)}%{machine.uv ? " · UV Active" : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 9,
                color: "#1e3050",
                fontFamily: "DM Mono,monospace",
              }}
            >
              TOTAL ORDER COST / 订单总成本
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: "#4ade80",
                fontFamily: "Syne,sans-serif",
                lineHeight: 1,
              }}
            >
              ¥{bill.costTotal.toFixed(2)}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#818cf8",
                fontFamily: "DM Mono,monospace",
                marginTop: 4,
              }}
            >
              {bill.carbonKg.toFixed(3)} kgCO₂eq
            </div>
          </div>
        </div>
      </div>

      {/* Three-term ABC allocation */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {[
          {
            tm: "Term ①",
            tl: "机器直供电 / Direct Machine Energy",
            icon: "⚙️",
            v: bill.eD,
            c: ac,
            formula: `P_base × t = ${machine.kw} × ${dur} = ${bill.eD.toFixed(
              1
            )} kWh`,
            desc: "LSTM-predicted direct electricity by motor drives & UV curing",
          },
          {
            tm: "Term ②",
            tl: "环境基准暖通 / Baseline HVAC Energy",
            icon: "❄️",
            v: bill.eB,
            c: "#818cf8",
            formula: `(t_i / T_total) × β₀ = (${dur}/8) × ${
              sp.beta0
            } = ${bill.eB.toFixed(1)} kWh`,
            desc: "Time-proportional share of ambient temperature control baseline",
          },
          {
            tm: "Term ③",
            tl: "热诱导代偿 / Thermal-Induced HVAC",
            icon: "🔥",
            v: bill.eT,
            c: "#f97316",
            formula: `β₁ × E_dir = ${machine.beta1} × ${bill.eD.toFixed(
              1
            )} = ${bill.eT.toFixed(1)} kWh`,
            desc: "Production-forced cooling compensation — the innovation core",
          },
        ].map(({ tm, tl, icon, v, c, formula, desc }) => (
          <div
            key={tm}
            style={{
              background: "#070d1a",
              border: `1px solid ${c}33`,
              borderRadius: 12,
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: c,
                  fontWeight: 700,
                  fontFamily: "DM Mono,monospace",
                }}
              >
                {tm}
              </span>
              <span style={{ fontSize: 18 }}>{icon}</span>
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#64748b",
                marginBottom: 12,
                lineHeight: 1.5,
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              {tl}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: c,
                marginBottom: 4,
                fontFamily: "Syne,sans-serif",
                lineHeight: 1,
              }}
            >
              {v.toFixed(1)}{" "}
              <span style={{ fontSize: 12, fontWeight: 400, color: "#334155" }}>
                kWh
              </span>
            </div>
            <div
              style={{
                background: "#040810",
                borderRadius: 5,
                padding: "6px 9px",
                fontSize: 9,
                color: "#1e3050",
                fontFamily: "DM Mono,monospace",
                marginBottom: 8,
              }}
            >
              {formula}
            </div>
            <div style={{ fontSize: 9, color: "#1e3050", lineHeight: 1.5 }}>
              {desc}
            </div>
          </div>
        ))}
      </div>

      {/* Allocation formula */}
      <div
        style={{
          background: "#070d1a",
          border: "1px solid #0e1e38",
          borderRadius: 8,
          padding: "12px 18px",
          marginBottom: 16,
          fontFamily: "DM Mono,monospace",
          fontSize: 12,
          color: "#64748b",
        }}
      >
        <b style={{ color: "#4ade80" }}>E_total_i</b> = E_dir + (t_i/T)·β₀ +
        β₁·E_dir &nbsp;=&nbsp;
        <b style={{ color: ac }}>{bill.eD.toFixed(1)}</b> +{" "}
        <b style={{ color: "#818cf8" }}>{bill.eB.toFixed(1)}</b> +{" "}
        <b style={{ color: "#f97316" }}>{bill.eT.toFixed(1)}</b>
        &nbsp;={" "}
        <b style={{ color: "#4ade80", fontSize: 14 }}>
          {bill.eTotal.toFixed(1)} kWh
        </b>
        <span style={{ color: "#1e3050", fontSize: 10, marginLeft: 16 }}>
          — Section 3.5, Dissertation
        </span>
      </div>

      {/* Cost grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          [
            "电费 / Electricity",
            `¥${bill.costElec.toFixed(2)}`,
            `¥${bill.aT.toFixed(4)}/kWh weighted avg${
              bill.july && startHour >= 14 && startHour < 18
                ? " ⚡ CPP +25%"
                : ""
            }`,
            "#facc15",
          ],
          [
            "碳惩罚 / Carbon Penalty",
            `¥${bill.costCarbon.toFixed(2)}`,
            `${bill.aC.toFixed(3)} kgCO₂/kWh × ¥0.065/kg (CEA)`,
            "#f97316",
          ],
          [
            "碳足迹 / PCF",
            `${bill.carbonKg.toFixed(3)} kg`,
            "ISO 14067:2018 · Scope 2 · Gate-to-Gate",
            "#818cf8",
          ],
          [
            "订单总成本 / Total",
            `¥${bill.costTotal.toFixed(2)}`,
            "Green Premium pricing basis — eliminates Carbon Cost Distortion",
            "#4ade80",
          ],
        ].map(([l, v, s, c]) => (
          <div
            key={l}
            style={{
              background: "#070d1a",
              border: `1px solid ${c}33`,
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 8,
                color: "#1e3050",
                marginBottom: 5,
                fontFamily: "DM Mono,monospace",
              }}
            >
              {l}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: c,
                fontFamily: "DM Mono,monospace",
              }}
            >
              {v}
            </div>
            <div
              style={{
                fontSize: 8,
                color: "#0e1e38",
                marginTop: 5,
                lineHeight: 1.5,
              }}
            >
              {s}
            </div>
          </div>
        ))}
      </div>

      {/* Composition bar */}
      <div
        style={{
          background: "#070d1a",
          border: "1px solid #0e1e38",
          borderRadius: 10,
          padding: "14px 16px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: "#475569",
            marginBottom: 10,
            fontFamily: "DM Sans,sans-serif",
          }}
        >
          能耗三项构成比 / Energy Composition Breakdown
        </div>
        <div
          style={{
            display: "flex",
            height: 20,
            borderRadius: 4,
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          {[
            [bill.eD, ac, "Direct"],
            [bill.eB, "#818cf8", "Baseline"],
            [bill.eT, "#f97316", "Thermal"],
          ].map(([v, c, l]) => (
            <div
              key={l}
              title={`${l}: ${v.toFixed(1)}kWh`}
              style={{
                flex: v,
                background: c + "99",
                transition: "flex 0.5s ease",
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: 20,
            fontSize: 10,
            color: "#334155",
            fontFamily: "DM Mono,monospace",
          }}
        >
          {[
            [bill.eD, ac, "Direct Machine"],
            [bill.eB, "#818cf8", "Baseline HVAC"],
            [bill.eT, "#f97316", "Thermal-Induced"],
          ].map(([v, c, l]) => (
            <div
              key={l}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: c,
                  borderRadius: 2,
                  display: "inline-block",
                }}
              />
              {l}: {v.toFixed(1)} kWh ({((v / bill.eTotal) * 100).toFixed(0)}%)
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   components/SchedulePanel  —  Tab 2
═══════════════════════════════════════════════════════════════════════════ */
const SchedulePanel = ({ machine, result, dur, startHour, season }) => {
  const { rec } = result;
  const ac = machine.accent;
  const isJuly = season === "peak";
  const touData = Array.from({ length: 24 }, (_, h) => ({
    h: String(h).padStart(2, "0"),
    rate: tariff(h, isJuly),
    period: period(h),
  }));

  return (
    <div>
      {/* Strategy decision card */}
      <div
        style={{
          background: "#080d1a",
          border: `2px solid ${rec.col}`,
          borderRadius: 14,
          padding: "20px 24px",
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span style={{ fontSize: 28, flexShrink: 0 }}>{rec.icon}</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: rec.col,
                  fontFamily: "Syne,sans-serif",
                }}
              >
                {rec.strat}
              </div>
              <div
                style={{
                  background:
                    rec.urg === "HIGH"
                      ? "#450a0a"
                      : rec.urg === "MEDIUM"
                      ? "#431407"
                      : "#052e16",
                  color:
                    rec.urg === "HIGH"
                      ? "#fca5a5"
                      : rec.urg === "MEDIUM"
                      ? "#fed7aa"
                      : "#86efac",
                  padding: "2px 9px",
                  borderRadius: 4,
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: "DM Mono,monospace",
                }}
              >
                URGENCY: {rec.urg}
              </div>
            </div>
            <div
              style={{
                background: "#070d1a",
                borderLeft: `3px solid ${rec.col}`,
                borderRadius: 4,
                padding: "10px 14px",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 8,
                  color: "#1e3050",
                  marginBottom: 3,
                  fontFamily: "DM Mono,monospace",
                }}
              >
                EAGA SYSTEM ACTION ▸
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#f1f5f9",
                  fontWeight: 600,
                  fontFamily: "DM Sans,sans-serif",
                }}
              >
                {rec.action}
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#64748b",
                lineHeight: 1.8,
                marginBottom: 12,
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              <b style={{ color: "#334155" }}>Analysis: </b>
              {rec.reason}
            </div>
            <div
              style={{
                display: "inline-block",
                background: `${rec.col}18`,
                border: `1px solid ${rec.col}44`,
                borderRadius: 6,
                padding: "5px 14px",
                fontSize: 12,
                color: rec.col,
                fontWeight: 700,
                fontFamily: "DM Mono,monospace",
              }}
            >
              💰 {rec.saving}
            </div>
          </div>
        </div>
      </div>

      {/* Single-job Gantt */}
      <div
        style={{
          background: "#070d1a",
          border: "1px solid #0e1e38",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#64748b",
            marginBottom: 14,
            fontFamily: "DM Sans,sans-serif",
          }}
        >
          单订单甘特图 / Single-Job Scheduling Gantt — 24H Horizon
        </div>
        <GanttBar
          label={`${machine.model.split(" ")[0]} — FCFS Baseline`}
          start={startHour}
          end={startHour + dur}
          color={ac}
          bold
        />
        <GanttBar
          label={`${rec.optM.model.split(" ")[0]} — EAGA Optimised`}
          start={rec.optStart}
          end={rec.optStart + dur}
          color={rec.col}
          bold
        />
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 10,
            fontSize: 9,
            color: "#1e3050",
            fontFamily: "DM Mono,monospace",
          }}
        >
          {[
            [ac, "FCFS Baseline"],
            [rec.col, "EAGA Optimised"],
            ["#22d3ee44", "Valley 00–08"],
            ["#f8717144", "Peak 14–18"],
          ].map(([c, l]) => (
            <div
              key={l}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <span
                style={{
                  width: 10,
                  height: 7,
                  background: c,
                  border: `1px solid ${c}88`,
                  borderRadius: 2,
                  display: "inline-block",
                }}
              />
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* TOU profile */}
      <div
        style={{
          background: "#070d1a",
          border: "1px solid #0e1e38",
          borderRadius: 12,
          padding: "16px 20px",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#64748b",
            marginBottom: 10,
            fontFamily: "DM Sans,sans-serif",
          }}
        >
          分时电价曲线 / 24H TOU Tariff Profile —{" "}
          {isJuly ? "July · CPP Active (14–18h +25%)" : "November · Standard"}
        </div>
        <div
          style={{
            display: "flex",
            height: 50,
            gap: 1,
            overflow: "hidden",
            borderRadius: 4,
          }}
        >
          {touData.map(({ h, rate, period: p }) => {
            const isNow = Number(h) === startHour;
            const isOpt = Number(h) === Math.floor(rec.optStart);
            const c = PERIOD_COLORS[p];
            return (
              <div
                key={h}
                title={`${h}:00 ¥${rate}/kWh`}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  position: "relative",
                  borderTop: isNow
                    ? `2px solid ${ac}`
                    : isOpt && !isNow
                    ? `2px solid ${rec.col}`
                    : "2px solid transparent",
                  cursor: "default",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${(rate / 1.6) * 100}%`,
                    background: c + "88",
                    transition: "height 0.3s",
                  }}
                />
                {isNow && (
                  <div
                    style={{
                      position: "absolute",
                      top: -15,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 7,
                      color: ac,
                      whiteSpace: "nowrap",
                      fontWeight: 700,
                      fontFamily: "DM Mono,monospace",
                    }}
                  >
                    ▼NOW
                  </div>
                )}
                {isOpt && !isNow && (
                  <div
                    style={{
                      position: "absolute",
                      top: -15,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 7,
                      color: rec.col,
                      whiteSpace: "nowrap",
                      fontWeight: 700,
                      fontFamily: "DM Mono,monospace",
                    }}
                  >
                    ★OPT
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 8,
            color: "#1e3050",
            marginTop: 5,
            fontFamily: "DM Mono,monospace",
          }}
        >
          <span>00 Valley ¥0.40</span>
          <span>08 Flat ¥0.80</span>
          <span>14 Peak {isJuly ? "¥1.50 (CPP)" : "¥1.20"}</span>
          <span>18 Flat</span>
          <span>24</span>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   components/BatchModal  —  EAGA N=15 Scheduler (NEW)
═══════════════════════════════════════════════════════════════════════════ */
const MACHINE_COLORS_BATCH = {
  M1: "#f87171",
  M2: "#fb923c",
  M3: "#facc15",
  M4: "#4ade80",
  M5: "#22d3ee",
};

const BatchModal = ({ onClose, season }) => {
  const [activeView, setActiveView] = useState("base");
  const isJuly = season === "peak";
  const { base, opt } = useMemo(() => buildBatchGantt(isJuly), [isJuly]);

  const totalBaseKwh = base.reduce((s, j) => {
    const m = PRESS_LIBRARY.find((p) => p.id === `LP-${j.machine}`);
    return s + (m?.kw || 40) * (j.end - j.start);
  }, 0);
  const totalOptKwh = opt.reduce((s, j) => {
    const m = PRESS_LIBRARY.find((p) => p.id === `LP-${j.machine}`);
    return s + (m?.kw || 22) * (j.end - j.start);
  }, 0);
  const costSavePct = isJuly ? 67.28 : 31.49;
  const carbonSavePct = isJuly ? 54.89 : 21.81;

  const jobs = activeView === "base" ? base : opt;
  const machines = ["M1", "M2", "M3", "M4", "M5"];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.88)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#070d1a",
          border: "1px solid #1e3050",
          borderRadius: 16,
          width: "100%",
          maxWidth: 900,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            background: "#0a1020",
            borderBottom: "1px solid #1e3050",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 8,
                color: "#1e3050",
                letterSpacing: 3,
                marginBottom: 3,
                fontFamily: "DM Mono,monospace",
              }}
            >
              EAGA BATCH SCHEDULER · N=15 JOBS · LEO PAPER MES DATA
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "#f1f5f9",
                fontFamily: "Syne,sans-serif",
              }}
            >
              🚀 多订单智能排产引擎 / EAGA Multi-Job Optimizer
            </div>
            <div
              style={{
                fontSize: 9,
                color: "#334155",
                marginTop: 2,
                fontFamily: "DM Mono,monospace",
              }}
            >
              Pop=100 · Gen=200 · Pc=0.85 · Pm=0.10 ·{" "}
              {isJuly
                ? "July Peak: Temporal Shifting"
                : "Nov Slack: Deep Eco-Routing"}{" "}
              strategy active
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#0e1e38",
              border: "1px solid #1e3050",
              borderRadius: 6,
              color: "#64748b",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "DM Mono,monospace",
            }}
          >
            ✕ Close
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {/* KPI summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 10,
              marginBottom: 20,
            }}
          >
            {[
              ["N Jobs", "15", "Stratified MES sample", "#22d3ee"],
              [
                "Baseline Cost",
                isJuly ? "¥639" : "¥248",
                "FCFS historical",
                "#f87171",
              ],
              ["Cost Saving", `${costSavePct}%`, "EAGA optimised", "#4ade80"],
              [
                "Carbon Saving",
                `${carbonSavePct}%`,
                "vs. FCFS baseline",
                "#818cf8",
              ],
            ].map(([l, v, s, c]) => (
              <div
                key={l}
                style={{
                  background: "#0a0f1e",
                  border: `1px solid ${c}33`,
                  borderRadius: 8,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    color: "#1e3050",
                    marginBottom: 4,
                    fontFamily: "DM Mono,monospace",
                  }}
                >
                  {l}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: c,
                    fontFamily: "DM Mono,monospace",
                  }}
                >
                  {v}
                </div>
                <div style={{ fontSize: 8, color: "#0e1e38", marginTop: 4 }}>
                  {s}
                </div>
              </div>
            ))}
          </div>

          {/* Toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              ["base", "📊 FCFS Baseline (历史实际)"],
              ["opt", "⚡ EAGA Optimised (算法结果)"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setActiveView(k)}
                style={{
                  padding: "8px 16px",
                  background: activeView === k ? "#0e1e38" : "transparent",
                  border: `1px solid ${
                    activeView === k ? "#38bdf8" : "#1e3050"
                  }`,
                  borderRadius: 6,
                  color: activeView === k ? "#7dd3fc" : "#334155",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "DM Mono,monospace",
                  fontWeight: activeView === k ? 700 : 400,
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Gantt */}
          <div
            style={{
              background: "#0a0f1e",
              border: "1px solid #0e1e38",
              borderRadius: 12,
              padding: "16px 18px",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#64748b",
                marginBottom: 14,
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              {activeView === "base"
                ? "FCFS 历史排产甘特图 / Historical FCFS Schedule"
                : "EAGA 优化排产甘特图 / EAGA Optimised Schedule"}
              <span style={{ marginLeft: 12, fontSize: 9, color: "#1e3050" }}>
                {activeView === "opt"
                  ? isJuly
                    ? "时间避峰策略激活 / Temporal Shifting Active"
                    : "深度生态路由激活 / Deep Eco-Routing Active"
                  : ""}
              </span>
            </div>
            {/* Hour ruler */}
            <div
              style={{
                display: "flex",
                marginLeft: 140,
                marginBottom: 6,
                position: "relative",
              }}
            >
              {[0, 4, 8, 12, 14, 16, 18, 20, 24].map((h) => (
                <div
                  key={h}
                  style={{
                    position: "absolute",
                    left: `${(h / 24) * 100}%`,
                    fontSize: 8,
                    color:
                      h >= 14 && h < 18
                        ? "#f87171"
                        : h < 8
                        ? "#22d3ee"
                        : "#1e3050",
                    fontFamily: "DM Mono,monospace",
                    transform: "translateX(-50%)",
                  }}
                >
                  {String(h).padStart(2, "0")}
                </div>
              ))}
            </div>
            <div style={{ height: 10 }} />
            {/* Machine rows */}
            {machines.map((m) => {
              const mJobs = jobs.filter((j) => j.machine === m);
              return (
                <div
                  key={m}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 7,
                  }}
                >
                  <div
                    style={{
                      width: 140,
                      fontSize: 10,
                      color: MACHINE_COLORS_BATCH[m],
                      flexShrink: 0,
                      fontFamily: "DM Mono,monospace",
                    }}
                  >
                    {m} ·{" "}
                    {PRESS_LIBRARY.find((p) => p.id === `LP-${m}`)?.kw || "?"}kW
                  </div>
                  <div
                    style={{
                      flex: 1,
                      position: "relative",
                      height: 28,
                      background: "#040810",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        width: "33.3%",
                        height: "100%",
                        background: "#22d3ee06",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: "58.3%",
                        width: "16.7%",
                        height: "100%",
                        background: "#f8717106",
                      }}
                    />
                    {mJobs.map((j, i) => {
                      const l = (j.start / 24) * 100,
                        w = Math.max(0.5, ((j.end - j.start) / 24) * 100);
                      return (
                        <div
                          key={i}
                          title={`${j.job} · Ink ${(j.ink * 100).toFixed(0)}%`}
                          style={{
                            position: "absolute",
                            left: `${l}%`,
                            width: `${Math.min(w, 99 - l)}%`,
                            height: "100%",
                            background: MACHINE_COLORS_BATCH[m] + "55",
                            border: `1px solid ${MACHINE_COLORS_BATCH[m]}`,
                            borderRadius: 3,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 7,
                              color: "#f1f5f9",
                              fontFamily: "DM Mono,monospace",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {j.job.replace("J-", "")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparison table */}
          <div
            style={{
              background: "#0a0f1e",
              border: "1px solid #0e1e38",
              borderRadius: 10,
              padding: "14px 18px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#64748b",
                marginBottom: 12,
                fontFamily: "DM Sans,sans-serif",
              }}
            >
              Table 4.2 — DSS Empirical Accounting Summary (Reproduced from
              Dissertation)
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr",
                gap: 1,
                background: "#1e3050",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              {[
                "Scenario",
                "Baseline Cost",
                "Optimised Cost",
                "Cost Reduction",
                "Baseline Carbon",
                "Optimised Carbon",
                "Carbon Reduction",
              ].map((h) => (
                <div
                  key={h}
                  style={{
                    background: "#0c1628",
                    padding: "8px 10px",
                    fontSize: 8,
                    color: "#475569",
                    fontFamily: "DM Mono,monospace",
                  }}
                >
                  {h}
                </div>
              ))}
              {[
                [
                  "July Peak Season",
                  "¥639.08",
                  "¥209.09",
                  "67.28%",
                  "357.28 kg",
                  "161.17 kg",
                  "54.89%",
                ],
                [
                  "Nov Slack Season",
                  "¥248.04",
                  "¥169.93",
                  "31.49%",
                  "164.93 kg",
                  "128.96 kg",
                  "21.81%",
                ],
              ].map((row, ri) =>
                row.map((cell, ci) => (
                  <div
                    key={`${ri}-${ci}`}
                    style={{
                      background: "#070d1a",
                      padding: "9px 10px",
                      fontSize: 10,
                      color:
                        ci === 3 || ci === 6
                          ? "#4ade80"
                          : ci === 0
                          ? "#f1f5f9"
                          : "#94a3b8",
                      fontFamily: "DM Mono,monospace",
                      fontWeight: ci === 3 || ci === 6 ? 700 : 400,
                    }}
                  >
                    {cell}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   components/PressLibrary  —  Machine grid view
═══════════════════════════════════════════════════════════════════════════ */
const BRAND_NAMES = ["All", ...new Set(PRESS_LIBRARY.map((m) => m.brand))];

const PressLibrary = ({ onSelect, selected }) => {
  const [brand, setBrand] = useState("All");
  const [cat, setCat] = useState("All");
  const [tier, setTier] = useState("All");
  const [uvOnly, setUvOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("kw");

  const filtered = useMemo(
    () =>
      PRESS_LIBRARY.filter((m) => {
        if (brand !== "All" && m.brand !== brand) return false;
        if (cat !== "All" && m.cat !== cat) return false;
        if (tier !== "All" && m.tier !== tier) return false;
        if (uvOnly && !m.uv) return false;
        if (q) {
          const s = q.toLowerCase();
          if (
            !m.model.toLowerCase().includes(s) &&
            !m.brand.toLowerCase().includes(s) &&
            !m.tags.join(" ").includes(s)
          )
            return false;
        }
        return true;
      }).sort((a, b) =>
        sortBy === "kw"
          ? b.kw - a.kw
          : sortBy === "beta1"
          ? b.beta1 - a.beta1
          : sortBy === "year"
          ? b.year - a.year
          : a.brand.localeCompare(b.brand)
      ),
    [brand, cat, tier, uvOnly, q, sortBy]
  );

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Filter bar */}
      <div
        style={{
          background: "#070d1a",
          borderBottom: "1px solid #0e1e38",
          padding: "12px 24px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索机型 / 品牌 / Search model, brand, tags…"
            style={{
              background: "#0a1020",
              border: "1px solid #1e3050",
              borderRadius: 6,
              color: "#f1f5f9",
              padding: "7px 12px",
              fontSize: 11,
              width: 260,
              fontFamily: "DM Mono,monospace",
              outline: "none",
            }}
          />
          {[
            [brand, setBrand, BRAND_NAMES, "Brand"],
            [cat, setCat, ["All", "small", "medium", "large"], "Format"],
            [
              tier,
              setTier,
              ["All", "entry", "legacy", "eco", "mid", "premium", "flagship"],
              "Tier",
            ],
          ].map(([val, fn, opts, ph]) => (
            <select
              key={ph}
              value={val}
              onChange={(e) => fn(e.target.value)}
              style={{
                background: "#0a1020",
                border: "1px solid #1e3050",
                borderRadius: 5,
                color: "#94a3b8",
                padding: "7px 10px",
                fontSize: 10,
                fontFamily: "DM Mono,monospace",
                cursor: "pointer",
              }}
            >
              {opts.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ))}
          <button
            onClick={() => setUvOnly(!uvOnly)}
            style={{
              background: uvOnly ? "#1e3a5f" : "transparent",
              border: `1px solid ${uvOnly ? "#38bdf8" : "#1e3050"}`,
              borderRadius: 5,
              color: uvOnly ? "#7dd3fc" : "#334155",
              padding: "7px 10px",
              fontSize: 10,
              cursor: "pointer",
              fontFamily: "DM Mono,monospace",
            }}
          >
            {uvOnly ? "✓ " : ""}UV Only
          </button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
            {[
              ["kw", "功率"],
              ["beta1", "β₁"],
              ["year", "年份"],
              ["brand", "品牌"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setSortBy(k)}
                style={{
                  background: sortBy === k ? "#0e1e38" : "transparent",
                  border: `1px solid ${sortBy === k ? "#475569" : "#1e3050"}`,
                  borderRadius: 4,
                  color: sortBy === k ? "#94a3b8" : "#334155",
                  padding: "4px 8px",
                  fontSize: 9,
                  cursor: "pointer",
                  fontFamily: "DM Mono,monospace",
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <span
            style={{
              fontSize: 10,
              color: "#1e3050",
              fontFamily: "DM Mono,monospace",
            }}
          >
            {filtered.length}/{PRESS_LIBRARY.length}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {/* Brand pills */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          {BRAND_NAMES.slice(1).map((br) => {
            const count = filtered.filter((m) => m.brand === br).length;
            if (!count) return null;
            const c =
              PRESS_LIBRARY.find((m) => m.brand === br)?.accent || "#64748b";
            return (
              <div
                key={br}
                onClick={() => setBrand(brand === br ? "All" : br)}
                style={{
                  background: "#070d1a",
                  border: `1px solid ${c}33`,
                  borderRadius: 7,
                  padding: "5px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    background: c,
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: "#64748b",
                    fontFamily: "DM Mono,monospace",
                  }}
                >
                  {br}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: c,
                    fontFamily: "DM Mono,monospace",
                  }}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>

        {/* Machine cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))",
            gap: 12,
          }}
        >
          {filtered.map((m) => (
            <div
              key={m.id}
              onClick={() => onSelect(m)}
              style={{
                background: "#070d1a",
                border: `1px solid ${
                  selected?.id === m.id ? m.accent : "#0e1e38"
                }`,
                borderRadius: 12,
                padding: "16px 18px",
                cursor: "pointer",
                transition: "all 0.15s",
                boxShadow:
                  selected?.id === m.id ? `0 0 20px ${m.accent}22` : "none",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = m.accent + "88")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor =
                  selected?.id === m.id ? m.accent : "#0e1e38")
              }
            >
              {/* Card header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        background: m.accent,
                        borderRadius: "50%",
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: m.accent,
                        fontFamily: "DM Sans,sans-serif",
                      }}
                    >
                      {m.brand}
                    </span>
                    <TierBadge tier={m.tier} />
                    {m.uv && (
                      <span
                        style={{
                          background: "#1e3a5f",
                          color: "#93c5fd",
                          padding: "1px 6px",
                          borderRadius: 3,
                          fontSize: 8,
                          fontWeight: 700,
                          fontFamily: "DM Mono,monospace",
                        }}
                      >
                        UV
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#f1f5f9",
                      fontFamily: "Syne,sans-serif",
                      lineHeight: 1.3,
                    }}
                  >
                    {m.model}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "#1e3050",
                      marginTop: 3,
                      fontFamily: "DM Mono,monospace",
                    }}
                  >
                    {m.id} · {m.year} · {m.format} · {m.colors}C
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      color: m.accent,
                      fontFamily: "Syne,sans-serif",
                      lineHeight: 1,
                    }}
                  >
                    {m.kw}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "#1e3050",
                      fontFamily: "DM Mono,monospace",
                    }}
                  >
                    kW
                  </div>
                </div>
              </div>
              {/* Power bar */}
              <div
                style={{
                  height: 3,
                  background: "#0e1e38",
                  borderRadius: 2,
                  marginBottom: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(m.kw / 82) * 100}%`,
                    background: `linear-gradient(90deg,${m.accent}66,${m.accent})`,
                    borderRadius: 2,
                  }}
                />
              </div>
              {/* Metrics */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                {[
                  ["β₁", m.beta1, "Thermal Coeff"],
                  ["Format", m.format, "Print Size"],
                  ["Year", m.year, "Manufacture"],
                ].map(([k, v, tip]) => (
                  <div key={k} title={tip}>
                    <div
                      style={{
                        fontSize: 8,
                        color: "#1e3050",
                        fontFamily: "DM Mono,monospace",
                      }}
                    >
                      {k}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#64748b",
                        fontFamily: "DM Mono,monospace",
                      }}
                    >
                      {v}
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <span
                    style={{
                      fontSize: 9,
                      color: "#22d3ee",
                      fontFamily: "DM Mono,monospace",
                      fontWeight: 700,
                    }}
                  >
                    ANALYZE →
                  </span>
                </div>
              </div>
              {/* Tags */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {m.tags.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    style={{
                      background: "#0e1e38",
                      color: "#1e3050",
                      padding: "2px 6px",
                      borderRadius: 3,
                      fontSize: 8,
                      fontFamily: "DM Mono,monospace",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   App  —  Root orchestrator
═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [machine, setMachine] = useState(null);
  const [view, setView] = useState("library"); // "library" | "analysis"
  const [dur, setDur] = useState(3.5);
  const [ink, setInk] = useState(0.75);
  const [sh, setSh] = useState(15);
  const [season, setSeason] = useState("peak");
  const [tab, setTab] = useState(0);
  const [result, setResult] = useState(null);
  const [batchOpen, setBatchOpen] = useState(false);

  // Recompute whenever params change
  useEffect(() => {
    if (!machine) return;
    const profile = buildProfile(machine, dur, ink, sh);
    const bill = calcBill(machine, dur, ink, sh, season);
    const rec = getRec(machine, sh, season, ink);
    setResult({ profile, bill, rec });
  }, [machine, dur, ink, sh, season]);

  const handleSelect = useCallback((m) => {
    setMachine(m);
    setView("analysis");
    setTab(0);
  }, []);

  const sp = SEASON_PARAMS[season];
  const ac = machine?.accent ?? "#22d3ee";

  return (
    <>
      {/* Inject fonts */}
      <style>{FONTS}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#030912",
          color: "#cbd5e1",
          fontFamily: "DM Sans,sans-serif",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── GLOBAL HEADER ──────────────────────────────────────────── */}
        <div
          style={{
            background: "linear-gradient(90deg,#060d1f 0%,#080f22 100%)",
            borderBottom: "1px solid #0e1e38",
            padding: "14px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 8,
                color: "#1e3050",
                letterSpacing: 3,
                marginBottom: 3,
                fontFamily: "DM Mono,monospace",
              }}
            >
              HKU DASE7099 · ZHANG YUTIAN · LEO PAPER WORKSHOP · DSS v4.0
            </div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 800,
                color: "#f1f5f9",
                fontFamily: "Syne,sans-serif",
                letterSpacing: 0.3,
              }}
            >
              PrintCarbon Intelligence Platform
            </div>
            <div
              style={{
                fontSize: 9,
                color: "#1e3050",
                fontFamily: "DM Mono,monospace",
              }}
            >
              {PRESS_LIBRARY.length} machines ·{" "}
              {new Set(PRESS_LIBRARY.map((m) => m.brand)).size} brands ·{" "}
              {PRESS_LIBRARY.filter((m) => m.uv).length} UV-capable · LSTM +
              Thermal Reg + ABC + EAGA
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* EAGA Batch button */}
            <button
              onClick={() => setBatchOpen(true)}
              style={{
                background: "linear-gradient(135deg,#1a0533,#2e1065)",
                border: "1px solid #7c3aed",
                borderRadius: 8,
                color: "#c4b5fd",
                padding: "8px 16px",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "DM Mono,monospace",
                fontWeight: 700,
                letterSpacing: 0.3,
                boxShadow: "0 0 14px #7c3aed33",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.boxShadow = "0 0 22px #7c3aed66")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.boxShadow = "0 0 14px #7c3aed33")
              }
            >
              🚀 Launch EAGA Batch Scheduler
            </button>
            {/* View toggle */}
            {[
              ["library", "📚 机器库 / Library"],
              ["analysis", "⚡ 分析台 / Analysis"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => {
                  if (k === "analysis" && !machine) return;
                  setView(k);
                }}
                style={{
                  padding: "8px 14px",
                  background: view === k ? "#0e1e38" : "transparent",
                  border: `1px solid ${view === k ? "#38bdf8" : "#1e3050"}`,
                  borderRadius: 6,
                  color:
                    view === k
                      ? "#7dd3fc"
                      : machine || k === "library"
                      ? "#475569"
                      : "#1e3050",
                  fontSize: 10,
                  cursor:
                    k === "analysis" && !machine ? "not-allowed" : "pointer",
                  fontFamily: "DM Mono,monospace",
                  fontWeight: view === k ? 700 : 400,
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ── LIBRARY VIEW ───────────────────────────────────────────── */}
        {view === "library" && (
          <PressLibrary onSelect={handleSelect} selected={machine} />
        )}

        {/* ── ANALYSIS VIEW ──────────────────────────────────────────── */}
        {view === "analysis" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Left sidebar */}
            <div
              style={{
                width: 264,
                minWidth: 264,
                background: "#070d1a",
                borderRight: "1px solid #0e1e38",
                padding: "16px",
                overflowY: "auto",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setView("library")}
                style={{
                  background: "transparent",
                  border: "1px solid #1e3050",
                  borderRadius: 6,
                  color: "#475569",
                  padding: "6px 10px",
                  fontSize: 9,
                  cursor: "pointer",
                  fontFamily: "DM Mono,monospace",
                  marginBottom: 16,
                  width: "100%",
                }}
              >
                ← 返回机器库 / Back to Library
              </button>

              {/* Current machine card */}
              {machine && (
                <div
                  style={{
                    background: "#040810",
                    border: `1px solid ${ac}55`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        background: ac,
                        borderRadius: "50%",
                        display: "inline-block",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        color: ac,
                        fontWeight: 600,
                        fontFamily: "DM Sans,sans-serif",
                      }}
                    >
                      {machine.brand}
                    </span>
                    <TierBadge tier={machine.tier} />
                    {machine.uv && (
                      <span
                        style={{
                          background: "#1e3a5f",
                          color: "#93c5fd",
                          padding: "1px 6px",
                          borderRadius: 3,
                          fontSize: 8,
                          fontWeight: 700,
                          fontFamily: "DM Mono,monospace",
                        }}
                      >
                        UV
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#f1f5f9",
                      fontFamily: "Syne,sans-serif",
                    }}
                  >
                    {machine.model}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "#1e3050",
                      fontFamily: "DM Mono,monospace",
                      marginTop: 3,
                    }}
                  >
                    {machine.id} · {machine.kw}kW · β₁={machine.beta1} ·{" "}
                    {machine.year}
                  </div>
                </div>
              )}

              {/* Params */}
              {[
                [
                  "作业时长 / Duration",
                  dur,
                  0.5,
                  8,
                  0.5,
                  (v) => setDur(+v),
                  `${dur.toFixed(1)} hrs`,
                  ac,
                  null,
                ],
                [
                  "墨量覆盖率 / Ink Coverage",
                  ink,
                  0.05,
                  1,
                  0.05,
                  (v) => setInk(+v),
                  `${(ink * 100).toFixed(0)}%`,
                  ink > 0.6 ? "#f87171" : ac,
                  ink > 0.6 ? "⚠ 高墨量 High-ink" : null,
                ],
                [
                  "开始时间 / Start Hour",
                  sh,
                  0,
                  23,
                  1,
                  (v) => setSh(+v),
                  `${String(sh).padStart(2, "0")}:00`,
                  PERIOD_COLORS[period(sh)],
                  null,
                ],
              ].map(([l, val, min, max, step, fn, disp, col, warn]) => (
                <div key={l} style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      fontSize: 9,
                      color: "#334155",
                      display: "block",
                      marginBottom: 5,
                      fontFamily: "DM Mono,monospace",
                    }}
                  >
                    {l} <b style={{ float: "right", color: col }}>{disp}</b>
                  </label>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={val}
                    onChange={(e) => fn(e.target.value)}
                    style={{
                      width: "100%",
                      accentColor: col,
                      cursor: "pointer",
                    }}
                  />
                  {warn && (
                    <div
                      style={{
                        fontSize: 9,
                        color: "#f87171",
                        marginTop: 2,
                        fontFamily: "DM Mono,monospace",
                      }}
                    >
                      {warn}
                    </div>
                  )}
                </div>
              ))}

              {/* Period quick-set */}
              <div style={{ display: "flex", gap: 5, marginBottom: 16 }}>
                {[
                  ["谷 Valley", 3, "#22d3ee"],
                  ["平 Flat", 10, "#facc15"],
                  ["峰 Peak", 16, "#f87171"],
                ].map(([l, h, c]) => (
                  <button
                    key={l}
                    onClick={() => setSh(h)}
                    style={{
                      flex: 1,
                      padding: "5px 0",
                      background: sh === h ? c + "22" : "transparent",
                      border: `1px solid ${c}55`,
                      borderRadius: 4,
                      color: c,
                      fontSize: 8,
                      cursor: "pointer",
                      fontFamily: "DM Mono,monospace",
                      lineHeight: 1.4,
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {/* Season */}
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 9,
                    color: "#1e3050",
                    marginBottom: 6,
                    fontFamily: "DM Mono,monospace",
                  }}
                >
                  生产季节 / Season
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    ["peak", "☀ 旺季 Peak"],
                    ["slack", "🌙 淡季 Slack"],
                  ].map(([k, l]) => (
                    <button
                      key={k}
                      onClick={() => setSeason(k)}
                      style={{
                        flex: 1,
                        padding: "7px 0",
                        background: season === k ? "#0e1e38" : "transparent",
                        border: `1px solid ${
                          season === k ? "#38bdf8" : "#1e3050"
                        }`,
                        borderRadius: 5,
                        color: season === k ? "#7dd3fc" : "#334155",
                        fontSize: 9,
                        cursor: "pointer",
                        fontFamily: "DM Mono,monospace",
                        fontWeight: season === k ? 700 : 400,
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Related machines */}
              <div
                style={{
                  fontSize: 9,
                  color: "#1e3050",
                  fontFamily: "DM Mono,monospace",
                  letterSpacing: 1,
                  marginBottom: 8,
                }}
              >
                相近规格 / Similar Spec
              </div>
              {PRESS_LIBRARY.filter(
                (m) =>
                  m.id !== machine?.id &&
                  Math.abs(m.kw - (machine?.kw || 0)) < 14
              )
                .slice(0, 5)
                .map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      setMachine(m);
                      setTab(0);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 9px",
                      marginBottom: 5,
                      background: "#040810",
                      border: "1px solid #0e1e38",
                      borderRadius: 6,
                      cursor: "pointer",
                      transition: "border-color 0.12s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = m.accent)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "#0e1e38")
                    }
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        background: m.accent,
                        borderRadius: "50%",
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 9,
                          color: "#64748b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontFamily: "DM Mono,monospace",
                        }}
                      >
                        {m.model}
                      </div>
                      <div
                        style={{
                          fontSize: 8,
                          color: "#1e3050",
                          fontFamily: "DM Mono,monospace",
                        }}
                      >
                        {m.kw}kW · β₁={m.beta1}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 9,
                        color: "#22d3ee",
                        fontFamily: "DM Mono,monospace",
                      }}
                    >
                      →
                    </span>
                  </div>
                ))}
            </div>

            {/* Main output area */}
            {machine && result && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {/* Machine + KPI header strip */}
                <div
                  style={{
                    background: "#070d1a",
                    borderBottom: "1px solid #0e1e38",
                    padding: "10px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 40,
                      background: ac,
                      borderRadius: 2,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: "#f1f5f9",
                        fontFamily: "Syne,sans-serif",
                      }}
                    >
                      {machine.brand} {machine.model}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "#1e3050",
                        fontFamily: "DM Mono,monospace",
                      }}
                    >
                      {machine.id} · {machine.kw}kW · β₁={machine.beta1} ·{" "}
                      {sp.beta0}kW β₀ · R²={sp.r2}
                      {machine.uv ? " · UV Active" : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    {[
                      [
                        `${result.bill.eTotal.toFixed(1)} kWh`,
                        "Lifecycle Energy",
                        ac,
                      ],
                      [
                        `¥${result.bill.costTotal.toFixed(2)}`,
                        "Total Cost",
                        "#4ade80",
                      ],
                      [
                        `${result.bill.carbonKg.toFixed(2)} kg`,
                        "PCF CO₂",
                        "#818cf8",
                      ],
                    ].map(([v, l, c]) => (
                      <div key={l} style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: 8,
                            color: "#1e3050",
                            fontFamily: "DM Mono,monospace",
                          }}
                        >
                          {l}
                        </div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: c,
                            fontFamily: "DM Mono,monospace",
                          }}
                        >
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tabs */}
                <div
                  style={{
                    display: "flex",
                    background: "#070d1a",
                    borderBottom: "1px solid #0e1e38",
                    padding: "0 24px",
                    flexShrink: 0,
                  }}
                >
                  {[
                    ["⚡ 动态能耗 & 热力画像 / Energy & Thermal Profile", 0],
                    ["💳 精准订单碳账单 / Job-Level Carbon Bill", 1],
                    ["📋 排产决策 & 甘特图 / Scheduling Decision", 2],
                  ].map(([t, i]) => (
                    <button
                      key={i}
                      onClick={() => setTab(i)}
                      style={{
                        padding: "12px 18px",
                        background: "transparent",
                        border: "none",
                        borderBottom:
                          tab === i
                            ? `2px solid ${ac}`
                            : "2px solid transparent",
                        color: tab === i ? "#f1f5f9" : "#1e3050",
                        fontSize: 10,
                        cursor: "pointer",
                        fontFamily: "DM Mono,monospace",
                        fontWeight: tab === i ? 700 : 400,
                        whiteSpace: "nowrap",
                        transition: "color 0.15s",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Panel */}
                <div
                  style={{ flex: 1, overflowY: "auto", padding: "22px 24px" }}
                >
                  {tab === 0 && (
                    <EnergyPanel
                      machine={machine}
                      result={result}
                      ink={ink}
                      sp={sp}
                    />
                  )}
                  {tab === 1 && (
                    <BillPanel
                      machine={machine}
                      result={result}
                      dur={dur}
                      ink={ink}
                      startHour={sh}
                      season={season}
                    />
                  )}
                  {tab === 2 && (
                    <SchedulePanel
                      machine={machine}
                      result={result}
                      dur={dur}
                      startHour={sh}
                      season={season}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state for analysis with no machine */}
        {view === "analysis" && !machine && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
            }}
          >
            <div style={{ fontSize: 56, opacity: 0.06 }}>🏭</div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 14,
                  color: "#1e3050",
                  fontFamily: "DM Sans,sans-serif",
                  marginBottom: 6,
                }}
              >
                请先从机器库中选择一台机型
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#0e1e38",
                  fontFamily: "DM Mono,monospace",
                }}
              >
                Select a machine from the Library to begin analysis
              </div>
            </div>
            <button
              onClick={() => setView("library")}
              style={{
                background: "#0e1e38",
                border: "1px solid #38bdf8",
                borderRadius: 8,
                color: "#7dd3fc",
                padding: "10px 20px",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "DM Mono,monospace",
              }}
            >
              → 打开机器库 / Open Library
            </button>
          </div>
        )}
      </div>

      {/* Batch scheduler modal */}
      {batchOpen && (
        <BatchModal onClose={() => setBatchOpen(false)} season={season} />
      )}
    </>
  );
}
