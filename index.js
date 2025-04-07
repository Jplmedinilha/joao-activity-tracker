import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { verifyAuthHash } from "./authMiddleware.js";
import path from "path";
import { fileURLToPath } from "url";
import { DateTime } from "luxon";

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
app.post("/monitor", verifyAuthHash, async (req, res) => {
  console.log(req.body);
  const {
    timestamp,
    hostname,
    window_title,
    right_clicks,
    left_clicks,
    scroll_up,
    scroll_down,
    total_keys,
    custom_counts,
  } = req.body;

  try {
    // Verifica se a conexão com o banco está ativa
    if (!db || db._closing || db._fatalError) {
      await db.connect();
    }

    // Insere na tabela principal
    const [result] = await db.execute(
      `INSERT INTO user_main_activity 
          (timestamp, hostname, window_title, right_clicks, left_clicks, scroll_up, scroll_down, total_keys)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        timestamp,
        hostname,
        window_title,
        right_clicks,
        left_clicks,
        scroll_up,
        scroll_down,
        total_keys,
      ]
    );

    const mainId = result.insertId;

    // Prepara e filtra os dados customizados
    const customValues = Object.entries(custom_counts)
      .filter(([_, count]) => count > 0)
      .map(([key, count]) => [mainId, key, count]);

    if (customValues.length > 0) {
      await db.query(
        `INSERT INTO user_custom_activity (main_activity_id, key_name, key_count)
           VALUES ?`,
        [customValues]
      );
    }

    res.status(201).json({ status: "OK", inserted_id: mainId });
  } catch (err) {
    console.error("Erro ao inserir dados:", err);
    res.status(500).json({ error: "Erro interno ao inserir os dados" });
  }
});

app.get("/monitor", async (req, res) => {
  const { dia, mes, ano } = req.query;

  if (!dia || !mes || !ano)
    return res.status(400).json({
      error: "Parâmetros 'dia', 'mes' e 'ano' são obrigatórios",
    });

  try {
    if (!db || db._closing || db._fatalError) await db.connect();

    const pad = (v) => v.padStart(2, "0");
    const dateStart = `${ano}-${pad(mes)}-${pad(dia)} 00:00:00`;
    const dateEnd = `${ano}-${pad(mes)}-${pad(dia)} 23:59:59`;

    const [mainRows] = await db.query(
      `SELECT * FROM user_main_activity WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp`,
      [dateStart, dateEnd]
    );

    if (!mainRows.length)
      return res.status(200).json({ atividades: [], heatmap: {} });

    const mainIds = mainRows.map((row) => row.id);

    const [customRows] = await db.query(
      `SELECT * FROM user_custom_activity WHERE main_activity_id IN (?)`,
      [mainIds]
    );

    const customMap = customRows.reduce((acc, row) => {
      if (!acc[row.main_activity_id]) acc[row.main_activity_id] = [];
      acc[row.main_activity_id].push({
        key_name: row.key_name,
        key_count: row.key_count,
      });
      return acc;
    }, {});

    const extrairAppName = (title) => {
      if (!title || typeof title !== "string") return "Desconhecido";
      const partes = title.split(" | ");
      if (partes.length > 1) return partes.at(-1).trim();
      const hifen = title.split(" - ");
      return hifen.length > 1 ? hifen.at(-1).trim() : title.trim();
    };

    const atividades = [];
    const heatmap = {};

    for (const row of mainRows) {
      const zoned = DateTime.fromJSDate(row.timestamp).setZone(
        "America/Sao_Paulo",
        { keepLocalTime: true }
      );

      const horaChave = zoned
        .set({
          second: 0,
          millisecond: 0,
          minute: Math.floor(zoned.minute / 10) * 10,
        })
        .toFormat("HH:mm");

      const atividade = {
        ...row,
        timestamp: zoned.toFormat("yyyy-MM-dd HH:mm:ss"),
        custom_counts: customMap[row.id] || [],
        app_name: extrairAppName(row.window_title),
      };
      delete atividade.window_title;

      atividades.push(atividade);

      const soma =
        (row.right_clicks || 0) +
        (row.left_clicks || 0) +
        (row.scroll_up || 0) +
        (row.scroll_down || 0) +
        (row.total_keys || 0);

      if (!heatmap[horaChave]) heatmap[horaChave] = {};
      heatmap[horaChave][row.hostname] =
        (heatmap[horaChave][row.hostname] || 0) + soma;
    }

    res.status(200).json({ atividades, heatmap });
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
});

// Serve a página de dashboard
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "web", "dashboard.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
