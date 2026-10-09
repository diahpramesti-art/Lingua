/* ==========================================================================
   SCAFFOLDING PRACTICE ENGINE
   ========================================================================== */

// Helper untuk menyembunyikan teks di dalam kurung (Romaji) saat mode Romaji OFF
function formatBlockText(text) {
    if (!appState.showRomaji && appState.track === 'ja') {
        return text.replace(/\s*\([^)]*\)/g, '');
    }
    return text;
}

function getGrammarBadgeHtml(word) {
    const cleanWord = word.split(' ')[0].toLowerCase();

    // Daftar partikel & kata kerja dasar
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

    document.getElementById('practiceLessonTopic').innerText = lesson.topic;
    document.getElementById('practiceLessonTitle').innerText = lesson.title;
    document.getElementById('microConceptRuleText').innerText = lesson.rule;
    document.getElementById('microConceptExamples').innerText = lesson.examples;
    document.getElementById('questionTargetPrompt').innerText = `"${q.target}"`;
    document.getElementById('practiceFeedbackBox').className = 'hidden';

    // Perbarui tampilan tombol Romaji jika elemennya ada
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
        answerSlot.className = 'flex flex-wrap gap-2 min-h-[48px] p-2 bg-stone-50 dark:bg-slate-900 rounded-xl w-full border border-stone-200 dark:border-slate-800 mb-4 justify-center items-center';
        zone.appendChild(answerSlot);

        const shuffled = [...q.blocks].sort(() => Math.random() - 0.5);
        const optionsPool = document.createElement('div');
        optionsPool.className = 'flex flex-wrap gap-2 justify-center';

        shuffled.forEach(word => {
            const btn = document.createElement('button');
            // Ubah baris ini agar mendukung tag visual:
            btn.innerHTML = `<span>${formatBlockText(word)}</span>${getGrammarBadgeHtml(word)}`;
            btn.className = 'px-3.5 py-2 bg-stone-200/70 dark:bg-slate-700 text-stone-900 dark:text-stone-100 font-serif text-sm font-medium rounded-lg hover:bg-amber-100 transition shadow-paper btn-tactile flex items-center';
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
        templateDiv.className = 'text-xl font-serif text-stone-900 dark:text-stone-100 mb-4 font-medium';
        templateDiv.innerText = q.template;
        zone.appendChild(templateDiv);

        const optsDiv = document.createElement('div');
        optsDiv.className = 'flex gap-3';
        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.innerText = formatBlockText(opt);
            btn.className = 'px-4 py-2 bg-stone-200/70 dark:bg-slate-700 font-serif font-medium text-sm rounded-xl hover:bg-rose-700 hover:text-white transition shadow-paper btn-tactile';
            btn.onclick = () => {
                appState.userBlocksSelection = [opt];
                Array.from(optsDiv.children).forEach(c => c.classList.remove('bg-rose-700', 'text-white'));
                btn.classList.add('bg-rose-700', 'text-white');
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
        input.className = 'w-full max-w-md bg-stone-50 dark:bg-slate-900 border border-stone-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-serif focus:outline-none focus:ring-1 focus:ring-rose-700';
        zone.appendChild(input);
    }
}

function renderSelectedBlocks() {
    const slot = document.getElementById('answerBlocksSlot');
    if (!slot) return;
    slot.innerHTML = '';
    appState.userBlocksSelection.forEach(word => {
        const span = document.createElement('span');
        span.innerText = formatBlockText(word); // Menggunakan filter Romaji
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
        appState.dailyCompleted++; // <-- Tambahkan baris ini
        localStorage.setItem('lingua_daily_count', appState.dailyCompleted); // <-- Simpan ke memori browser
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
            appState.currentLessonIndex = (appState.currentLessonIndex + 1) % appState.currentCurriculum.lessons.length;
            appState.streak = 0;
            updateStreakUI();
            renderRoadmap();
            loadCurrentQuestion();
        }, 1200);
    } else {
        setTimeout(() => {
            appState.currentQuestionIndex++;
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
    <div class="border-4 border-emerald-700 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400 font-serif font-black text-2xl sm:text-4xl px-6 py-3 rounded-xl tracking-widest uppercase bg-stone-100/90 dark:bg-slate-900/90 shadow-2xl stamp-animation">
      ✓ Terkuasai
    </div>
  `;
    document.body.appendChild(stamp);
    setTimeout(() => stamp.remove(), 1200);
}