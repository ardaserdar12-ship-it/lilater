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
                        content: `Sen bir canlı yayın altyazı çevirmenisin. Sana metinler parça parça gelebilir. Gelen her parçayı hızla ${data.target} diline çevir. Asla yorum yapma, sadece çeviriyi ver.` 
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
});
