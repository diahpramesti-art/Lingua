/* ==========================================================================
   GLOBAL APP STATE & CONTROLLER (PERMANENT PROGRESS & GATED PROGRESSION)
   ========================================================================== */
let appState = {
    track: localStorage.getItem('lingua_track') || 'en',
    currentCurriculum: null,
    currentLessonIndex: parseInt(localStorage.getItem('lingua_lesson_idx') || '0'),
    currentQuestionIndex: parseInt(localStorage.getItem('lingua_question_idx') || '0'),
    streak: parseInt(localStorage.getItem('lingua_streak') || '0'),
    completedLessons: JSON.parse(localStorage.getItem('lingua_completed_lessons') || '[]'),
    userBlocksSelection: [],
    errorVault: JSON.parse(localStorage.getItem('lingua_errors') || '[]'),
    apiKey: localStorage.getItem('gemini_api_key') || '',
    isListening: false,
    audioSpeed: 0.88,
    showRomaji: true,
    dailyTarget: 5,
    dailyCompleted: parseInt(localStorage.getItem('lingua_daily_count') || '0')
};

window.onload = async () => {
    // Set selector track sesuai simpanan
    const trackSelect = document.getElementById('trackSelector');
    if (trackSelect) trackSelect.value = appState.track;

    await loadCurriculum(appState.track);
    updateVaultCount();
    updateDailyGoalUI();

    // Register Service Worker PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => { });
    }

    // Splash Screen memudar halus
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.classList.add('splash-hidden');
    }, 1200);
};

// Logika Pengecekan Kunci Bab (Hari 1 selalu terbuka, hari berikutnya terbuka jika hari sebelumnya lulus)
function isDayUnlocked(idx) {
    if (idx === 0) return true;
    if (!appState.currentCurriculum || !appState.currentCurriculum.lessons) return false;

    const prevLesson = appState.currentCurriculum.lessons[idx - 1];
    if (!prevLesson) return false;

    const prevKey = `${appState.track}_${prevLesson.id}`;
    return appState.completedLessons.includes(prevKey);
}

// Fungsi menyimpan progress aktivitas pengguna secara otomatis
function saveUserProgress() {
    localStorage.setItem('lingua_track', appState.track);
    localStorage.setItem('lingua_lesson_idx', appState.currentLessonIndex);
    localStorage.setItem('lingua_question_idx', appState.currentQuestionIndex);
    localStorage.setItem('lingua_streak', appState.streak);
    localStorage.setItem('lingua_completed_lessons', JSON.stringify(appState.completedLessons));
}

async function loadCurriculum(track) {
    try {
        const fileName = track === 'ja' ? 'japanese_jf_n5.json' : 'english_cefr_a1.json';
        const res = await fetch(`./data/${fileName}`);
        appState.currentCurriculum = await res.json();

        // Batasi batas indeks bab jika melampaui total bab
        if (appState.currentLessonIndex >= appState.currentCurriculum.lessons.length) {
            appState.currentLessonIndex = 0;
        }

        renderRoadmap();
        loadCurrentQuestion();
    } catch (err) {
        console.error("Gagal memuat file JSON kurikulum:", err);
    }
}

async function changeTrack(newTrack) {
    appState.track = newTrack;
    appState.currentLessonIndex = 0;
    appState.currentQuestionIndex = 0;
    appState.streak = 0;

    saveUserProgress();

    const chatContainer = document.getElementById('chatMessagesContainer');
    if (chatContainer) chatContainer.innerHTML = '';

    await loadCurriculum(newTrack);
    updateStreakUI();
}

function renderRoadmap() {
    const data = appState.currentCurriculum;
    if (!data) return;

    document.getElementById('roadmapTrackBadge').innerText = data.trackTitle;
    document.getElementById('roadmapTitle').innerText = data.levelTitle;
    document.getElementById('roadmapDesc').innerText = data.levelDesc;

    const container = document.getElementById('lessonListContainer');
    container.innerHTML = '';

    data.lessons.forEach((lesson, idx) => {
        const lessonKey = `${appState.track}_${lesson.id}`;
        const isCompleted = appState.completedLessons.includes(lessonKey);
        const isUnlocked = isDayUnlocked(idx);
        const isCurrent = idx === appState.currentLessonIndex && isUnlocked;

        const div = document.createElement('div');
        div.className = `p-4 rounded-2xl border flex items-center justify-between transition ${!isUnlocked
                ? 'bg-stone-100/40 dark:bg-stone-900/20 border-stone-200/60 dark:border-stone-800/40 opacity-55'
                : isCurrent
                    ? 'bg-amber-50/80 dark:bg-stone-900 border-[#C85A32] dark:border-[#C85A32] shadow-sm'
                    : isCompleted
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                        : 'bg-stone-100/50 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800'
            }`;

        div.innerHTML = `
      <div class="flex items-center space-x-3.5">
        <div class="w-8 h-8 rounded-xl ${!isUnlocked
                ? 'bg-stone-200 dark:bg-stone-800 text-stone-400'
                : isCurrent
                    ? 'bg-[#C85A32] text-white'
                    : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-300 dark:bg-stone-700 text-stone-600'
            } font-serif font-bold flex items-center justify-center text-xs">
          ${!isUnlocked ? '<i class="fa-solid fa-lock text-[10px]"></i>' : isCompleted ? '<i class="fa-solid fa-check"></i>' : idx + 1}
        </div>
        <div>
          <span class="text-[10px] font-bold ${!isUnlocked
                ? 'text-stone-400'
                : isCompleted
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-[#C85A32]'
            } uppercase tracking-wide">
            ${lesson.topic || `HARI ${lesson.day || idx + 1}`} ${!isUnlocked ? '• Terkunci' : isCompleted ? '• Selesai' : ''}
          </span>
          <h4 class="text-sm font-bold text-stone-900 dark:text-stone-100 font-serif">${lesson.title}</h4>
        </div>
      </div>
      <button onclick="${isUnlocked ? `startLesson(${idx})` : `alert('Selesaikan bab Hari ${idx} terlebih dahulu untuk membuka bab ini!')`}" 
        class="px-3.5 py-1.5 ${!isUnlocked
                ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed'
                : isCurrent
                    ? 'bg-[#C85A32] text-white'
                    : isCompleted
                        ? 'bg-stone-800 text-stone-200'
                        : 'bg-stone-700 text-white'
            } rounded-xl text-xs font-serif font-bold hover:opacity-90 transition btn-tactile">
        ${!isUnlocked ? '<i class="fa-solid fa-lock text-[10px]"></i>' : isCurrent ? 'Lanjutkan' : isCompleted ? 'Ulangi' : 'Mulai'}
      </button>
    `;
        container.appendChild(div);
    });
}

function startLesson(idx) {
    if (!isDayUnlocked(idx)) {
        alert(`Selesaikan bab Hari ${idx} terlebih dahulu untuk membuka bab ini!`);
        return;
    }
    appState.currentLessonIndex = idx;
    appState.currentQuestionIndex = 0;
    appState.streak = 0;
    saveUserProgress();
    updateStreakUI();
    loadCurrentQuestion();
    switchTab('practice');
}

/* ==========================================================================
   DESKTOP & MOBILE TAB SWITCHING CONTROLLER
   ========================================================================== */
function switchTab(tabName) {
    ['roadmap', 'practice', 'tutor', 'vault'].forEach(t => {
        const viewEl = document.getElementById(`view-${t}`);
        if (viewEl) {
            viewEl.classList.add('hidden');
            viewEl.classList.remove('tab-view-active');
        }

        const desktopBtn = document.getElementById(`tab-desktop-${t}`);
        if (desktopBtn) {
            desktopBtn.className = 'tab-desktop-btn flex-1 py-1.5 text-xs font-serif font-bold rounded-xl transition text-stone-500 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white';
        }

        const mobileBtn = document.getElementById(`tab-mobile-${t}`);
        if (mobileBtn) {
            mobileBtn.classList.remove('active');
            const textSpan = mobileBtn.querySelector('span');
            if (textSpan) textSpan.className = 'text-[9px] font-serif font-bold text-stone-400';
        }
    });

    const activeView = document.getElementById(`view-${tabName}`);
    if (activeView) {
        activeView.classList.remove('hidden');
        void activeView.offsetWidth;
        activeView.classList.add('tab-view-active');
    }

    const activeDesktopBtn = document.getElementById(`tab-desktop-${tabName}`);
    if (activeDesktopBtn) {
        activeDesktopBtn.className = 'tab-desktop-btn flex-1 py-1.5 text-xs font-serif font-bold rounded-xl transition bg-[#C85A32] text-white shadow-xs';
    }

    const activeMobileBtn = document.getElementById(`tab-mobile-${tabName}`);
    if (activeMobileBtn) {
        activeMobileBtn.classList.add('active');
        const textSpan = activeMobileBtn.querySelector('span');
        if (textSpan) textSpan.className = 'text-[9px] font-serif font-bold text-[#C85A32]';
    }

    if (tabName === 'tutor') initTutorChat();
    if (tabName === 'vault') renderVault();
}

function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    const icon = document.getElementById('themeIcon');
    icon.className = document.documentElement.classList.contains('dark') ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function saveErrorToVault(userString, ruleExplanation) {
    const item = {
        id: Date.now(),
        track: appState.track,
        text: userString,
        rule: ruleExplanation,
        date: new Date().toLocaleDateString('id-ID')
    };
    appState.errorVault.unshift(item);
    localStorage.setItem('lingua_errors', JSON.stringify(appState.errorVault));
    updateVaultCount();
}

function renderVault() {
    const container = document.getElementById('vaultListContainer');
    container.innerHTML = '';

    if (appState.errorVault.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-12 text-stone-400 font-serif text-sm">Jurnal kesalahan masih kosong. Seluruh latihan Anda berjalan baik!</div>`;
        return;
    }

    appState.errorVault.forEach(err => {
        const card = document.createElement('div');
        card.className = 'bg-stone-100/70 dark:bg-stone-800 p-4 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm space-y-2';
        card.innerHTML = `
      <div class="flex justify-between items-center text-[10px] text-stone-400 font-bold">
        <span>${err.track.toUpperCase()} • ${err.date}</span>
        <span class="text-amber-800 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">Tinjauan</span>
      </div>
      <p class="text-sm font-bold font-serif text-stone-900 dark:text-stone-100">"${err.text}"</p>
      <p class="text-xs text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-900 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800">${err.rule}</p>
    `;
        container.appendChild(card);
    });
}

function updateVaultCount() {
    const count = appState.errorVault.length;
    if (document.getElementById('vaultCountDesktop')) {
        document.getElementById('vaultCountDesktop').innerText = count;
    }

    const badgeMobile = document.getElementById('vaultBadgeMobile');
    if (badgeMobile) {
        badgeMobile.innerText = count;
        if (count > 0) {
            badgeMobile.classList.remove('hidden');
        } else {
            badgeMobile.classList.add('hidden');
        }
    }
}

function clearErrorVault() {
    if (confirm('Bersihkan seluruh riwayat jurnal kesalahan?')) {
        appState.errorVault = [];
        localStorage.removeItem('lingua_errors');
        updateVaultCount();
        renderVault();
    }
}

function openApiKeyModal() { document.getElementById('apiKeyModal').classList.remove('hidden'); }
function closeApiKeyModal() { document.getElementById('apiKeyModal').classList.add('hidden'); }
function saveApiKey() {
    const val = document.getElementById('apiKeyInput').value.trim();
    appState.apiKey = val;
    localStorage.setItem('gemini_api_key', val);
    closeApiKeyModal();
    alert('Gemini API Key berhasil disimpan!');
}

function toggleRomaji() {
    appState.showRomaji = !appState.showRomaji;
    const btn = document.getElementById('romajiToggleBtn');
    if (btn) {
        btn.innerText = appState.showRomaji ? 'Romaji ON' : 'Romaji OFF';
        btn.className = appState.showRomaji
            ? 'px-2 py-0.5 bg-amber-100 dark:bg-stone-800 text-amber-900 dark:text-amber-300 font-mono text-[9px] font-bold rounded-md btn-tactile'
            : 'px-2 py-0.5 bg-stone-200 dark:bg-stone-900 text-stone-500 font-mono text-[9px] font-bold rounded-md btn-tactile';
    }
    loadCurrentQuestion();
}

function updateDailyGoalUI() {
    const badge = document.getElementById('dailyGoalBadge');
    if (badge) {
        badge.innerText = `${appState.dailyCompleted}/${appState.dailyTarget} Target`;
    }
}

window.addEventListener('DOMContentLoaded', updateDailyGoalUI);