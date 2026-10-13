'use strict';
const launchTime = Date.parse('2027-01-01T00:00:00+03:00');
const timer = document.querySelector('[role="timer"]');
const units = ['days', 'hours', 'minutes', 'seconds'];
let countdownInterval;

function updateCountdown() {
  const remaining = Math.max(0, Math.ceil((launchTime - Date.now()) / 1000));
  const values = [Math.floor(remaining / 86400), Math.floor(remaining % 86400 / 3600), Math.floor(remaining % 3600 / 60), remaining % 60];
  units.forEach((unit, index) => {
    document.getElementById(unit).textContent = String(values[index]).padStart(2, '0');
  });
  timer.setAttribute('aria-label', values.map((value, index) => `${value} ${units[index]}`).join(', ') + ' remaining until January 1, 2027, midnight in Saudi Arabia.');
  if (remaining === 0) {
    document.getElementById('launch-date').textContent = 'The countdown is complete. A new year of creativity begins.';
    clearInterval(countdownInterval);
  }
  return remaining;
}

if (updateCountdown() > 0) countdownInterval = setInterval(updateCountdown, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateCountdown();
});
document.getElementById('year').textContent = new Date().getFullYear();
