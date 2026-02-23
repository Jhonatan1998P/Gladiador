import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("game.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    ip TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    gold INTEGER DEFAULT 100,
    rubies INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    strength INTEGER DEFAULT 5,
    dexterity INTEGER DEFAULT 5,
    agility INTEGER DEFAULT 5,
    constitution INTEGER DEFAULT 5,
    charisma INTEGER DEFAULT 5,
    intelligence INTEGER DEFAULT 5,
    last_action_time INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    item_name TEXT,
    item_type TEXT,
    stat_bonus INTEGER,
    equipped BOOLEAN DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migration for existing databases
try {
  db.prepare("ALTER TABLE users ADD COLUMN dexterity INTEGER DEFAULT 5").run();
  db.prepare("ALTER TABLE users ADD COLUMN email TEXT").run();
  db.prepare("ALTER TABLE users ADD COLUMN password TEXT").run();
  db.prepare("ALTER TABLE users ADD COLUMN ip TEXT").run();
} catch (error) {
  // Column likely already exists
}

// Game Formulas
const calculateMaxHp = (level: number, constitution: number) => {
  const hpFromLevel = level * 25;
  const hpFromCon = constitution * 25 - 50;
  return hpFromLevel + hpFromCon;
};

const calculateExpNeeded = (level: number) => {
  if (level <= 52) {
    return 10 * (level + 1) - 15;
  } else {
    return 10 * level - 5;
  }
};

const calculateHitChance = (attackerDex: number, defenderAgi: number) => {
  const chance = (attackerDex / (attackerDex + defenderAgi)) * 100;
  return Math.floor(chance);
};

const calculateDoubleHitChance = (
  attackerCha: number,
  attackerDex: number,
  defenderInt: number,
  defenderAgi: number,
) => {
  const chance = ((attackerCha * attackerDex) / defenderInt / defenderAgi) * 10;
  return Math.floor(chance); // Assuming floor based on other formulas
};

const calculateCritChance = (attackerDex: number, attackerLevel: number) => {
  // Simplified from provided formula: (CritValue * 52 / (Level 8)) / 5
  // Assuming CritValue comes from items + (Dex/10)
  // For now, using a simplified version as we don't have full item stats yet
  const critValue = Math.floor(attackerDex / 10);
  // Note: The formula provided seems to have a typo "(Level 8)". Assuming it means Level or Level+8 or something.
  // "Nivel de personaje 8" might mean "Character Level * 8"? Or "Level - 8"?
  // Given "FLOOR.MATH(49.5*5*(Nivel de personaje-8)/52)+1", it likely means Level-8.
  // Let's stick to a simpler proxy for now until clarification or strict adherence.
  // Using: (CritValue * 52 / (Level)) / 5 for now.
  const chance = (critValue * 52) / Math.max(1, attackerLevel) / 5;
  return Math.min(50, Math.floor(chance));
};

const calculateDamage = (
  attackerStr: number,
  weaponMin: number = 2,
  weaponMax: number = 4,
) => {
  const bonus = Math.floor(attackerStr / 10);
  const min = weaponMin + bonus;
  const max = weaponMax + bonus;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Game Data
const expeditions = [
  {
    id: 1,
    name: "Bosque Oscuro",
    minLevel: 1,
    image: "forest",
    enemies: [
      { name: "Rata de Alcantarilla", chance: 40, isBoss: false, stats: { str: 5, dex: 5, agi: 5, con: 5, cha: 5, int: 5 } },
      { name: "Lobo Joven", chance: 30, isBoss: false, stats: { str: 7, dex: 6, agi: 6, con: 6, cha: 5, int: 5 } },
      { name: "Bandido Fugitivo", chance: 20, isBoss: false, stats: { str: 10, dex: 8, agi: 8, con: 8, cha: 6, int: 6 } },
      { name: "Líder de la Jauría", chance: 10, isBoss: true, stats: { str: 15, dex: 12, agi: 12, con: 15, cha: 10, int: 10 } },
    ],
  },
  {
    id: 2,
    name: "Puerto Pirata",
    minLevel: 5,
    image: "ocean",
    enemies: [
      { name: "Marinero Ebrio", chance: 40, isBoss: false, stats: { str: 12, dex: 10, agi: 10, con: 12, cha: 8, int: 8 } },
      { name: "Contramaestre Cruel", chance: 30, isBoss: false, stats: { str: 15, dex: 12, agi: 12, con: 15, cha: 10, int: 10 } },
      { name: "Pirata Veterano", chance: 20, isBoss: false, stats: { str: 20, dex: 15, agi: 15, con: 20, cha: 12, int: 12 } },
      { name: "Capitán Garfio Sangriento", chance: 10, isBoss: true, stats: { str: 30, dex: 25, agi: 25, con: 35, cha: 20, int: 20 } },
    ],
  },
  {
    id: 3,
    name: "Montañas Nubladas",
    minLevel: 10,
    image: "mountain",
    enemies: [
      { name: "Harpía Menor", chance: 40, isBoss: false, stats: { str: 25, dex: 20, agi: 25, con: 20, cha: 15, int: 15 } },
      { name: "Ogro de las Nieves", chance: 30, isBoss: false, stats: { str: 35, dex: 15, agi: 15, con: 40, cha: 10, int: 10 } },
      { name: "Grifo Salvaje", chance: 20, isBoss: false, stats: { str: 40, dex: 30, agi: 35, con: 35, cha: 20, int: 20 } },
      { name: "Rey de los Gigantes", chance: 10, isBoss: true, stats: { str: 60, dex: 40, agi: 30, con: 70, cha: 25, int: 25 } },
    ],
  },
  {
    id: 4,
    name: "Cueva del Dragón",
    minLevel: 15,
    image: "cave",
    enemies: [
      { name: "Cría de Dragón", chance: 40, isBoss: false, stats: { str: 45, dex: 35, agi: 35, con: 45, cha: 25, int: 25 } },
      { name: "Guardián de la Cueva", chance: 30, isBoss: false, stats: { str: 55, dex: 45, agi: 40, con: 55, cha: 30, int: 30 } },
      { name: "Dragón de Tierra", chance: 20, isBoss: false, stats: { str: 70, dex: 50, agi: 45, con: 80, cha: 35, int: 35 } },
      { name: "Gran Dragón Rojo", chance: 10, isBoss: true, stats: { str: 100, dex: 80, agi: 70, con: 120, cha: 50, int: 50 } },
    ],
  },
  {
    id: 5,
    name: "Pantano de las Almas",
    minLevel: 20,
    image: "swamp",
    enemies: [
      { name: "Fuego Fatuo", chance: 40, isBoss: false, stats: { str: 60, dex: 70, agi: 80, con: 50, cha: 40, int: 60 } },
      { name: "Caminante del Pantano", chance: 30, isBoss: false, stats: { str: 80, dex: 60, agi: 50, con: 90, cha: 30, int: 40 } },
      { name: "Hidra Joven", chance: 20, isBoss: false, stats: { str: 100, dex: 80, agi: 70, con: 110, cha: 50, int: 50 } },
      { name: "El Segador de Almas", chance: 10, isBoss: true, stats: { str: 130, dex: 110, agi: 100, con: 150, cha: 70, int: 90 } },
    ],
  },
  {
    id: 6,
    name: "Templo Maldito",
    minLevel: 25,
    image: "temple",
    enemies: [
      { name: "Sacerdote Oscuro", chance: 40, isBoss: false, stats: { str: 90, dex: 100, agi: 90, con: 100, cha: 80, int: 120 } },
      { name: "Gárgola de Piedra", chance: 30, isBoss: false, stats: { str: 120, dex: 80, agi: 70, con: 140, cha: 50, int: 60 } },
      { name: "Caballero de la Muerte", chance: 20, isBoss: false, stats: { str: 150, dex: 120, agi: 110, con: 160, cha: 90, int: 80 } },
      { name: "Avatar de la Oscuridad", chance: 10, isBoss: true, stats: { str: 200, dex: 180, agi: 160, con: 220, cha: 120, int: 150 } },
    ],
  },
  {
    id: 7,
    name: "Volcán Activo",
    minLevel: 30,
    image: "volcano",
    enemies: [
      { name: "Salamandra de Fuego", chance: 40, isBoss: false, stats: { str: 140, dex: 130, agi: 150, con: 140, cha: 100, int: 110 } },
      { name: "Gólem de Lava", chance: 30, isBoss: false, stats: { str: 180, dex: 100, agi: 80, con: 220, cha: 70, int: 80 } },
      { name: "Fénix Oscuro", chance: 20, isBoss: false, stats: { str: 160, dex: 180, agi: 200, con: 160, cha: 120, int: 150 } },
      { name: "Señor de las Llamas", chance: 10, isBoss: true, stats: { str: 250, dex: 220, agi: 200, con: 300, cha: 150, int: 180 } },
    ],
  },
  {
    id: 8,
    name: "Ciudadela de Hielo",
    minLevel: 35,
    image: "snow",
    enemies: [
      { name: "Lobo de Escarcha", chance: 40, isBoss: false, stats: { str: 180, dex: 170, agi: 190, con: 180, cha: 130, int: 140 } },
      { name: "Espectro de Hielo", chance: 30, isBoss: false, stats: { str: 200, dex: 220, agi: 210, con: 200, cha: 150, int: 180 } },
      { name: "Vermis de Nieve", chance: 20, isBoss: false, stats: { str: 240, dex: 200, agi: 180, con: 260, cha: 140, int: 130 } },
      { name: "Reina de las Nieves", chance: 10, isBoss: true, stats: { str: 320, dex: 300, agi: 280, con: 350, cha: 200, int: 250 } },
    ],
  },
  {
    id: 9,
    name: "Desierto Olvidado",
    minLevel: 40,
    image: "desert",
    enemies: [
      { name: "Escorpión Gigante", chance: 40, isBoss: false, stats: { str: 240, dex: 230, agi: 250, con: 240, cha: 170, int: 160 } },
      { name: "Momia Ancestral", chance: 30, isBoss: false, stats: { str: 260, dex: 250, agi: 240, con: 280, cha: 180, int: 200 } },
      { name: "Genio Malvado", chance: 20, isBoss: false, stats: { str: 280, dex: 300, agi: 320, con: 260, cha: 220, int: 280 } },
      { name: "Faraón Maldito", chance: 10, isBoss: true, stats: { str: 400, dex: 380, agi: 350, con: 450, cha: 250, int: 300 } },
    ],
  },
  {
    id: 10,
    name: "Inframundo",
    minLevel: 45,
    image: "fire",
    enemies: [
      { name: "Súcubo", chance: 40, isBoss: false, stats: { str: 320, dex: 350, agi: 380, con: 300, cha: 250, int: 300 } },
      { name: "Cerbero", chance: 30, isBoss: false, stats: { str: 380, dex: 320, agi: 340, con: 400, cha: 200, int: 220 } },
      { name: "Señor del Abismo", chance: 20, isBoss: false, stats: { str: 420, dex: 400, agi: 380, con: 450, cha: 280, int: 320 } },
      { name: "Lucifer", chance: 10, isBoss: true, stats: { str: 600, dex: 550, agi: 500, con: 700, cha: 400, int: 500 } },
    ],
  },
];

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  app.use(express.json());

  // Socket.io for real-time multiplayer features
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join_arena", (username) => {
      socket.join("arena");
      io.to("arena").emit(
        "arena_message",
        `${username} ha entrado a la arena.`,
      );
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // API Routes
  app.get("/api/expeditions", (req, res) => {
    res.json(expeditions);
  });

  app.get("/api/ranking", (req, res) => {
    const ranking = db
      .prepare(
        "SELECT username, level, exp, gold FROM users ORDER BY level DESC, exp DESC LIMIT 50",
      )
      .all();
    res.json(ranking);
  });

  app.post("/api/register", (req, res) => {
    const { username, email, password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    }

    // Check for multi-account by IP or Email
    const existingIp = db.prepare("SELECT id FROM users WHERE ip = ?").get(ip);
    if (existingIp) {
      return res
        .status(400)
        .json({ error: "Ya existe una cuenta registrada con esta IP." });
    }

    const existingEmail = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);
    if (existingEmail) {
      return res.status(400).json({ error: "Este correo ya está en uso." });
    }

    const existingUsername = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(username);
    if (existingUsername) {
      return res
        .status(400)
        .json({ error: "Este nombre de usuario ya está en uso." });
    }

    try {
      const stmt = db.prepare(
        "INSERT INTO users (username, email, password, ip) VALUES (?, ?, ?, ?)",
      );
      const info = stmt.run(username, email, password, ip);
      const user = db
        .prepare("SELECT * FROM users WHERE id = ?")
        .get(info.lastInsertRowid) as any;

      // Recalculate initial Max HP
      const maxHp = calculateMaxHp(user.level, user.constitution);
      db.prepare("UPDATE users SET max_hp = ?, hp = ? WHERE id = ?").run(
        maxHp,
        maxHp,
        user.id,
      );
      user.max_hp = maxHp;
      user.hp = maxHp;

      res.json({ message: "Registro exitoso. Ahora puedes iniciar sesión." });
    } catch (error) {
      res.status(500).json({ error: "Error al registrar la cuenta." });
    }
  });

  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Usuario y contraseña requeridos" });

    let user = db
      .prepare("SELECT * FROM users WHERE username = ? AND password = ?")
      .get(username, password) as any;
    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    res.json({ user });
  });

  app.get("/api/user/:username", (req, res) => {
    const user = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(req.params.username);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  });

  app.post("/api/action/expedition", (req, res) => {
    const { username, expeditionId } = req.body;
    const user = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username) as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    const expedition = expeditions.find((e) => e.id === expeditionId);
    if (!expedition)
      return res.status(404).json({ error: "Expedición no encontrada" });

    if (user.level < expedition.minLevel) {
      return res.status(400).json({
        error: `Necesitas ser nivel ${expedition.minLevel} para entrar aquí.`,
      });
    }

    const now = Date.now();
    const cooldown = 60000; // 1 minute
    if (now - user.last_action_time < cooldown) {
      const remaining = Math.ceil(
        (cooldown - (now - user.last_action_time)) / 1000,
      );
      return res
        .status(400)
        .json({ error: `Enfriamiento activo. Espera ${remaining} segundos.` });
    }

    if (user.hp <= 0) {
      return res
        .status(400)
        .json({ error: "No tienes vida para ir de expedición." });
    }

    // Pick enemy based on probability
    let random = Math.random() * 100;
    let cumulative = 0;
    let selectedEnemy = expedition.enemies[0];
    for (const enemy of expedition.enemies) {
      cumulative += enemy.chance;
      if (random <= cumulative) {
        selectedEnemy = enemy;
        break;
      }
    }

    const monsterLevel = expedition.minLevel + (selectedEnemy.isBoss ? 2 : 0);
    const monster = {
      name: selectedEnemy.name,
      level: monsterLevel,
      hp: calculateMaxHp(monsterLevel, selectedEnemy.stats.con),
      strength: selectedEnemy.stats.str,
      dexterity: selectedEnemy.stats.dex,
      agility: selectedEnemy.stats.agi,
      constitution: selectedEnemy.stats.con,
      charisma: selectedEnemy.stats.cha,
      intelligence: selectedEnemy.stats.int,
      isBoss: selectedEnemy.isBoss,
    };

    // Combat Simulation (Gladiatus-like)
    let playerHp = user.hp;
    let monsterHp = monster.hp;
    let rounds = 0;
    const maxRounds = 20;

    while (playerHp > 0 && monsterHp > 0 && rounds < maxRounds) {
      rounds++;

      // Player turn
      const pAttacks =
        Math.random() * 100 <
        calculateDoubleHitChance(
          user.charisma,
          user.dexterity,
          monster.intelligence,
          monster.agility,
        )
          ? 2
          : 1;
      for (let i = 0; i < pAttacks; i++) {
        const pHitChance = calculateHitChance(user.dexterity, monster.agility);
        if (Math.random() * 100 < pHitChance) {
          let damage = calculateDamage(user.strength);
          if (
            Math.random() * 100 <
            calculateCritChance(user.dexterity, user.level)
          ) {
            damage *= 2;
          }
          monsterHp -= damage;
        }
        if (monsterHp <= 0) break;
      }

      if (monsterHp <= 0) break;

      // Monster turn
      const mAttacks =
        Math.random() * 100 <
        calculateDoubleHitChance(
          monster.charisma,
          monster.dexterity,
          user.intelligence,
          user.agility,
        )
          ? 2
          : 1;
      for (let i = 0; i < mAttacks; i++) {
        const mHitChance = calculateHitChance(monster.dexterity, user.agility);
        if (Math.random() * 100 < mHitChance) {
          let damage = calculateDamage(monster.strength);
          if (
            Math.random() * 100 <
            calculateCritChance(monster.dexterity, monster.level)
          ) {
            damage *= 2;
          }
          playerHp -= damage;
        }
        if (playerHp <= 0) break;
      }
    }

    const won = playerHp > 0 && monsterHp <= 0;
    let goldGained = 0;
    let expGained = 0;

    if (won) {
      const multiplier = monster.isBoss ? 5 : 2;
      goldGained =
        Math.floor(Math.random() * 10 * monster.level) +
        monster.strength * multiplier;
      expGained =
        Math.floor(Math.random() * 5 * monster.level) +
        (monster.isBoss ? 20 : 5);
    } else {
      playerHp = Math.max(0, playerHp);
    }

    let newHp = playerHp;
    let newExp = user.exp + expGained;
    let newLevel = user.level;
    let expNeeded = calculateExpNeeded(user.level);

    if (newExp >= expNeeded) {
      newLevel++;
      newExp -= expNeeded;
      const newMaxHp = calculateMaxHp(newLevel, user.constitution);
      db.prepare("UPDATE users SET max_hp = ? WHERE id = ?").run(
        newMaxHp,
        user.id,
      );
      newHp = newMaxHp;
    }

    db.prepare(
      `
      UPDATE users 
      SET hp = ?, gold = gold + ?, exp = ?, level = ?, last_action_time = ?
      WHERE id = ?
    `,
    ).run(newHp, goldGained, newExp, newLevel, now, user.id);

    const updatedUser = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(user.id);

    res.json({
      message: won
        ? `¡Victoria! Venciste al ${monster.name} (Nvl ${monster.level}). Ganaste ${goldGained} Oro y ${expGained} EXP.`
        : `Derrota... El ${monster.name} (Nvl ${monster.level}) era demasiado fuerte.`,
      user: updatedUser,
    });
  });

  app.get("/api/arena/opponents/:username", (req, res) => {
    const opponents = db
      .prepare(
        "SELECT username, level, hp, max_hp, strength, dexterity, agility, constitution, charisma, intelligence FROM users WHERE username != ? ORDER BY RANDOM() LIMIT 5",
      )
      .all(req.params.username);
    res.json(opponents);
  });

  app.post("/api/action/arena", (req, res) => {
    const { username, opponentName } = req.body;
    const user = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username) as any;
    const opponent = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(opponentName) as any;

    if (!user || !opponent)
      return res
        .status(404)
        .json({ error: "Usuario u oponente no encontrado" });

    if (user.hp <= 10) {
      return res
        .status(400)
        .json({ error: "Necesitas al menos 10 HP para luchar en la arena." });
    }

    // Combat Simulation
    let playerHp = user.hp;
    let opponentHp = opponent.hp;
    let rounds = 0;
    const maxRounds = 20;

    while (playerHp > 0 && opponentHp > 0 && rounds < maxRounds) {
      rounds++;

      // Player turn
      const pAttacks =
        Math.random() * 100 <
        calculateDoubleHitChance(
          user.charisma,
          user.dexterity,
          opponent.intelligence,
          opponent.agility,
        )
          ? 2
          : 1;
      for (let i = 0; i < pAttacks; i++) {
        const pHitChance = calculateHitChance(user.dexterity, opponent.agility);
        if (Math.random() * 100 < pHitChance) {
          let damage = calculateDamage(user.strength);
          if (
            Math.random() * 100 <
            calculateCritChance(user.dexterity, user.level)
          ) {
            damage *= 2;
          }
          opponentHp -= damage;
        }
        if (opponentHp <= 0) break;
      }

      if (opponentHp <= 0) break;

      // Opponent turn
      const oAttacks =
        Math.random() * 100 <
        calculateDoubleHitChance(
          opponent.charisma,
          opponent.dexterity,
          user.intelligence,
          user.agility,
        )
          ? 2
          : 1;
      for (let i = 0; i < oAttacks; i++) {
        const oHitChance = calculateHitChance(opponent.dexterity, user.agility);
        if (Math.random() * 100 < oHitChance) {
          let damage = calculateDamage(opponent.strength);
          if (
            Math.random() * 100 <
            calculateCritChance(opponent.dexterity, opponent.level)
          ) {
            damage *= 2;
          }
          playerHp -= damage;
        }
        if (playerHp <= 0) break;
      }
    }

    const won = playerHp > 0 && opponentHp <= 0;
    let goldGained = 0;
    let expGained = 0;

    if (won) {
      goldGained = Math.floor(opponent.gold * 0.1); // Steal 10% of gold
      expGained = Math.max(1, Math.floor(opponent.level / 2));
      db.prepare("UPDATE users SET gold = gold - ? WHERE id = ?").run(
        goldGained,
        opponent.id,
      );
    }

    db.prepare(
      "UPDATE users SET hp = ?, gold = gold + ?, exp = exp + ? WHERE id = ?",
    ).run(Math.max(0, playerHp), goldGained, expGained, user.id);

    const updatedUser = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(user.id);

    res.json({
      message: won
        ? `¡Victoria en la Arena! Venciste a ${opponent.username}. Robaste ${goldGained} Oro y ganaste ${expGained} EXP.`
        : `Derrota en la Arena... ${opponent.username} fue superior.`,
      user: updatedUser,
    });
  });

  app.post("/api/action/heal", (req, res) => {
    const { username } = req.body;
    const user = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username) as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    const healCost = 20;
    if (user.gold < healCost) {
      return res.status(400).json({ error: "No tienes suficiente oro." });
    }

    if (user.hp >= user.max_hp) {
      return res.status(400).json({ error: "Ya tienes la vida al máximo." });
    }

    db.prepare(
      "UPDATE users SET hp = max_hp, gold = gold - ? WHERE id = ?",
    ).run(healCost, user.id);
    const updatedUser = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(user.id);

    res.json({ message: "Te has curado por completo.", user: updatedUser });
  });

  app.post("/api/action/train", (req, res) => {
    const { username, stat } = req.body;
    const user = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username) as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    const validStats = [
      "strength",
      "dexterity",
      "agility",
      "constitution",
      "charisma",
      "intelligence",
    ];
    if (!validStats.includes(stat))
      return res.status(400).json({ error: "Stat inválido" });

    const currentStatValue = user[stat];

    // Max Stat Cap: Level * 5 (Level 1-40 cap is 200, but 40*5=200 so it matches)
    const maxStat = user.level * 5;
    // Actually, user text says: "Estadísticas máximas a través del entrenamiento = Nivel de personaje * 5"
    // So we check if currentStatValue < maxStat

    // However, for low levels, 5 might be too low if they start at 5.
    // Let's assume the cap is for "Trained" stats, i.e., base + trained.
    // If they start at 5, and level 1 cap is 5, they can't train.
    // Let's assume a minimum cap of 10 or just strictly follow the rule?
    // "del nivel 1 al 40 el límite es 200" -> This implies the cap is 200 for levels 1-40?
    // "Example: Level 115 * 5 = 575".
    // So for Level 1, cap is 200?

    let statCap = user.level * 5;
    if (user.level <= 40) statCap = 200;

    if (currentStatValue >= statCap) {
      return res
        .status(400)
        .json({
          error: `Has alcanzado el límite de entrenamiento para tu nivel (${statCap}).`,
        });
    }

    const cost = currentStatValue * 10;

    if (user.gold < cost) {
      return res.status(400).json({ error: "No tienes suficiente oro." });
    }

    db.prepare(
      `UPDATE users SET ${stat} = ${stat} + 1, gold = gold - ? WHERE id = ?`,
    ).run(cost, user.id);

    // If constitution increases, max_hp increases
    if (stat === "constitution") {
      const newMaxHp = calculateMaxHp(user.level, user.constitution + 1);
      db.prepare("UPDATE users SET max_hp = ?, hp = hp + ? WHERE id = ?").run(
        newMaxHp,
        25,
        user.id,
      ); // +25 HP per Con point roughly
    }

    const updatedUser = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(user.id);
    res.json({ message: `Has entrenado ${stat}.`, user: updatedUser });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
