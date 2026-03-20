let recognition = null;
let isCookingMode = false;
let currentStepIdx = 0;
let cookingRecipe = null;

function initVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
        console.warn('Speech recognition not supported');
        return;
    }

    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        handleVoiceCommand(transcript);
    };

    recognition.onend = () => {
        if (isCookingMode) recognition.start(); // Keep listening in cooking mode
    };
}

function handleVoiceCommand(cmd) {
    console.log('[Voice Command]:', cmd);

    if (cmd.includes('next')) {
        moveStep(1);
    } else if (cmd.includes('back') || cmd.includes('previous')) {
        moveStep(-1);
    } else if (cmd.includes('read') || cmd.includes('ingredients')) {
        speakIngredients();
    } else if (cmd.includes('exit') || cmd.includes('stop')) {
        exitCookingMode();
    }
}

function startCookingMode(recipe) {
    cookingRecipe = recipe;
    currentStepIdx = 0;
    isCookingMode = true;

    if (!recognition) initVoiceRecognition();
    recognition.start();

    // Create Overlay
    const overlay = document.createElement('div');
    overlay.id = 'cookingOverlay';
    overlay.className = 'cooking-mode-overlay';
    overlay.innerHTML = `
        <div class="cooking-card-giant">
            <h2 id="cookingTitle">${recipe.title}</h2>
            <div id="cookingStep">
                <div class="cooking-step-num">Step 1</div>
                <div class="cooking-step-text">${recipe.steps[0]}</div>
            </div>
            <div class="cooking-controls">
                <p>Say "Next", "Back", "Read ingredients", or "Exit"</p>
                <div class="voice-indicator listening">🎤</div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function moveStep(dir) {
    if (!cookingRecipe) return;
    currentStepIdx = Math.max(0, Math.min(cookingRecipe.steps.length - 1, currentStepIdx + dir));

    document.querySelector('.cooking-step-num').innerText = 'Step ' + (currentStepIdx + 1);
    document.querySelector('.cooking-step-text').innerText = cookingRecipe.steps[currentStepIdx];

    speak(cookingRecipe.steps[currentStepIdx]);
}

function speakIngredients() {
    const text = "The ingredients are: " + cookingRecipe.ingredients.join(', ');
    speak(text);
}

function speak(text) {
    const utter = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utter);
}

function exitCookingMode() {
    isCookingMode = false;
    if (recognition) recognition.stop();
    const overlay = document.getElementById('cookingOverlay');
    if (overlay) overlay.remove();
}

// ─── Search Mode Logic ────────────────────────────────────────────────────────
let searchCallback = null;

function startSearchVoice(onResult, onEnd) {
    if (!('webkitSpeechRecognition' in window)) {
        showToast('Voice search not supported in this browser', 'error');
        return;
    }

    if (recognition) recognition.stop(); // Stop any existing instance

    const searchRec = new webkitSpeechRecognition();
    searchRec.continuous = false;
    searchRec.interimResults = true;
    searchRec.lang = 'en-US';

    searchRec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript, event.results[0].isFinal);
    };

    searchRec.onend = () => {
        onEnd();
    };

    searchRec.start();
    return searchRec;
}
