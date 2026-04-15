import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// GÜNCELLEME: Render/Canlı ortam için Socket.io ayarları
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Dışarıdan gelen bağlantılara izin ver
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'] // Bağlantı tipini garantiye al
});

// LILATER API ANAHTARI
const openai = new OpenAI({
    // GÜNCELLEME: Güvenlik için Environment Variable kullanıyoruz
    apiKey: process.env.OPENAI_API_KEY 
});

// Statik dosyaları (index.html vb.) doğru bulması için
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('Lilater: Yayına hazır bağlantı kuruldu. ID:', socket.id);

    socket.on('translate-this', async (data) => {
        if (!data.text || data.text.length < 3) return;

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { 
                       role: "system", 
        content: `You are a high-performance, real-time simultaneous translator for the Lilater SaaS platform.
        
        TASK:
        Translate the incoming text immediately and accurately into ${data.target}.
        
        CRITICAL RULES:
        1. NO explanations or pre-text. Output ONLY the translated text.
        2. Use natural, idiomatic phrasing in the target language (avoid literal, word-for-word translations).
        3. Maintain the tone and context of the speaker.
        4. If the input is a sentence fragment, provide the most plausible translation based on common speech patterns.
        5. Handle Turkish-specific idioms by providing their cultural equivalents in ${data.target}.`
                    },
                    { role: "user", content: data.text }
                ],
                temperature: 0.3 
            });

            const translatedText = response.choices[0].message.content;
            socket.emit('display-translation', translatedText);
            console.log(`[${data.target}] >> ${translatedText}`);
        } catch (error) {
            console.error("OpenAI Hatası:", error.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('Lilater: Kullanıcı ayrıldı.');
    });
});

// GÜNCELLEME: Render'ın atadığı portu kullan ve 0.0.0.0 üzerinden dinle
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Lilater Yayında! Port: ${PORT}`);

// server.js (Dosyanın üst kısımları aynı kalıyor)

// Odaları ve kullanıcı tercihlerini tutacak basit bir obje (Geçici hafıza)
const rooms = {}; 

io.on('connection', (socket) => {
    console.log('✅ Yeni bağlantı:', socket.id);

    // Odaya Katılma Event'i
    socket.on('join-room', ({ roomId, userName, targetLang }) => {
        socket.join(roomId);
        if (!rooms[roomId]) rooms[roomId] = { users: {} };
        
        // Kullanıcı bilgisini odaya kaydet
        rooms[roomId].users[socket.id] = {
            name: userName,
            target: targetLang
        };
        
        console.log(`👤 ${userName}, ${roomId} odasına ${targetLang} diliyle katıldı.`);
    });

    socket.on('translate-this', async (data) => {
        const { roomId, text, senderName } = data;
        const room = rooms[roomId];
        if (!room) return;

        // Odadaki her bir kullanıcı için ayrı çeviri yap
        for (const [id, user] of Object.entries(room.users)) {
            try {
                const stream = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { 
                            role: "system", 
                            content: `You are a real-time translator. Translate ONLY the text to ${user.target}. 
                            Context: This is a live meeting. Speaker: ${senderName}.` 
                        },
                        { role: "user", content: text }
                    ],
                    stream: true,
                    temperature: 0
                });

                let fullTranslation = "";
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        fullTranslation += content;
                        // Sadece ilgili kullanıcıya (ID bazlı) kendi dilindeki çeviriyi gönder
                        io.to(id).emit('display-translation', {
                            speaker: senderName,
                            text: fullTranslation,
                            original: text
                        });
                    }
                }
            } catch (e) {
                console.error("Çeviri Hatası:", e.message);
            }
        }
    });

    socket.on('disconnect', () => {
        // Kullanıcıyı odalardan temizle
        for (const roomId in rooms) {
            if (rooms[roomId].users[socket.id]) {
                delete rooms[roomId].users[socket.id];
            }
        }
    });
});
    
});
