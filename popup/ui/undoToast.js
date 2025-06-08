import { startUndoCountdown, cancelUndoToast, setUndoTimeout } from "./ui/undoToast.js";

let undoTimeoutId = null;
let undoIntervalId = null;

export function startUndoCountdown(duration = 5000) {
  const circle = document.getElementById('undo-timer-circle');
  const totalLength = 88;
  let start = Date.now();

  circle.style.strokeDashoffset = '0';

  undoIntervalId = setInterval(() => {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    circle.style.strokeDashoffset = totalLength * progress;
    if (progress === 1) {
      clearInterval(undoIntervalId);
    }
  }, 100);
}

export function cancelUndoToast() {
  clearTimeout(undoTimeoutId);
  clearInterval(undoIntervalId);

  const circle = document.getElementById('undo-timer-circle');
  if (circle) circle.style.strokeDashoffset = '0';

  const toast = document.getElementById("undo-toast");
  if (toast) toast.style.display = "none";
}

export function setUndoTimeout(callback, delay = 5000) {
  clearTimeout(undoTimeoutId);
  undoTimeoutId = setTimeout(callback, delay);
}
