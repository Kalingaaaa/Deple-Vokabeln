// Serverless-Funktion (Vercel) für den zentralen Vokabelspeicher.
// Nutzt Vercel KV (Upstash Redis REST API) im Hintergrund.
// Erwartete Umgebungsvariablen im Vercel-Projekt:
//   KV_REST_API_URL, KV_REST_API_TOKEN  -> werden automatisch gesetzt, wenn du eine
//                                          Vercel KV Datenbank mit dem Projekt verknüpfst.
//   VOCAB_PASSWORD                      -> selbst gewähltes Passwort, manuell unter
//                                          Project Settings -> Environment Variables setzen.

module.exports = async function handler(req, res) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const SECRET = process.env.VOCAB_PASSWORD;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!KV_URL || !KV_TOKEN) {
    res.status(500).json({ error: 'Vercel KV não está ligado a este projeto. Vai a Storage -> Create Database -> KV.' });
    return;
  }
  if (!SECRET) {
    res.status(500).json({ error: 'A variável de ambiente VOCAB_PASSWORD não está definida.' });
    return;
  }

  const query = req.query || {};
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const token = query.token || body.token || req.headers['x-vocab-token'];

  if (token !== SECRET) {
    res.status(401).json({ error: 'Password incorreta.' });
    return;
  }

  const key = query.key || body.key;
  if (!key || typeof key !== 'string') {
    res.status(400).json({ error: 'Falta o parâmetro key.' });
    return;
  }
  const fullKey = 'vocabDeple:' + key;

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${KV_URL}/get/${encodeURIComponent(fullKey)}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      if (!r.ok) {
        res.status(502).json({ error: 'Erro ao contactar a base de dados (GET).' });
        return;
      }
      const data = await r.json();
      res.status(200).json({ key, value: data.result });
      return;
    }

    if (req.method === 'POST') {
      const value = body.value;
      if (typeof value !== 'string') {
        res.status(400).json({ error: 'O campo value tem de ser uma string.' });
        return;
      }
      const r = await fetch(`${KV_URL}/set/${encodeURIComponent(fullKey)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'text/plain'
        },
        body: value
      });
      if (!r.ok) {
        res.status(502).json({ error: 'Erro ao contactar a base de dados (SET).' });
        return;
      }
      res.status(200).json({ key, ok: true });
      return;
    }

    res.status(405).json({ error: 'Método não suportado.' });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
