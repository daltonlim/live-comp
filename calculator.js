export const TIME_ZONE = "Australia/Sydney";

export const TAX_RULES = {
  2025: { firstRate: 0.16, mlsSingle: [101000, 118000, 158000], mlsFamily: [202000, 236000, 316000] },
  2026: { firstRate: 0.15, mlsSingle: [105000, 123000, 164000], mlsFamily: [210000, 246000, 328000] }
};

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
});

export function sydneyNow(date = new Date()) {
  const parts = Object.fromEntries(dateFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second)
  };
}

export function dayNumber(year, month, day) {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export function dayParts(dayNumberValue) {
  const date = new Date(dayNumberValue * 86400000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function isWorkday(dayNumberValue) {
  const day = new Date(dayNumberValue * 86400000).getUTCDay();
  return day !== 0 && day !== 6;
}

export function workdayCount(startInclusive, endExclusive) {
  let count = 0;
  for (let day = startInclusive; day < endExclusive; day++) if (isWorkday(day)) count++;
  return count;
}

export function fiscalYear(now) {
  const startYear = now.month >= 7 ? now.year : now.year - 1;
  return {
    startYear,
    start: dayNumber(startYear, 7, 1),
    end: dayNumber(startYear + 1, 7, 1),
    label: `${startYear}–${String(startYear + 1).slice(-2)}`
  };
}

export function incomeTax(income, startYear) {
  const firstRate = TAX_RULES[startYear]?.firstRate;
  if (firstRate === undefined) return null;
  const brackets = [
    [18200, 45000, firstRate],
    [45000, 135000, 0.30],
    [135000, 190000, 0.37],
    [190000, Infinity, 0.45]
  ];
  return brackets.reduce((tax, [lower, upper, rate]) => tax + Math.max(0, Math.min(income, upper) - lower) * rate, 0);
}

export function mlsRate(income, startYear, household, partnerIncome = 0, children = 0) {
  const rules = TAX_RULES[startYear];
  if (!rules) return 0;
  const family = household === "family";
  const uplift = family ? Math.max(0, children - 1) * 1500 : 0;
  const thresholds = family ? rules.mlsFamily.map(value => value + uplift) : rules.mlsSingle;
  const testIncome = income + (family ? partnerIncome : 0);
  if (testIncome <= thresholds[0]) return 0;
  if (testIncome <= thresholds[1]) return 0.01;
  if (testIncome <= thresholds[2]) return 0.0125;
  return 0.015;
}

export function calculateAnnual(settings, startYear) {
  const packageAmount = Math.max(0, Number(settings.salary) || 0);
  const gross = settings.salaryIncludesSuper ? packageAmount / (1 + (Number(settings.superRate) || 0) / 100) : packageAmount;
  const tax = incomeTax(gross, startYear);
  if (tax === null) return null;
  const medicare = gross * 0.02;
  const surchargeRate = settings.hospitalCover ? 0 : mlsRate(gross, startYear, settings.household, Number(settings.partnerIncome) || 0, Number(settings.children) || 0);
  const surcharge = gross * surchargeRate;
  const concessionalSuper = Math.max(0, Number(settings.concessionalSuper) || 0);
  const div293 = settings.includeDiv293 ? 0.15 * Math.min(concessionalSuper, Math.max(0, gross + concessionalSuper - 250000)) : 0;
  const totalTax = tax + medicare + surcharge + div293;
  return { gross, tax, medicare, surcharge, surchargeRate, div293, totalTax, net: gross - totalTax, effectiveRate: gross ? totalTax / gross : 0 };
}

function toMinutes(time) {
  const [hour, minute] = String(time).split(":").map(Number);
  return hour * 60 + minute;
}

export function workdayFraction(now, settings) {
  const today = dayNumber(now.year, now.month, now.day);
  if (!isWorkday(today)) return 0;
  const start = toMinutes(settings.workStart);
  const end = toMinutes(settings.workEnd);
  const breakStart = toMinutes(settings.breakStart);
  const breakEnd = toMinutes(settings.breakEnd);
  if (![start, end, breakStart, breakEnd].every(Number.isFinite) || end <= start) return 0;
  const overlap = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
  const elapsed = Math.min(end, Math.max(start, now.hour * 60 + now.minute + now.second / 60));
  const breakMinutes = overlap(start, end, breakStart, breakEnd);
  const dayMinutes = end - start - breakMinutes;
  if (dayMinutes <= 0) return 0;
  const workedMinutes = elapsed - start - overlap(start, elapsed, breakStart, breakEnd);
  return Math.max(0, Math.min(1, workedMinutes / dayMinutes));
}

export function periodFractions(now, settings) {
  const fy = fiscalYear(now);
  const today = dayNumber(now.year, now.month, now.day);
  const totalDays = workdayCount(fy.start, fy.end);
  const todayFraction = workdayFraction(now, settings);
  const throughToday = Math.max(fy.start, Math.min(today, fy.end));
  const elapsedDays = workdayCount(fy.start, throughToday);
  const weekStart = today - ((new Date(today * 86400000).getUTCDay() + 6) % 7);
  const monthStart = dayNumber(now.year, now.month, 1);
  const fyStartOfWeek = Math.max(fy.start, weekStart);
  const fyStartOfMonth = Math.max(fy.start, monthStart);
  const inFy = today >= fy.start && today < fy.end;
  const current = inFy ? todayFraction : 0;
  const earnedDays = elapsedDays + current;
  return {
    fy, today, totalDays, todayFraction: current,
    year: earnedDays / totalDays,
    week: (workdayCount(fyStartOfWeek, throughToday) + current) / totalDays,
    month: (workdayCount(fyStartOfMonth, throughToday) + current) / totalDays,
    day: current / totalDays,
    progress: earnedDays / totalDays,
    workdaysElapsed: earnedDays
  };
}
