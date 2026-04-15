import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Yapılandırma
dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY 
});

// SaaS Kullanıcı Simülasyonu (Database bağlanana kadar kredi takibi yapar)
let userDB = {
    credits: 120.0, // Başlangıç kredisi (dakika)
    plan: "Free",
    id: "user_launch_v1"
};

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- SOCKET ENGINE ---
io.on('connection', (socket) => {
    console.log('✅ Lilater SaaS: Yeni bağlantı kuruldu. ID:', socket.id);

    // 1. ANA ÇEVİRİ MOTORU
    socket.on('translate-this', async (data) => {
        // Kredi Kontrolü
        if (userDB.credits <= 0) {
            return socket.emit('error-msg', 'Krediniz tükenmiştir. Lütfen planınızı yükseltin.');
        }

        if (!data.text || data.text.length < 3) return;

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { 
                        role: "system", 
                        content: `You are a professional real-time simultaneous translator for Lilater SaaS.
                        - Target Language: ${data.target}
                        - Rules: NO preamble, NO explanations. Output ONLY the natural translation.
                        - Context: Professional meeting/stream. Use idiomatic and natural phrasing.`
                    },
                    { role: "user", content: data.text }
                ],
                temperature: 0.3 
            });

            // Kredi Düşümü (Her çeviri isteğinde 0.1 dakika/birim düşer)
            userDB.credits -= 0.1;
            const updatedCredits = userDB.credits > 0 ? userDB.credits.toFixed(1) : "0.0";

            const translatedText = response.choices[0].message.content;
            
            // Hem çeviriyi hem güncel krediyi gönderiyoruz
            socket.emit('display-translation', {
                text: translatedText,
                credits: updatedCredits
            });

            console.log(`[${data.target}] Translation Successful. Remaining: ${updatedCredits}`);
        } catch (error) {
            console.error("OpenAI Çeviri Hatası:", error.message);
            socket.emit('error-msg', 'Çeviri motoru şu an meşgul.');
        }
    });

    // 2. KONU ÖZETLEME MOTORU (Sessizlik anında tetiklenir)
    socket.on('summarize-this', async (data) => {
        if (!data.fullText || data.fullText.length < 50) return;

        try {
            console.log("📍 Konu özeti oluşturuluyor...");
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { 
                        role: "system", 
                        content: "Sen bir toplantı asistanısın. Verilen metni analiz et ve şu an konuşulan ana konuyu profesyonel, kısa (maksimum 10 kelime) bir başlık/cümle olarak özetle." 
                    },
                    { role: "user", content: "Metin: " + data.fullText }
                ],
                temperature: 0.5,
            });

            socket.emit('display-summary', {
                summary: response.choices[0].message.content
            });
        } catch (e) {
            console.error("Özetleme Hatası:", e.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Lilater: Kullanıcı ayrıldı.');
    });
});

// Sunucuyu Başlat
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 ==========================================
    🚀 LILATER PRE-LAUNCH ENGINE READY
    🚀 Port: ${PORT}
    🚀 Mode: SaaS Performance Enabled
    🚀 ==========================================
    `);
});
