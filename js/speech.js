const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = SpeechRecognition ? new SpeechRecognition() : null;

function playAudioText(text, langTrack = appState.track) {
    if (!('speechSynthesis' in window)) return;

    const waveEl = document.getElementById('audioWaveIndicator');
    const playBtn = document.getElementById('audioPlayBtn');

    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        if (waveEl) waveEl.classList.add('hidden');
        if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-volume-high text-xs"></i>';
        return;
    }

    window.speechSynthesis.cancel();

    // Hapus tanda kutip di luar dan simbol pengganggu
    let cleanedText = text
        .replace(/^["'\s]+|["'\s]+$/g, '')
        .replace(/[\+\/\|\-_\\()\[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleanedText || cleanedText === '-') return;

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = langTrack === 'ja' ? 'ja-JP' : 'en-US';
    utterance.rate = appState.audioSpeed || 0.88;

    if (waveEl) waveEl.classList.remove('hidden');
    if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-square text-xs"></i>';

    utterance.onend = utterance.onerror = () => {
        if (waveEl) waveEl.classList.add('hidden');
        if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-volume-high text-xs"></i>';
    };

    window.speechSynthesis.speak(utterance);
}

function toggleAudioSpeed() {
    const btn = document.getElementById('speedToggleBtn');
    if (appState.audioSpeed === 0.88 || appState.audioSpeed === 1.0) {
        appState.audioSpeed = 0.65;
        if (btn) btn.innerText = '0.65x';
    } else {
        appState.audioSpeed = 0.88;
        if (btn) btn.innerText = '1.0x';
    }
}

function toggleSpeechRecognition() {
    if (!recognition) {
        alert('Fitur Web Speech API tidak didukung di browser ini. Gunakan Chrome atau Edge.');
        return;
    }

    const micBtn = document.getElementById('micBtn');
    const speechStatus = document.getElementById('speechStatus');

    if (appState.isListening) {
        recognition.stop();
        appState.isListening = false;
        micBtn.classList.remove('bg-[#C85A32]', 'text-white');
        speechStatus.classList.add('hidden');
    } else {
        recognition.lang = appState.track === 'ja' ? 'ja-JP' : 'en-US';
        recognition.start();
        appState.isListening = true;
        micBtn.classList.add('bg-[#C85A32]', 'text-white');
        speechStatus.classList.remove('hidden');

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            document.getElementById('chatInput').value = transcript;
            toggleSpeechRecognition();
        };

        recognition.onerror = () => {
            toggleSpeechRecognition();
        };
    }
}