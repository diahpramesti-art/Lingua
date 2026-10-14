/* ==========================================================================
   SCAFFOLDING PRACTICE ENGINE (DYNAMIC AI QUESTIONS, HINTS & BOSS TRIGGER)
   ========================================================================== */

function formatBlockText(text) {
    if (!appState.showRomaji && appState.track === 'ja') {
        return text.replace(/\s*\([^)]*\)/g, '');
    }
    return text;
}

function getGrammarBadgeHtml(word) {
    const cleanWord = word.split(' ')[0].toLowerCase();
    const particles = ['は', 'の', 'に', 'を', 'で', 'へ', 'と', 'が'];
    const verbs = ['です', 'ください', 'am', 'is', 'are', 'study', 'speak', 'visited', 'go'];

    if (particles.some(p => word.includes(p))) {
        return `<span class="grammar-tag tag-part">PARTIKEL</span>`;
    } else if (verbs.some(v => cleanWord.includes(v))) {
        return `<span class="grammar-tag tag-verb">PREDIKAT</span>`;
    }
    return '';
}

function loadCurrentQuestion() {
    if (!appState.currentCurriculum) return;

    const lesson = appState.currentCurriculum.lessons[appState.currentLessonIndex];
    const q = lesson.questions[appState.currentQuestionIndex % lesson.questions.length];

    document.getElementById('practiceLessonTopic').innerText = lesson.topic || `HARI ${lesson.day || 1}`;
    document.getElementById('practiceLessonTitle').innerText = lesson.title;
    document.getElementById('microConceptRuleText').innerText = lesson.rule;
    document.getElementById('microConceptExamples').innerText = lesson.examples;
    document.getElementById('questionTargetPrompt').innerText = `"${q.target}"`;
    document.getElementById('practiceFeedbackBox').className = 'hidden';

    const romajiBtn = document.getElementById('romajiToggleBtn');
    if (romajiBtn) {
        romajiBtn.innerText = appState.showRomaji ? 'Romaji ON' : 'Romaji OFF';
    }

    const zone = document.getElementById('interactionZone');
    zone.innerHTML = '';
    appState.userBlocksSelection = [];

    if (q.type === 'reorder') {
        document.getElementById('scaffoldingStageBadge').innerText = 'Step A: Tap & Reorder';

        const answerSlot = document.createElement('div');
        answerSlot.id = 'answerBlocksSlot';
        answerSlot.className = 'flex flex-wrap gap-2 min-h-[48px] p-2 bg-stone-50 dark:bg-stone-900 rounded-xl w-full border border-stone-200 dark:border-stone-800 mb-4 justify-center items-center';
        zone.appendChild(answerSlot);

        const shuffled = [...q.blocks].sort(() => Math.random() - 0.5);
        const optionsPool = document.createElement('div');
        optionsPool.className = 'flex flex-wrap gap-2 justify-center';

        shuffled.forEach(word => {
            const btn = document.createElement('button');
            btn.innerHTML = `<span>${formatBlockText(word)}</span>${getGrammarBadgeHtml(word)}`;
            btn.className = 'px-3.5 py-2 bg-stone-200/70 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-serif text-sm font-medium rounded-lg hover:bg-amber-100 transition shadow-sm btn-tactile flex items-center';
            btn.onclick = () => {
                appState.userBlocksSelection.push(word);
                renderSelectedBlocks();
                btn.disabled = true;
                btn.classList.add('opacity-30');
            };
            optionsPool.appendChild(btn);
        });
        zone.appendChild(optionsPool);

    } else if (q.type === 'fill') {
        document.getElementById('scaffoldingStageBadge').innerText = 'Step B: Fill in the Blank';

        const templateDiv = document.createElement('div');
        templateDiv.className = 'text-base sm:text-lg font-serif text-stone-900 dark:text-stone-100 mb-4 font-medium';
        templateDiv.innerText = q.template;
        zone.appendChild(templateDiv);

        const optsDiv = document.createElement('div');
        optsDiv.className = 'flex gap-3';
        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.innerText = formatBlockText(opt);
            btn.className = 'px-4 py-2 bg-stone-200/70 dark:bg-stone-800 font-serif font-medium text-sm rounded-xl hover:bg-[#C85A32] hover:text-white transition shadow-sm btn-tactile';
            btn.onclick = () => {
                appState.userBlocksSelection = [opt];
                Array.from(optsDiv.children).forEach(c => c.classList.remove('bg-[#C85A32]', 'text-white'));
                btn.classList.add('bg-[#C85A32]', 'text-white');
            };
            optsDiv.appendChild(btn);
        });
        zone.appendChild(optsDiv);

    } else if (q.type === 'translate') {
        document.getElementById('scaffoldingStageBadge').innerText = 'Step C: Active Production';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'activeInputAnswer';
        input.placeholder = q.hint || 'Ketik terjemahan lengkap...';
        input.className = 'w-full max-w-md bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl px-4 py-2.5 text-sm font-serif focus:outline-none focus:ring-1 focus:ring-[#C85A32]';
        zone.appendChild(input);
    }
}

function renderSelectedBlocks() {
    const slot = document.getElementById('answerBlocksSlot');
    if (!slot) return;
    slot.innerHTML = '';
    appState.userBlocksSelection.forEach(word => {
        const span = document.createElement('span');
        span.innerText = formatBlockText(word);
        span.className = 'px-3 py-1.5 bg-[#C85A32] text-white font-serif text-sm rounded-lg shadow-sm';
        slot.appendChild(span);
    });
}

function submitPracticeAnswer() {
    const lesson = appState.currentCurriculum.lessons[appState.currentLessonIndex];
    const q = lesson.questions[appState.currentQuestionIndex % lesson.questions.length];
    let isCorrect = false;

    if (q.type === 'reorder') {
        isCorrect = JSON.stringify(appState.userBlocksSelection) === JSON.stringify(q.correct);
    } else if (q.type === 'fill') {
        isCorrect = appState.userBlocksSelection[0] === q.correct;
    } else if (q.type === 'translate') {
        const inputEl = document.getElementById('activeInputAnswer');
        const userVal = inputEl ? inputEl.value.trim().toLowerCase() : '';
        isCorrect = q.correct.some(c => c.toLowerCase() === userVal);
    }

    const feedback = document.getElementById('practiceFeedbackBox');
    feedback.classList.remove('hidden');

    if (isCorrect) {
        appState.streak++;
        appState.dailyCompleted++;
        localStorage.setItem('lingua_daily_count', appState.dailyCompleted);
        updateDailyGoalUI();

        feedback.className = 'p-4 rounded-xl text-sm font-serif bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
        feedback.innerHTML = `<i class="fa-solid fa-circle-check mr-1.5 text-emerald-700"></i> <strong>Sempurna!</strong> Jawaban Anda sesuai kaidah tata bahasa baku.`;
        playAudioText(q.target);
    } else {
        appState.streak = 0;
        feedback.className = 'p-4 rounded-xl text-sm font-serif bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
        feedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5 text-amber-700"></i> <strong>Catatan Kaidah:</strong> ${lesson.rule}`;
        saveErrorToVault(q.target, lesson.rule);
    }

    updateStreakUI();

    if (appState.streak >= 3) {
        showStampEffect();
        setTimeout(() => {
            if (typeof startBossLevel === 'function') {
                startBossLevel(appState.currentLessonIndex);
            }
        }, 1200);
    } else {
        setTimeout(() => {
            appState.currentQuestionIndex++;
            saveUserProgress();
            loadCurrentQuestion();
        }, 1500);
    }
}

function updateStreakUI() {
    document.getElementById('streakCounterText').innerText = `${appState.streak}/3 Mastery Streak`;
    const pct = Math.min((appState.streak / 3) * 100, 100);
    document.getElementById('streakProgressBar').style.width = `${pct}%`;
}

function showStampEffect() {
    const stamp = document.createElement('div');
    stamp.className = 'fixed inset-0 flex items-center justify-center z-50 pointer-events-none';
    stamp.innerHTML = `
    <div class="border-4 border-emerald-700 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400 font-serif font-black text-2xl sm:text-4xl px-6 py-3 rounded-xl tracking-widest uppercase bg-stone-100/90 dark:bg-stone-900/90 shadow-2xl stamp-animation">
      ✓ Latihan Selesai!
    </div>
  `;
    document.body.appendChild(stamp);
    setTimeout(() => stamp.remove(), 1200);
}

/* ==========================================================================
   FITUR BANTUAN PETUNJUK AI SAAT LATIHAN
   ========================================================================== */
async function askAIForHint() {
    const feedback = document.getElementById('practiceFeedbackBox');
    feedback.classList.remove('hidden');
    feedback.className = 'p-3 rounded-xl text-xs font-serif bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-300 dark:border-amber-800 animate-pulse';
    feedback.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-1.5"></i> AI sedang menyiapkan petunjuk tata bahasa...';

    const lesson = appState.currentCurriculum.lessons[appState.currentLessonIndex];
    const q = lesson.questions[appState.currentQuestionIndex % lesson.questions.length];

    if (!appState.apiKey) {
        feedback.className = 'p-3 rounded-xl text-xs font-serif bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-300 dark:border-amber-800';
        feedback.innerHTML = `<strong>Petunjuk:</strong> ${lesson.rule} <br><span class="text-[10px] text-stone-500">(Masukkan Gemini API Key untuk petunjuk interaktif).</span>`;
        return;
    }

    try {
        const prompt = `Berikan petunjuk singkat dan mudah dipahami (maksimal 2 kalimat) dalam bahasa Indonesia untuk membantu menjawab soal tata bahasa ini tanpa langsung memberikan jawaban utuh.
Soal Target: "${q.target}"
Aturan: "${lesson.rule}"`;

        const cleanKey = appState.apiKey.trim();
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(cleanKey)}`;

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await res.json();
        const aiHint = data.candidates[0].content.parts[0].text;

        feedback.className = 'p-3 rounded-xl text-xs font-serif bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-300 dark:border-amber-800';
        feedback.innerHTML = `<i class="fa-solid fa-lightbulb text-amber-600 mr-1.5"></i> <strong>Petunjuk AI:</strong> ${aiHint}`;

    } catch (err) {
        feedback.className = 'p-3 rounded-xl text-xs font-serif bg-rose-50 text-rose-900 border border-rose-200';
        feedback.innerHTML = `Gagal terhubung ke AI. Silakan periksa kembali API Key kamu.`;
    }
}

/* ==========================================================================
   GENERATE SOAL DINAMIS UNLIMITED BERBASIS AI (GEMINI)
   ========================================================================== */
async function generateAIQuestion() {
    const lesson = appState.currentCurriculum.lessons[appState.currentLessonIndex];
    const feedback = document.getElementById('practiceFeedbackBox');

    if (!appState.apiKey) {
        alert('Gemini API Key belum terpasang. Klik ikon kunci di header untuk mengaktifkan fitur Soal AI.');
        return;
    }

    feedback.classList.remove('hidden');
    feedback.className = 'p-3 rounded-xl text-xs font-serif bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-300 animate-pulse';
    feedback.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-1.5"></i> Gemini AI sedang meracik soal latihan baru...';

    try {
        const isJapanese = appState.track === 'ja';
        const prompt = `Buatkan 1 soal latihan interaktif baru dalam format JSON murni tanpa markdown untuk materi "${lesson.title}" berdasarkan aturan: "${lesson.rule}".
Gunakan salah satu tipe soal ini ("reorder" atau "fill").
Contoh format reorder:
{
  "type": "reorder",
  "target": "Terjemahan Bahasa Indonesia",
  "blocks": ${isJapanese ? '["私 (Watashi)", "は (Wa)", "学生 (Gakusei)", "です (Desu)"]' : '["I", "am", "a", "student"]'},
  "correct": ${isJapanese ? '["私 (Watashi)", "は (Wa)", "学生 (Gakusei)", "です (Desu)"]' : '["I", "am", "a", "student"]'}
}`;

        const cleanKey = appState.apiKey.trim();
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(cleanKey)}`;

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await res.json();
        const rawText = data.candidates[0].content.parts[0].text;
        const newQ = JSON.parse(rawText.replace(/```json|```/g, '').trim());

        lesson.questions.push(newQ);
        appState.currentQuestionIndex = lesson.questions.length - 1;
        saveUserProgress();

        feedback.className = 'hidden';
        loadCurrentQuestion();

    } catch (err) {
        console.error("Gagal generate soal AI:", err);
        feedback.className = 'p-3 rounded-xl text-xs font-serif bg-rose-50 text-rose-900 border border-rose-200';
        feedback.innerHTML = `Gagal membuat soal AI baru. Mohon periksa koneksi atau API Key Anda.`;
    }
}