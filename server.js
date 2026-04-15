import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// LILATER API ANAHTARI
const openai = new OpenAI({
  apiKey: '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' // <--- BURAYA KENDİ TAM ANAHTARINI YAPIŞTIRMAYI UNUTMA
});

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('Lilater: Yayına hazır bağlantı kuruldu.');

    // ... (Diğer kısımlar aynı, sadece socket.on kısmını güncelle)

socket.on('translate-this', async (data) => {
    // Boş metinleri engelle
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
            // Hız için temperature değerini düşürüyoruz
            temperature: 0.3 
        });

        const translatedText = response.choices[0].message.content;
        socket.emit('display-translation', translatedText);
        console.log(`[${data.target}] >> ${translatedText}`);
    } catch (error) {
        console.error("OpenAI Hatası:", error.message);
    }
});

// ...
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Lilater yayında! Port: ${PORT}`);
});
