import { toNumber } from "../global/derived/shared.mjs";

const QUALITY_BANDS = [
  { min: 1, max: 2, vp: 1, label: "Barely Satisfactory" },
  { min: 3, max: 5, vp: 1, label: "Mediocre" },
  { min: 6, max: 8, vp: 2, label: "Pretty Good" },
  { min: 9, max: 11, vp: 3, label: "Good" },
  { min: 12, max: 14, vp: 4, label: "Excellent" },
  { min: 15, max: 17, vp: 5, label: "Brilliant" },
  { min: 18, max: 20, vp: 6, label: "Virtuoso" }
];

const getBaseVpOutcome = (successes) => {
  const band = QUALITY_BANDS.find((entry) => successes >= entry.min && successes <= entry.max);
  if (band) return { vp: band.vp, quality: band.label };
  if (successes >= 21) {
    const vp = 6 + Math.ceil((successes - 20) / 3);
    return { vp, quality: "Virtuoso" };
  }
  return { vp: 0, quality: "Failure" };
};

const getAccentedVpOutcome = (successes, accent = 0) => {
  if (!successes || successes <= 0) return { vp: 0, quality: "Failure" };
  if (accent > 0) {
    const vp = Math.max(1, Math.floor((successes + 1) / 2));
    return { vp, quality: "Accented (+)" };
  }
  if (accent < 0) {
    const vp = Math.max(1, Math.floor((successes + 3) / 4));
    return { vp, quality: "Accented (-)" };
  }
  return getBaseVpOutcome(successes);
};

export const getVpOutcome = (successes, goalNumber, critSuccess, accent = 0) => {
  if (!successes || successes <= 0) return { vp: 0, quality: "Failure" };

  const baseResult = getAccentedVpOutcome(successes, accent);
  const baseVp = Number(baseResult.vp ?? 0);
  const quality = baseResult.quality ?? "Failure";
  const extendedBonus = goalNumber > 20 ? Math.floor((goalNumber - 21) / 3) + 1 : 0;
  const total = critSuccess ? (baseVp + extendedBonus) * 2 : (baseVp + extendedBonus);

  return { vp: total, quality: critSuccess ? "Critical Success" : quality };
};

export const getActionPenalty = (actions) => (actions === 2 ? -4 : (actions >= 3 ? -6 : 0));
export const getRetryPenalty = (retries) => (retries === 1 ? -2 : (retries >= 2 ? -4 : 0));

export const buildGoalNumber = ({ skillValue, characteristicValue, difficulty, woundPenalty = 0, complementaryVp = 0 }) =>
  skillValue + characteristicValue + difficulty + woundPenalty + complementaryVp;

export const rollCheck = async ({ gn, accent = 0 }) => {
  const roll = await (new Roll("1d20")).roll({ async: true });
  const die = toNumber(roll.total);
  const adjustedRoll = die + accent;
  const critSuccess = adjustedRoll === gn;
  const critFailure = die === 20 && adjustedRoll > gn;
  const success = adjustedRoll <= gn;
  const successes = success ? Math.max(1, adjustedRoll) : 0;
  const vpResult = getVpOutcome(successes, gn, critSuccess, accent);
  return {
    die,
    adjustedRoll,
    accent,
    critSuccess,
    critFailure,
    success,
    successes,
    vp: critFailure ? 0 : vpResult.vp,
    quality: critFailure ? "Critical Failure" : vpResult.quality
  };
};
