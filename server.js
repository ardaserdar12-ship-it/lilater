import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// SaaS Kullanıcı Verisi (Lansman için geçici hafıza)
let userDB = {
    credits: 60.0,
    plan: "Free",
    id: "user_001"
};

io.on('connection', (socket) => {
    console.log('✅ SaaS Bağlantısı Kuruldu');

    socket.on('translate-this', async (data) => {
        // Kredi Kontrolü
        if (userDB.credits <= 0) {
            return socket.emit('error-msg', 'Krediniz bitti! Lütfen planınızı yükseltin.');
        }

        try {
            // EN GÜÇLÜ ÇEVİRİ PROMPTU BURADA (Diğer dillerdeki saçmalamayı önler)
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
                        5. Handle specific idioms by providing their cultural equivalents in ${data.target}.`
                    },
                    { role: "user", content: data.text }
                ],
                temperature: 0.3, // Doğal akış için ideal değer
            });

            // Kredi Hesaplama (İstek başına 0.1 dakika düşer)
            userDB.credits -= 0.1;
            const currentCredits = userDB.credits > 0 ? userDB.credits.toFixed(1) : "0.0";

            socket.emit('display-translation', {
                text: response.choices[0].message.content,
                credits: currentCredits
            });
        } catch (e) {
            console.error("OpenAI Error:", e.message);
            socket.emit('error-msg', 'Çeviri motorunda bir sorun oluştu.');
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Lilater SaaS Engine Live on port ${PORT}`);
});
