const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const m = env.match(/GEMINI_API_KEY=(.+)/);
const key = m ? m[1].trim() : '';

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: 'Balas hanya dengan JSON: {"status": "ok", "message": "Siap!"}' }] }],
  }),
})
  .then(r => r.json())
  .then(d => {
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('Gemini raw text:', text);
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    console.log('Parsed JSON:', JSON.parse(cleaned));
  })
  .catch(err => console.error('Error:', err));
