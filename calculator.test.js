import test from "node:test";
import assert from "node:assert/strict";
import { calculateAnnual, fiscalYear, incomeTax, mlsRate, periodFractions, workdayFraction } from "./calculator.js";

const settings = {
  salary: 300000, salaryIncludesSuper: false, superRate: 12,
  workStart: "09:00", workEnd: "17:00", breakStart: "12:30", breakEnd: "13:00",
  household: "single", partnerIncome: 0, children: 0,
  hospitalCover: true, includeDiv293: true, concessionalSuper: 30000
};

test("2026–27 annual estimate uses enacted resident brackets, Medicare and Division 293", () => {
  const result = calculateAnnual(settings, 2026);
  assert.equal(result.tax, 100870);
  assert.equal(result.medicare, 6000);
  assert.equal(result.div293, 4500);
  assert.equal(result.net, 188630);
  assert.equal(incomeTax(45000, 2026), 4020);
  assert.equal(incomeTax(190000, 2026), 51370);
});

test("surcharge depends on cover and 2026–27 household tiers", () => {
  assert.equal(mlsRate(300000, 2026, "single"), 0.015);
  assert.equal(mlsRate(160000, 2026, "single"), 0.0125);
  assert.equal(mlsRate(300000, 2026, "family", 0, 0), 0.0125);
  assert.equal(calculateAnnual({ ...settings, hospitalCover: false }, 2026).surcharge, 4500);
});

test("today stops accruing during break and outside work hours", () => {
  const at = (hour, minute) => ({ year: 2026, month: 9, day: 24, hour, minute, second: 0 });
  assert.equal(workdayFraction(at(8, 0), settings), 0);
  assert.equal(workdayFraction(at(12, 30), settings), workdayFraction(at(12, 45), settings));
  assert.equal(workdayFraction(at(17, 0), settings), 1);
  assert.equal(workdayFraction({ ...at(12, 0), day: 26 }, settings), 0);
});

test("financial year and live fractions reset at 1 July", () => {
  assert.equal(fiscalYear({ year: 2026, month: 6 }).startYear, 2025);
  assert.equal(fiscalYear({ year: 2026, month: 7 }).startYear, 2026);
  const start = periodFractions({ year: 2026, month: 7, day: 1, hour: 9, minute: 0, second: 0 }, settings);
  assert.equal(start.year, 0);
  assert.equal(start.month, 0);
  assert.equal(start.week, 0);
});
