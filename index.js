import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { inferActivity } from "./inferActivity.js";
import { verifyAuthHash } from "./authMiddleware.js";

dotenv.config();

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
