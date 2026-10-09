/* ==========================================================================
   GLOBAL APP STATE & CONTROLLER
   ========================================================================== */
let appState = {
    track: 'en',
    currentCurriculum: null,
    currentLessonIndex: 0,
    currentQuestionIndex: 0,
    streak: 0,
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
    await loadCurriculum(appState.track);
    updateVaultCount();

    // Register Service Worker PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => { });
    }

    // Splash Screen memudar halus setelah 1.2 detik
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.classList.add('splash-hidden');
    }, 1200);
};

async function loadCurriculum(track) {
    try {
        const fileName = track === 'ja' ? 'japanese_jf_n5.json' : 'english_cefr_a1.json';
        const res = await fetch(`./data/${fileName}`);
        appState.currentCurriculum = await res.json();
        renderRoadmap();
    } catch (err) {
        console.error("Gagal memuat file JSON kurikulum:", err);
    }
}

async function changeTrack(newTrack) {
    appState.track = newTrack;
    appState.currentLessonIndex = 0;
    appState.currentQuestionIndex = 0;
    appState.streak = 0;

    const chatContainer = document.getElementById('chatMessagesContainer');
    if (chatContainer) chatContainer.innerHTML = '';

    await loadCurriculum(newTrack);

    loadCurrentQuestion();
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
        const isCurrent = idx === appState.currentLessonIndex;
        const div = document.createElement('div');
        div.className = `p-4 rounded-xl border flex items-center justify-between transition ${isCurrent
            ? 'bg-amber-50/60 dark:bg-slate-800 border-amber-300 dark:border-slate-700 shadow-paper'
            : 'bg-stone-100/50 dark:bg-slate-900 border-stone-200 dark:border-slate-800 opacity-70'
            }`;

        div.innerHTML = `
      <div class="flex items-center space-x-3.5">
        <div class="w-8 h-8 rounded-lg ${isCurrent ? 'bg-rose-700 text-white' : 'bg-stone-300 dark:bg-slate-700 text-stone-600'} font-serif font-bold flex items-center justify-center text-sm">
          ${idx + 1}
        </div>
        <div>
          <span class="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wide">${lesson.topic}</span>
          <h4 class="text-sm font-bold text-stone-900 dark:text-stone-100 font-serif">${lesson.title}</h4>
        </div>
      </div>
      <button onclick="startLesson(${idx})" class="px-4 py-2 bg-rose-700 text-white rounded-xl text-xs font-semibold hover:bg-rose-800 transition shadow-paper">
        ${isCurrent ? 'Mulai Latihan' : 'Tinjau'}
      </button>
    `;
        container.appendChild(div);
    });
}

function startLesson(idx) {
    appState.currentLessonIndex = idx;
    appState.currentQuestionIndex = 0;
    appState.streak = 0;
    updateStreakUI();
    loadCurrentQuestion();
    switchTab('practice');
}

/* ==========================================================================
   DESKTOP & MOBILE TAB SWITCHING CONTROLLER
   ========================================================================== */
function switchTab(tabName) {
    ['roadmap', 'practice', 'tutor', 'vault'].forEach(t => {
        // 1. Sembunyikan semua tampilan tab
        const viewEl = document.getElementById(`view-${t}`);
        if (viewEl) {
            viewEl.classList.add('hidden');
            viewEl.classList.remove('tab-view-active');
        }

        // 2. Reset Tombol Desktop (Aman & Kontras)
        const desktopBtn = document.getElementById(`tab-desktop-${t}`);
        if (desktopBtn) {
            desktopBtn.className = 'tab-desktop-btn flex-1 py-1.5 text-xs font-serif font-bold rounded-xl transition text-stone-500 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white';
        }

        // 3. Reset Tombol Mobile Bubble Nav
        const mobileBtn = document.getElementById(`tab-mobile-${t}`);
        if (mobileBtn) {
            mobileBtn.classList.remove('active');
            const textSpan = mobileBtn.querySelector('span');
            if (textSpan) textSpan.className = 'text-[9px] font-serif font-bold text-stone-400';
        }
    });

    // 4. Tampilkan View Aktif
    const activeView = document.getElementById(`view-${tabName}`);
    if (activeView) {
        activeView.classList.remove('hidden');
        void activeView.offsetWidth;
        activeView.classList.add('tab-view-active');
    }

    // 5. Aktifkan Tombol Desktop
    const activeDesktopBtn = document.getElementById(`tab-desktop-${tabName}`);
    if (activeDesktopBtn) {
        activeDesktopBtn.className = 'tab-desktop-btn flex-1 py-1.5 text-xs font-serif font-bold rounded-xl transition bg-[#C85A32] text-white shadow-xs';
    }

    // 6. Aktifkan Tombol Mobile
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
        card.className = 'bg-stone-100/70 dark:bg-slate-800 p-4 rounded-2xl border border-stone-200 dark:border-slate-700 shadow-paper space-y-2';
        card.innerHTML = `
      <div class="flex justify-between items-center text-[10px] text-stone-400 font-bold">
        <span>${err.track.toUpperCase()} • ${err.date}</span>
        <span class="text-amber-800 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">Tinjauan</span>
      </div>
      <p class="text-sm font-bold font-serif text-stone-900 dark:text-stone-100">"${err.text}"</p>
      <p class="text-xs text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-slate-900 p-2.5 rounded-xl border border-stone-200 dark:border-slate-800">${err.rule}</p>
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
        // Hanya tampilkan lingkaran merah jika ada kesalahan (> 0)
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

// Panggil fungsi ini saat halaman pertama kali dimuat
window.addEventListener('DOMContentLoaded', updateDailyGoalUI);

/* ==========================================================================
   SCRIPT & NUMBERS INTERACTIVE REFERENCE MODAL
   ========================================================================== */

const scriptData = {
    ja: {
        hiragana: [
            { char: 'あ', romaji: 'a' }, { char: 'い', romaji: 'i' }, { char: 'う', romaji: 'u' }, { char: 'え', romaji: 'e' }, { char: 'お', romaji: 'o' },
            { char: 'か', romaji: 'ka' }, { char: 'き', romaji: 'ki' }, { char: 'く', romaji: 'ku' }, { char: 'け', romaji: 'ke' }, { char: 'こ', romaji: 'ko' },
            { char: 'さ', romaji: 'sa' }, { char: 'し', romaji: 'shi' }, { char: 'す', romaji: 'su' }, { char: 'せ', romaji: 'se' }, { char: 'そ', romaji: 'so' },
            { char: 'た', romaji: 'ta' }, { char: 'ち', romaji: 'chi' }, { char: 'つ', romaji: 'tsu' }, { char: 'て', romaji: 'te' }, { char: 'と', romaji: 'to' },
            { char: 'な', romaji: 'na' }, { char: 'に', romaji: 'ni' }, { char: 'ぬ', romaji: 'nu' }, { char: 'ね', romaji: 'ne' }, { char: 'の', romaji: 'no' },
            { char: 'は', romaji: 'ha' }, { char: 'ひ', romaji: 'hi' }, { char: 'ふ', romaji: 'fu' }, { char: 'へ', romaji: 'he' }, { char: 'ほ', romaji: 'ho' },
            { char: 'ま', romaji: 'ma' }, { char: 'み', romaji: 'mi' }, { char: 'む', romaji: 'mu' }, { char: 'め', romaji: 'me' }, { char: 'も', romaji: 'mo' },
            { char: 'や', romaji: 'ya' }, { char: 'ゆ', romaji: 'yu' }, { char: 'よ', romaji: 'yo' },
            { char: 'ら', romaji: 'ra' }, { char: 'り', romaji: 'ri' }, { char: 'る', romaji: 'ru' }, { char: 'れ', romaji: 're' }, { char: 'ろ', romaji: 'ro' },
            { char: 'わ', romaji: 'wa' }, { char: 'を', romaji: 'wo' }, { char: 'ん', romaji: 'n' }
        ],
        katakana: [
            { char: 'ア', romaji: 'a' }, { char: 'イ', romaji: 'i' }, { char: 'ウ', romaji: 'u' }, { char: 'エ', romaji: 'e' }, { char: 'オ', romaji: 'o' },
            { char: 'カ', romaji: 'ka' }, { char: 'キ', romaji: 'ki' }, { char: 'ク', romaji: 'ku' }, { char: 'ケ', romaji: 'ke' }, { char: 'コ', romaji: 'ko' },
            { char: 'サ', romaji: 'sa' }, { char: 'シ', romaji: 'shi' }, { char: 'ス', romaji: 'su' }, { char: 'セ', romaji: 'se' }, { char: 'ソ', romaji: 'so' },
            { char: 'タ', romaji: 'ta' }, { char: 'チ', romaji: 'chi' }, { char: 'ツ', romaji: 'tsu' }, { char: 'テ', romaji: 'te' }, { char: 'ト', romaji: 'to' },
            { char: 'ナ', romaji: 'na' }, { char: 'ニ', romaji: 'ni' }, { char: 'ヌ', romaji: 'nu' }, { char: 'ネ', romaji: 'ne' }, { char: 'ノ', romaji: 'no' },
            { char: 'ハ', romaji: 'ha' }, { char: 'ヒ', romaji: 'hi' }, { char: 'フ', romaji: 'fu' }, { char: 'ヘ', romaji: 'he' }, { char: 'ホ', romaji: 'ho' },
            { char: 'マ', romaji: 'ma' }, { char: 'ミ', romaji: 'mi' }, { char: 'ム', romaji: 'mu' }, { char: 'メ', romaji: 'me' }, { char: 'モ', romaji: 'mo' },
            { char: 'ヤ', romaji: 'ya' }, { char: 'ユ', romaji: 'yu' }, { char: 'ヨ', romaji: 'yo' },
            { char: 'ラ', romaji: 'ra' }, { char: 'リ', romaji: 'ri' }, { char: 'ル', romaji: 'ru' }, { char: 'レ', romaji: 're' }, { char: 'ろ', romaji: 'ro' },
            { char: 'ワ', romaji: 'wa' }, { char: 'ヲ', romaji: 'wo' }, { char: 'ン', romaji: 'n' }
        ],
        numbers: [
            { char: '一', romaji: 'ichi (1)', audio: 'いち' },
            { char: '二', romaji: 'ni (2)', audio: 'に' },
            { char: '三', romaji: 'san (3)', audio: 'さん' },
            { char: '四', romaji: 'yon (4)', audio: 'よん' },
            { char: '五', romaji: 'go (5)', audio: 'ご' },
            { char: '六', romaji: 'roku (6)', audio: 'ろく' },
            { char: '七', romaji: 'nana (7)', audio: 'なな' },
            { char: '八', romaji: 'hachi (8)', audio: 'はち' },
            { char: '九', romaji: 'kyuu (9)', audio: 'きゅう' },
            { char: '十', romaji: 'juu (10)', audio: 'じゅう' },
            { char: '百', romaji: 'hyaku (100)', audio: 'ひゃく' },
            { char: '千', romaji: 'sen (1000)', audio: 'せん' }
        ]
    },
    en: {
        alphabet: [
            { char: 'A a', romaji: 'ei /eɪ/', audio: 'A' },
            { char: 'B b', romaji: 'bee /biː/', audio: 'B' },
            { char: 'C c', romaji: 'see /siː/', audio: 'C' },
            { char: 'D d', romaji: 'dee /diː/', audio: 'D' },
            { char: 'E e', romaji: 'ee /iː/', audio: 'E' },
            { char: 'F f', romaji: 'ef /ɛf/', audio: 'F' },
            { char: 'G g', romaji: 'jee /dʒiː/', audio: 'G' },
            { char: 'H h', romaji: 'aych /eɪtʃ/', audio: 'H' },
            { char: 'I i', romaji: 'eye /aɪ/', audio: 'I' },
            { char: 'J j', romaji: 'jay /dʒeɪ/', audio: 'J' },
            { char: 'K k', romaji: 'kay /keɪ/', audio: 'K' },
            { char: 'L l', romaji: 'el /ɛl/', audio: 'L' },
            { char: 'M m', romaji: 'em /ɛm/', audio: 'M' },
            { char: 'N n', romaji: 'en /ɛn/', audio: 'N' },
            { char: 'O o', romaji: 'oh /oʊ/', audio: 'O' },
            { char: 'P p', romaji: 'pee /piː/', audio: 'P' },
            { char: 'Q q', romaji: 'cue /kjuː/', audio: 'Q' },
            { char: 'R r', romaji: 'ar /ɑːr/', audio: 'R' },
            { char: 'S s', romaji: 'es /ɛs/', audio: 'S' },
            { char: 'T t', romaji: 'tee /tiː/', audio: 'T' },
            { char: 'U u', romaji: 'you /juː/', audio: 'U' },
            { char: 'V v', romaji: 'vee /viː/', audio: 'V' },
            { char: 'W w', romaji: 'double-u /ˈdʌbəl.juː/', audio: 'W' },
            { char: 'X x', romaji: 'ex /ɛks/', audio: 'X' },
            { char: 'Y y', romaji: 'why /waɪ/', audio: 'Y' },
            { char: 'Z z', romaji: 'zee /ziː/', audio: 'Z' }
        ],
        numbers: [
            { char: '1', romaji: 'One /wʌn/' }, { char: '2', romaji: 'Two /tuː/' }, { char: '3', romaji: 'Three /θriː/' }, { char: '4', romaji: 'Four /fɔːr/' },
            { char: '5', romaji: 'Five /faɪv/' }, { char: '6', romaji: 'Six /sɪks/' }, { char: '7', romaji: 'Seven /ˈsɛv.ən/' }, { char: '8', romaji: 'Eight /eɪt/' },
            { char: '9', romaji: 'Nine /naɪn/' }, { char: '10', romaji: 'Ten /tɛn/' }, { char: '1st', romaji: 'First /fɜːrst/' }, { char: '2nd', romaji: 'Second /ˈsɛk.ənd/' },
            { char: '3rd', romaji: 'Third /θɜːrd/' }, { char: '4th', romaji: 'Fourth /fɔːrθ/' }, { char: '100', romaji: 'Hundred /ˈhʌn.drəd/' }, { char: '1000', romaji: 'Thousand /ˈθaʊ.zənd/' }
        ],
        days: [
            { char: 'Mon', romaji: 'Monday /ˈmʌn.deɪ/' }, { char: 'Tue', romaji: 'Tuesday /ˈtjuːz.deɪ/' }, { char: 'Wed', romaji: 'Wednesday /ˈwɛnz.deɪ/' },
            { char: 'Thu', romaji: 'Thursday /ˈθɜːrz.deɪ/' }, { char: 'Fri', romaji: 'Friday /ˈfraɪ.deɪ/' }, { char: 'Sat', romaji: 'Saturday /ˈsæt.ər.deɪ/' }, { char: 'Sun', romaji: 'Sunday /ˈsʌn.deɪ/' },
            { char: 'Jan', romaji: 'January /ˈdʒæn.ju.ɛri/' }, { char: 'Feb', romaji: 'February /ˈfɛb.ru.ɛri/' }, { char: 'Mar', romaji: 'March /mɑːrtʃ/' }, { char: 'Apr', romaji: 'April /ˈeɪ.prəl/' },
            { char: 'May', romaji: 'May /meɪ/' }, { char: 'Jun', romaji: 'June /dʒuːn/' }, { char: 'Jul', romaji: 'July /dʒuˈlaɪ/' }, { char: 'Aug', romaji: 'August /ˈɔː.ɡəst/' }
        ]
    }
};

let activeScriptTab = 'hiragana';

function openScriptModal() {
    const modal = document.getElementById('scriptModal');
    if (!modal) return;

    const track = appState.track;
    activeScriptTab = track === 'ja' ? 'hiragana' : 'alphabet';

    renderScriptTabs();
    renderScriptContent();
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
}

function closeScriptModal() {
    document.getElementById('scriptModal').classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

function renderScriptTabs() {
    const container = document.getElementById('scriptModalTabs');
    if (!container) return;
    container.innerHTML = '';

    const track = appState.track;
    const tabs = track === 'ja'
        ? [{ id: 'hiragana', label: 'Hiragana' }, { id: 'katakana', label: 'Katakana' }, { id: 'numbers', label: 'Angka & Kanji' }]
        : [{ id: 'alphabet', label: 'Alphabet A-Z' }, { id: 'numbers', label: 'Numbers & Ordinals' }, { id: 'days', label: 'Days & Months' }];

    tabs.forEach(t => {
        const btn = document.createElement('button');
        btn.className = `flex-1 py-1.5 rounded-xl transition ${activeScriptTab === t.id
            ? 'bg-white dark:bg-stone-800 text-[#C85A32] shadow-xs'
            : 'text-stone-500 hover:text-stone-800'}`;
        btn.innerText = t.label;
        btn.onclick = () => {
            activeScriptTab = t.id;
            renderScriptTabs();
            renderScriptContent();
        };
        container.appendChild(btn);
    });
}

function renderScriptContent() {
    const container = document.getElementById('scriptModalContent');
    if (!container) return;

    const items = scriptData[appState.track]?.[activeScriptTab] || [];
    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-4 sm:grid-cols-5 gap-2';

    items.forEach(item => {
        const card = document.createElement('button');
        card.className = 'p-2.5 bg-white dark:bg-stone-800 rounded-2xl border border-[#E6E1D7] dark:border-stone-700 flex flex-col items-center justify-center hover:border-[#C85A32] transition btn-tactile shadow-xs';

        card.onclick = () => playAudioText(item.audio || item.char, appState.track);

        card.innerHTML = `
      <span class="text-lg font-serif font-bold text-[#2D2A26] dark:text-stone-100">${item.char}</span>
      <span class="text-[9px] font-mono text-stone-400 mt-0.5 truncate w-full text-center">${item.romaji}</span>
    `;
        grid.appendChild(card);
    });

    container.appendChild(grid);
}