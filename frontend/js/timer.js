/* ═══════════════════════════════════════════════════════════════
   timer.js — Step-by-step Cooking Timer
   ═══════════════════════════════════════════════════════════════ */

let timerSteps = [];
let timerCurrentStep = 0;
let timerSeconds = 0;
let timerInterval = null;
let timerRunning = false;

// Extract minutes from strings like "Cook for 15 minutes" or "Bake 30 min"
function extractMinutes(text) {
    const match = text.match(/(\d+)\s*(min|minute|minutes|hour|hours|hr|h)\b/i);
    if (!match) return 0;
    const val = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    return unit.startsWith('h') ? val * 60 : val;
}

function openCookingTimer(steps) {
    timerSteps = Array.isArray(steps) ? steps : [];
    timerCurrentStep = 0;
    timerRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;

    const overlay = document.getElementById('cookingTimerOverlay');
    overlay.style.display = 'flex';

    renderTimerStep();
    renderTimerDots();
    document.getElementById('timerStartBtn').textContent = '▶ Start';
}

function closeCookingTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    timerInterval = null;
    document.getElementById('cookingTimerOverlay').style.display = 'none';
}

function renderTimerStep() {
    const step = timerSteps[timerCurrentStep];
    if (!step) return;
    document.getElementById('timerStepLabel').textContent = `Step ${timerCurrentStep + 1} of ${timerSteps.length}`;

    const mins = extractMinutes(step);
    timerSeconds = mins * 60;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const s = (timerSeconds % 60).toString().padStart(2, '0');
    document.getElementById('timerDisplay').textContent = `${m}:${s}`;
}

function renderTimerDots() {
    const dotsEl = document.getElementById('timerProgressDots');
    dotsEl.innerHTML = timerSteps.map((_, i) =>
        `<span class="timer-dot ${i === timerCurrentStep ? 'active' : i < timerCurrentStep ? 'done' : ''}"></span>`
    ).join('');
}

function toggleTimer() {
    const btn = document.getElementById('timerStartBtn');
    if (timerSeconds === 0 && !timerRunning) {
        // Manual count-up mode
        timerRunning = true;
        btn.textContent = '⏸ Pause';
        timerInterval = setInterval(() => {
            timerSeconds++;
            updateTimerDisplay();
        }, 1000);
        return;
    }
    if (timerRunning) {
        clearInterval(timerInterval);
        timerRunning = false;
        btn.textContent = '▶ Resume';
    } else {
        timerRunning = true;
        btn.textContent = '⏸ Pause';
        timerInterval = setInterval(() => {
            if (timerSeconds > 0) {
                timerSeconds--;
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
                timerRunning = false;
                btn.textContent = '▶ Start';
                playTimerBeep();
                showToast(`⏰ Step ${timerCurrentStep + 1} complete!`, 'success');
            }
        }, 1000);
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timerStartBtn').textContent = '▶ Start';
    renderTimerStep();
}

function nextTimerStep() {
    clearInterval(timerInterval);
    timerRunning = false;
    if (timerCurrentStep < timerSteps.length - 1) {
        timerCurrentStep++;
        document.getElementById('timerStartBtn').textContent = '▶ Start';
        renderTimerStep();
        renderTimerDots();
    } else {
        showToast('🎉 All steps complete! Enjoy your meal!', 'success');
        closeCookingTimer();
    }
}

function playTimerBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.15, 0.3].forEach(delay => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.4, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.12);
        });
    } catch (_) { }
}
