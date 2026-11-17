// Class names shared by the error card, cookies upload and timing details.

const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2";
const BTN = `inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS}`;

export const BTN_PRIMARY = `${BTN} bg-purple-600 hover:bg-purple-700 text-white shadow-sm`;
export const BTN_SECONDARY = `${BTN} bg-white hover:bg-slate-50 text-text-primary border border-border`;
export const BTN_DANGER = `${BTN} bg-red-50 hover:bg-red-100 text-red-700 border border-red-200`;

/** The clickable line of a collapsed section. */
export const SUMMARY = `inline-flex items-center gap-1.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-xs font-semibold text-text-secondary hover:text-text-primary rounded ${FOCUS}`;
