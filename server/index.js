const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ===== CONFIG =====
// Daftar server Cobalt komunitas
const COBALT_SERVERS = [
  'https://cobalt-api.ayo.tf',
  'https://ca.haloz.at',
  'https://cobalt.kwiatekmiki.pl'
];

// TikWM endpoint
const TIKWM_ENDPOINT = 'https://www.tikwm.com/api/';

// Helper: deteksi platform
function detectPlatform(url) {
  const u = url.toLowerCase();
  if (u.includes('tiktok.com') || u.includes('vm.tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram';
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  return 'unknown';
}

// Helper: fetch cobalt
async function fetchFromCobalt(url) {
  let lastError = null;
  for (const server of COBALT_SERVERS) {
    try {
      console.log(`[Cobalt] Trying server: ${server}`);
      const res = await axios.post(`${server}/api/json`, {
        url: url, vCodec: 'h264', vQuality: '720', filenamePattern: 'basic'
      }, {
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        timeout: 15000
      });

      if (!res || !res.data) continue;
      if (res.data.status === 'error') {
        console.error('[Cobalt] error:', res.data.text);
        continue;
      }
      return { server, data: res.data };
    } catch (err) {
      console.error(`[Cobalt] failed ${server}:`, err.message);
    }
  }
  throw lastError || new Error('All cobalt servers failed');
}

// Helper: pick best url
function pickBestUrlFromCobalt(data) {
  if (!data) return null;
  if (data.url && typeof data.url === 'string' && data.url.startsWith('http')) return data.url;
  
  if (Array.isArray(data.picker) && data.picker.length > 0) {
    const mp4s = data.picker.filter(p => p.url && p.url.includes('.mp4'));
    if (mp4s.length) return mp4s[0].url;
    if (data.picker[0].url) return data.picker[0].url;
  }
  
  if (Array.isArray(data.formats) && data.formats.length > 0) {
    const mp4s = data.formats.filter(f => (f.url || f[0]) && (f.ext === 'mp4' || (f.url && f.url.includes('.mp4'))));
    if (mp4s.length) return (mp4s[0].url || mp4s[0][0]);
    return data.formats[0].url || data.formats[0][0];
  }
  return null;
}

// ROUTES
app.get('/api/tiktok', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    console.log('Processing URL:', url);
    const platform = detectPlatform(url);

    if (platform === 'unknown') return res.status(400).json({ error: 'Platform not supported' });

    // TIKTOK STRATEGY
    if (platform === 'tiktok') {
      try {
        const resp = await axios.get(`${TIKWM_ENDPOINT}?url=${encodeURIComponent(url)}`, { timeout: 15000 });
        const d = resp.data && resp.data.data;
        if (!d) throw new Error('TikWM returned no data');

        return res.json({
          platform: 'TikTok',
          title: d.title || 'TikTok Video',
          author: d.author ? d.author.nickname : 'Unknown',
          cover: d.cover || null,
          video: d.play || d.download || null,
          music: d.music || null
        });
      } catch (err) {
        console.error('[TikWM] failed:', err.message);
      }
    }

    // COBALT STRATEGY
    try {
      const { data, server } = await fetchFromCobalt(url);
      const chosenUrl = pickBestUrlFromCobalt(data);

      if (!chosenUrl) return res.status(500).json({ error: 'No downloadable URL found.' });

      let platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
      if (platform === 'youtube') platformName = 'YouTube';

      return res.json({
        platform: platformName,
        title: data.filename || `${platformName} Video`,
        author: data.author || 'Unknown',
        cover: data.cover || null,
        video: chosenUrl,
        music: null,
        _meta: { cobaltServer: server }
      });

    } catch (err) {
      console.error('[Download] cobalt fallback failed:', err.message);
      return res.status(500).json({ error: 'Gagal mengambil video. Coba lagi nanti.' });
    }

  } catch (error) {
    console.error('Unexpected error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Force-download Route (FIXED FILENAME LOGIC)
app.get('/api/force-download', async (req, res) => {
  try {
    const { url, type } = req.query; 
    
    if (!url) return res.status(400).send('Missing url');

    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 30000
    });

    // --- LOGIC PERBAIKAN DI SINI ---
    // 1. Cek apakah ini request audio (mp3)
    const isAudio = type === 'mp3';
    
    // 2. Tentukan ekstensi (.mp3 atau .mp4) berdasarkan tipe
    const extension = isAudio ? 'mp3' : 'mp4';
    
    // 3. Tentukan Content-Type header
    const contentType = isAudio ? 'audio/mpeg' : 'video/mp4';

    // 4. Bikin nama file default yang dinamis mengikuti ekstensi
    let filename = req.query.filename;
    if (!filename) {
        filename = `quickdl_${Date.now()}.${extension}`;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    
    response.data.pipe(res);

  } catch (err) {
    console.error('[force-download] failed:', err.message || err);
    res.status(500).send('Failed to stream file');
  }
});

app.listen(PORT, () => console.log(`Universal downloader running on port ${PORT}`));