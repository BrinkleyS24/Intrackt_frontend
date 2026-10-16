// The "Misclassify" correction dialog's choices. Kept free of React so it runs under `node --test`.
//
// The dialog preselected "Irrelevant", so one click on "Correct Email" hid a real interview email
// (persona report 2026-10-15). It now opens on the email's current stage and saves nothing until the
// user picks a different one.

export const MISCLASSIFY_CHOICES = [
  { value: 'applied', label: 'Applied' },
  { value: 'interviewed', label: 'Interview' },
  { value: 'offers', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'irrelevant', label: 'Not about a job application (hide it)' },
];

const ALIASES = {
  applied: 'applied', apply: 'applied', application: 'applied',
  interviewed: 'interviewed', interview: 'interviewed', interviews: 'interviewed',
  offers: 'offers', offer: 'offers', offered: 'offers',
  rejected: 'rejected', reject: 'rejected', rejection: 'rejected',
  irrelevant: 'irrelevant',
};

/** The stage the email is filed under now, as one of the dialog's values (null when unknown). */
export function currentMisclassifyStage(email) {
  const key = String(email?.category || '').trim().toLowerCase();
  return ALIASES[key] || null;
}

/** Human label for a stage value ("Interview", not the raw "interviewed"). */
export function misclassifyStageLabel(value) {
  return MISCLASSIFY_CHOICES.find((choice) => choice.value === value)?.label || 'Unknown';
}

/** Saving needs an explicit, different choice: re-filing an email into its own stage is a no-op. */
export function canSubmitMisclassify(current, chosen) {
  return Boolean(chosen) && MISCLASSIFY_CHOICES.some((choice) => choice.value === chosen) && chosen !== current;
}
