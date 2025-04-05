import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { inferActivity } from "./inferActivity.js";
import { verifyAuthHash } from "./authMiddleware.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());

const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Rota protegida
app.post("/monitoramento", verifyAuthHash, async (req, res) => {
  try {
    const { timestamp, hostname, window_title, mouse_clicks, keys_pressed } =
      req.body;
    const activity = inferActivity({
      window_title,
      keys_pressed,
      mouse_clicks,
    });

    const query = `
      INSERT INTO user_activity (timestamp, hostname, window_title, activity, mouse_clicks, key_count, keys_pressed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await db.execute(query, [
      timestamp,
      hostname,
      window_title,
      activity,
      mouse_clicks,
      keys_pressed.length,
      JSON.stringify(keys_pressed),
    ]);

    res.status(201).json({ status: "OK", activity });
  } catch (err) {
    console.error("Erro:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.get("/monitoramento/hoje", verifyAuthHash, async (req, res) => {
  try {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");

    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}`;

    const [rows] = await db.execute(
      `SELECT * FROM user_activity WHERE DATE(timestamp) = ? ORDER BY timestamp DESC`,
      [today]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar atividades de hoje:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.get("/monitoramento", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM user_activity 
         WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
         ORDER BY timestamp DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar monitoramento:", err);
    res.status(500).send("Erro ao buscar dados.");
  }
});

// Serve a página de dashboard
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "web", "dashboard.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
