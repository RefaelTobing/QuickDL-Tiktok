// --- KONFIGURASI BACKEND ---
const BASE_URL = "http://localhost:5000";
// const BASE_URL = "https://streethub-backend-pael.onrender.com";

// --- ELEMENT ---
const urlInput = document.getElementById("urlInput");
const status = document.getElementById("status");
const card = document.getElementById("resultCard");
const thumb = document.getElementById("thumb");
const author = document.getElementById("author");
const titleVid = document.getElementById("title");
const downloadBtn = document.getElementById("downloadBtn");
const downloadAudio = document.getElementById("downloadAudio");

const body = document.body;
const darkToggle = document.getElementById("darkToggle");

// --------------------------------------
// AUTO DETECT PASTE TIKTOK
// --------------------------------------
urlInput.addEventListener("paste", () => {
    setTimeout(() => {
        if (urlInput.value.includes("tiktok.com")) {
            downloadVideo();
        }
    }, 400);
});

// --------------------------------------
// DARK MODE
// --------------------------------------
if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    body.classList.add("dark-mode");
}

if (localStorage.getItem("theme") === "dark") {
    body.classList.add("dark-mode");
}

if (darkToggle) {
    darkToggle.addEventListener("click", () => {
        body.classList.toggle("dark-mode");
        localStorage.setItem(
            "theme",
            body.classList.contains("dark-mode") ? "dark" : "light"
        );
    });
}

// --------------------------------------
// FUNGSI DOWNLOAD (SUDAH DIPERBAIKI)
// --------------------------------------
async function downloadVideo() {
    const input = urlInput.value.trim();
    if (!input) return alert("Kasih link TikTok dulu, king.");

    status.innerText = "🔎 Mengambil metadata...";
    card.classList.add("hidden");

    try {
        const res = await fetch(`${BASE_URL}/api/tiktok?url=${encodeURIComponent(input)}`);
        const data = await res.json();

        if (data.error) {
            status.innerText = "❌ " + data.error;
            return;
        }

        // Set Display
        status.innerText = "";
        
        // FIX: Sesuaikan nama data dengan Backend (index.js)
        thumb.src = data.cover;           // Backend ngirim 'cover', bukan 'thumbnail'
        author.innerText = "@" + data.author;
        titleVid.innerText = data.title;

        // FIX: Pake Force Download Backend biar ke-download jadi file
        // Backend minta query ?video=... bukan ?url=...
        downloadBtn.href = `${BASE_URL}/api/force-download?video=${encodeURIComponent(data.video)}`;
        
        // FIX: Tombol Audio (Langsung ke link music asli)
        downloadAudio.href = data.music; 

        card.classList.remove("hidden");

    } catch (err) {
        status.innerText = "❌ Gagal menghubungkan ke server.";
        console.log(err);
    }
}