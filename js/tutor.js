/* ==========================================================================
   AI TUTOR 1-ON-1 ENGINE (GEMINI API) - LIVE TYPEWRITER STREAMING
   ========================================================================== */

function initTutorChat() {
    if (!appState.currentCurriculum) return;

    document.getElementById('tutorPersonaTitle').innerText = appState.currentCurriculum.tutorPersona;

    const container = document.getElementById('chatMessagesContainer');

    if (container && container.children.length === 0) {
        addChatMessageStream('ai', `Selamat datang! Saya adalah Tutor AI Anda untuk ${appState.currentCurriculum.trackTitle}. Mari kita mulai latihan percakapan langsung.`);
    }
}

/* Pesan User (Langsung Muncul) */
function addChatMessage(role, text) {
    const container = document.getElementById('chatMessagesContainer');
    const div = document.createElement('div');
    div.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;

    div.innerHTML = `
    <div class="max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${role === 'user'
            ? 'bg-rose-700 text-white font-sans rounded-br-none shadow-sm'
            : 'bg-stone-200/70 dark:bg-slate-800 text-stone-900 dark:text-stone-100 font-serif rounded-bl-none border border-stone-300 dark:border-slate-700'
        }">
      ${text}
    </div>
  `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

/* Pesan AI Stream (Efek Live Chat Ketik Karakter Per Karakter) */
async function addChatMessageStream(role, fullText) {
    if (role === 'user') {
        addChatMessage('user', fullText);
        return;
    }

    const container = document.getElementById('chatMessagesContainer');
    const div = document.createElement('div');
    div.className = `flex justify-start`;

    const bubble = document.createElement('div');
    bubble.className = `max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed bg-stone-200/70 dark:bg-slate-800 text-stone-900 dark:text-stone-100 font-serif rounded-bl-none border border-stone-300 dark:border-slate-700`;
    div.appendChild(bubble);
    container.appendChild(div);

    let index = 0;
    const speed = 18; // Kecepatan ketik (ms)

    return new Promise((resolve) => {
        function type() {
            if (index < fullText.length) {
                bubble.textContent += fullText.charAt(index);
                index++;
                container.scrollTop = container.scrollHeight;
                setTimeout(type, speed);
            } else {
                resolve();
            }
        }
        type();
    });
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    addChatMessage('user', msg);
    input.value = '';

    const notesEl = document.getElementById('diagGrammarNotes');
    if (notesEl) notesEl.innerText = 'Menganalisis tata bahasa...';

    // Cek keberadaan API Key
    const cleanKey = appState.apiKey ? appState.apiKey.trim() : '';
    if (!cleanKey) {
        setTimeout(async () => {
            const fallbackResp = `Jawaban Anda memuat susunan kalimat yang baik. Catatan: Selalu perhatikan keselarasan subjek dan kata kerja baku. Ada frasa lain yang ingin dicoba?`;
            await addChatMessageStream('ai', fallbackResp);
            playAudioText(fallbackResp);
            if (notesEl) notesEl.innerText = 'Kalimat sudah baik. Masukkan API key untuk evaluasi Gemini yang lebih presisi.';
        }, 400);
        return;
    }

    try {
        const rulesJSON = JSON.stringify(appState.currentCurriculum);
        const prompt = `Anda adalah ${appState.currentCurriculum.tutorPersona}. Evaluasi input pengguna HANYA berdasarkan aturan tata bahasa JSON ini: ${rulesJSON}. 
    Pengguna berkata: "${msg}". 
    Berikan respon dalam format JSON murni tanpa formatting markdown: {"response": "balasan percakapan", "score": "Good/Needs Practice", "notes": "catatan tata bahasa singkat", "correction": "versi kalimat yang lebih sempurna"}`;

        // Menggunakan model 'gemini-1.5-flash'
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(cleanKey)}`;

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await res.json();

        // Penanganan eror jika API key ditolak atau limit habis
        if (!res.ok || data.error) {
            const errMsg = data.error?.message || 'Gagal terhubung ke Gemini API.';
            await addChatMessageStream('ai', `[Eror API]: ${errMsg}`);
            if (notesEl) notesEl.innerText = 'Periksa kembali Gemini API Key Anda pada menu ikon kunci di atas.';
            return;
        }

        const rawText = data.candidates[0].content.parts[0].text;
        const cleanJSON = JSON.parse(rawText.replace(/```json|```/g, '').trim());

        await addChatMessageStream('ai', cleanJSON.response);
        playAudioText(cleanJSON.response);

        if (document.getElementById('diagScoreBadge')) document.getElementById('diagScoreBadge').innerText = cleanJSON.score;
        if (notesEl) notesEl.innerText = cleanJSON.notes;

        if (cleanJSON.score !== 'Good') {
            saveErrorToVault(msg, cleanJSON.notes);
        }

    } catch (err) {
        console.error("Gemini Fetch Error:", err);
        await addChatMessageStream('ai', 'Terjadi kendala koneksi atau format respon API. Mohon periksa kembali API Key Anda.');
    }
}

function handleChatKeyPress(e) {
    if (e.key === 'Enter') sendChatMessage();
}