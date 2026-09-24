import { calculateAnnual, fiscalYear, periodFractions, sydneyNow, workdayCount } from "./calculator.js";

const STORAGE_KEY = "earned-au-settings-v1";
const defaults = {
  salary: 180000,
  salaryIncludesSuper: false,
  superRate: 12,
  workStart: "09:00", workEnd: "17:00",
  breakStart: "12:30", breakEnd: "13:00",
  household: "single", partnerIncome: 0, children: 0,
  hospitalCover: true,
  includeDiv293: true,
  concessionalSuper: 30000
};

let settings;
try { settings = { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
catch { settings = { ...defaults }; }

const $ = id => document.getElementById(id);
const money = (amount, decimals = 0) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount);
const percent = amount => new Intl.NumberFormat("en-AU", { style: "percent", maximumFractionDigits: 1 }).format(amount);
const dateLabel = (day, month, year) => `${day} ${["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][month - 1]} ${year}`;
const timeLabel = value => {
  const [h, m] = value.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

function paint() {
  const now = sydneyNow();
  const fy = fiscalYear(now);
  const annual = calculateAnnual(settings, fy.startYear);
  const fractions = periodFractions(now, settings);
  $("liveTime").textContent = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date()) + " · Sydney";
  $("fyLabel").textContent = `FY ${fy.label}`;
  $("fyStartLabel").textContent = dateLabel(1, 7, fy.startYear);
  $("fyEndLabel").textContent = dateLabel(30, 6, fy.startYear + 1);
  if (!annual) {
    $("yearNet").textContent = "—";
    $("yearCents").textContent = "";
    $("todayStatus").textContent = "Tax rates for this financial year need updating.";
    return;
  }

  const yearValue = annual.net * fractions.year;
  const [dollars, cents] = money(yearValue, 2).split(".");
  $("yearNet").textContent = dollars.replace("$", "");
  $("yearCents").textContent = `.${cents}`;
  $("todayNet").textContent = money(annual.net * fractions.day, 2);
  $("weekNet").textContent = money(annual.net * fractions.week, 2);
  $("monthNet").textContent = money(annual.net * fractions.month, 2);
  $("yearGross").textContent = money(annual.gross * fractions.year, 2);
  $("fyProgressText").textContent = percent(fractions.progress);
  $("fyProgressBar").style.width = `${Math.max(0, Math.min(100, fractions.progress * 100))}%`;
  $("todayFractionLabel").textContent = `${percent(fractions.todayFraction)} OF WORKDAY`;
  $("workHoursLabel").textContent = `${timeLabel(settings.workStart)} – ${timeLabel(settings.workEnd)}`;
  const minute = now.hour * 60 + now.minute;
  const startMinute = Number(settings.workStart.slice(0, 2)) * 60 + Number(settings.workStart.slice(3));
  const endMinute = Number(settings.workEnd.slice(0, 2)) * 60 + Number(settings.workEnd.slice(3));
  const isWeekend = new Date(Date.UTC(now.year, now.month - 1, now.day)).getUTCDay() % 6 === 0;
  $("todayStatus").textContent = isWeekend ? "A little breathing room. Back on Monday." : minute < startMinute ? "Your workday hasn't started yet." : minute >= endMinute ? "You've finished your workday." : "Counting your workday in real time";

  $("annualGross").textContent = money(annual.gross);
  $("annualNet").textContent = money(annual.net);
  $("annualTax").textContent = money(annual.tax);
  $("annualMedicare").textContent = money(annual.medicare);
  $("annualSurcharge").textContent = money(annual.surcharge);
  $("annualDiv293").textContent = money(annual.div293);
  $("surchargeRow").hidden = annual.surcharge === 0;
  $("div293Row").hidden = annual.div293 === 0;
  $("effectiveTax").textContent = percent(annual.effectiveRate);
  $("barNet").style.width = `${annual.gross ? Math.max(0, annual.net / annual.gross * 100) : 0}%`;
  $("barTax").style.width = `${annual.gross ? Math.min(100, annual.totalTax / annual.gross * 100) : 0}%`;
  const dailyHours = (() => {
    const mins = v => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
    return (mins(settings.workEnd) - mins(settings.workStart) - Math.max(0, Math.min(mins(settings.workEnd), mins(settings.breakEnd)) - Math.max(mins(settings.workStart), mins(settings.breakStart)))) / 60;
  })();
  $("hourlyNet").innerHTML = `${money(annual.net / (workdayCount(fy.start, fy.end) * dailyHours), 2)}<span>/hr</span>`;
}

function fillForm() {
  $("salary").value = settings.salary;
  $("salaryType").value = settings.salaryIncludesSuper ? "include" : "exclude";
  $("superRate").value = settings.superRate;
  $("workStart").value = settings.workStart;
  $("workEnd").value = settings.workEnd;
  $("breakStart").value = settings.breakStart;
  $("breakEnd").value = settings.breakEnd;
  $("household").value = settings.household;
  $("partnerIncome").value = settings.partnerIncome;
  $("children").value = settings.children;
  $("hospitalCover").checked = settings.hospitalCover;
  $("includeDiv293").checked = settings.includeDiv293;
  $("concessionalSuper").value = settings.concessionalSuper;
  toggleConditional();
}

function toggleConditional() {
  $("superRateWrap").hidden = $("salaryType").value !== "include";
  $("familyFields").hidden = $("household").value !== "family";
  $("div293Fields").hidden = !$("includeDiv293").checked;
}

function openSettings() {
  fillForm();
  $("settingsPanel").hidden = false;
  $("scrim").hidden = false;
  $("settingsToggle").setAttribute("aria-expanded", "true");
  document.body.classList.add("dialog-open");
  $("salary").focus();
}

function closeSettings() {
  $("settingsPanel").hidden = true;
  $("scrim").hidden = true;
  $("settingsToggle").setAttribute("aria-expanded", "false");
  document.body.classList.remove("dialog-open");
  $("settingsToggle").focus();
}

$("settingsToggle").addEventListener("click", openSettings);
$("editButton").addEventListener("click", openSettings);
$("closeSettings").addEventListener("click", closeSettings);
$("scrim").addEventListener("click", closeSettings);
document.addEventListener("keydown", event => { if (event.key === "Escape" && !$("settingsPanel").hidden) closeSettings(); });
$("salaryType").addEventListener("change", toggleConditional);
$("household").addEventListener("change", toggleConditional);
$("includeDiv293").addEventListener("change", toggleConditional);
$("settingsForm").addEventListener("submit", event => {
  event.preventDefault();
  const proposed = {
    salary: Number($("salary").value), salaryIncludesSuper: $("salaryType").value === "include", superRate: Number($("superRate").value),
    workStart: $("workStart").value, workEnd: $("workEnd").value, breakStart: $("breakStart").value, breakEnd: $("breakEnd").value,
    household: $("household").value, partnerIncome: Number($("partnerIncome").value), children: Number($("children").value),
    hospitalCover: $("hospitalCover").checked, includeDiv293: $("includeDiv293").checked, concessionalSuper: Number($("concessionalSuper").value)
  };
  const mins = v => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  const valid = proposed.salary >= 0 && proposed.superRate >= 0 && proposed.superRate <= 50 && proposed.partnerIncome >= 0 && proposed.children >= 0 && proposed.concessionalSuper >= 0 && proposed.workStart && proposed.workEnd && proposed.breakStart && proposed.breakEnd && mins(proposed.workEnd) > mins(proposed.workStart) && mins(proposed.breakEnd) >= mins(proposed.breakStart) && mins(proposed.breakStart) >= mins(proposed.workStart) && mins(proposed.breakEnd) <= mins(proposed.workEnd) && mins(proposed.workEnd) - mins(proposed.workStart) > mins(proposed.breakEnd) - mins(proposed.breakStart);
  if (!valid) {
    $("formError").textContent = "Check that all amounts are positive and your break fits inside your workday.";
    $("formError").hidden = false;
    return;
  }
  $("formError").hidden = true;
  settings = proposed;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  paint();
  closeSettings();
});

paint();
setInterval(paint, 1000);
