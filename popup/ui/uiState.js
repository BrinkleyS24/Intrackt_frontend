import { getElement } from "../utils/dom.js";

export function toggleUI(isLoggedIn, state, elements) {
  const show = el => el?.classList.remove("hidden");
  const hide = el => el?.classList.add("hidden");

  if (isLoggedIn) {
    show(elements.filterSection);
    show(elements.jobList);
    show(elements.signoutBtn);
    hide(elements.loginBtn);

    if (state.userPlan === "premium") {
      show(getElement("followup-section"));
    } else {
      hide(getElement("followup-section"));
    }

    show(getElement("tabs"));
    elements.followupBtn?.classList.remove("hidden");
  } else {
    hide(elements.filterSection);
    hide(elements.jobList);
    hide(elements.signoutBtn);
    show(elements.loginBtn);
    hide(getElement("followup-section"));
    hide(getElement("tabs"));
    elements.followupBtn?.classList.add("hidden");
  }
}

export function updatePremiumButton(isLoggedIn, state, elements) {
  if (!elements.premiumBtn) return;
  const shouldShow = isLoggedIn && state.userPlan === "free";
  elements.premiumBtn.style.display = shouldShow ? "inline-block" : "none";
}

export function adjustTimeRangeOptions(state) {
  const timeRangeFilter = document.getElementById("time-range-filter");
  if (!timeRangeFilter) return;

  const optionValue = "90";
  const yearOptionExists = Array.from(timeRangeFilter.options)
    .some(opt => opt.value === optionValue);

  if (state.userPlan === "premium" && !yearOptionExists) {
    const opt = new Option("Last 90 days", optionValue);
    timeRangeFilter.add(opt);
  } else if (state.userPlan === "free" && yearOptionExists) {
    Array.from(timeRangeFilter.options).forEach((opt, idx) => {
      if (opt.value === optionValue) {
        timeRangeFilter.remove(idx);
      }
    });
  }
}
