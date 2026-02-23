import React, { useState, useEffect } from "react";
import { User } from "./types";
import {
  Shield,
  Swords,
  Activity,
  Brain,
  Heart,
  Coins,
  Gem,
  Zap,
  ActivitySquare,
  Dumbbell,
  Map,
  Trophy,
} from "lucide-react";
import { io } from "socket.io-client";

const socket = io();

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [expeditions, setExpeditions] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [opponents, setOpponents] = useState<any[]>([]);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    let timer: any;
    if (cooldownRemaining > 0) {
      timer = setInterval(() => {
        setCooldownRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const fetchOpponents = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/arena/opponents/${user.username}`);
      const data = await res.json();
      setOpponents(data);
    } catch (error) {
      console.error("Error fetching opponents:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "arena") {
      fetchOpponents();
    }
    if (activeTab === "ranking") {
      fetchRanking();
    }
  }, [activeTab]);
  const [arenaMessages, setArenaMessages] = useState<string[]>([]);

  useEffect(() => {
    const savedUsername = localStorage.getItem("gladiatus_username");
    const savedPassword = localStorage.getItem("gladiatus_password");
    if (savedUsername && savedPassword) {
      login(savedUsername, savedPassword);
    }
    fetchExpeditions();
    fetchRanking();

    socket.on("arena_message", (msg) => {
      setArenaMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("arena_message");
    };
  }, []);

  const fetchRanking = async () => {
    try {
      const res = await fetch("/api/ranking");
      const data = await res.json();
      setRanking(data);
    } catch (error) {
      console.error("Error fetching ranking:", error);
    }
  };

  const fetchExpeditions = async () => {
    try {
      const res = await fetch("/api/expeditions");
      const data = await res.json();
      setExpeditions(data);
    } catch (error) {
      console.error("Error fetching expeditions:", error);
    }
  };

  const login = async (username: string, password?: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        localStorage.setItem("gladiatus_username", username);
        localStorage.setItem("gladiatus_password", password || "");
        socket.emit("join_arena", username);
        setMessage("");
      } else if (data.error) {
        setMessage(data.error);
      }
    } catch (error) {
      console.error("Error logging in:", error);
      setMessage("Error de conexión.");
    }
    setIsLoading(false);
  };

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameInput,
          email: emailInput,
          password: passwordInput,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
      } else {
        setMessage(data.message);
        setIsRegistering(false);
      }
    } catch (error) {
      console.error("Error registering:", error);
      setMessage("Error de conexión.");
    }
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("gladiatus_username");
    localStorage.removeItem("gladiatus_password");
  };

  const handleAction = async (action: string, payload: any = {}) => {
    if (!user) return;
    setIsLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/action/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, ...payload }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
      } else {
        if (data.message) setMessage(data.message);
        if (data.user) {
          setUser(data.user);
          if (action === "expedition") {
            setCooldownRemaining(60);
          }
        }
      }
    } catch (error) {
      console.error("Action error:", error);
      setMessage("Error de conexión.");
    }
    setIsLoading(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4 font-serif">
        <div className="bg-stone-800 p-8 rounded-xl shadow-2xl border border-stone-700 max-w-md w-full text-center">
          <h1 className="text-4xl font-bold text-amber-500 mb-2 tracking-wider">
            GLADIATOR
          </h1>
          <p className="text-stone-400 mb-8 italic">
            Entra a la arena y forja tu leyenda
          </p>

          {message && (
            <div className="bg-stone-900 border border-amber-500 text-amber-500 p-3 mb-6 rounded text-sm">
              {message}
            </div>
          )}

          {isRegistering ? (
            <form onSubmit={register} className="space-y-4">
              <input
                type="text"
                placeholder="Nombre de tu Gladiador"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 text-stone-200 px-4 py-3 rounded focus:outline-none focus:border-amber-500 transition-colors"
                required
              />
              <input
                type="email"
                placeholder="Correo Electrónico"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 text-stone-200 px-4 py-3 rounded focus:outline-none focus:border-amber-500 transition-colors"
                required
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 text-stone-200 px-4 py-3 rounded focus:outline-none focus:border-amber-500 transition-colors"
                required
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50"
              >
                {isLoading ? "Registrando..." : "Registrarse"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(false);
                  setMessage("");
                }}
                className="text-stone-400 hover:text-stone-300 text-sm mt-4 underline"
              >
                ¿Ya tienes cuenta? Inicia sesión
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                login(usernameInput, passwordInput);
              }}
              className="space-y-4"
            >
              <input
                type="text"
                placeholder="Nombre de tu Gladiador"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 text-stone-200 px-4 py-3 rounded focus:outline-none focus:border-amber-500 transition-colors"
                required
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 text-stone-200 px-4 py-3 rounded focus:outline-none focus:border-amber-500 transition-colors"
                required
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50"
              >
                {isLoading ? "Entrando..." : "Jugar Ahora"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(true);
                  setMessage("");
                }}
                className="text-stone-400 hover:text-stone-300 text-sm mt-4 underline"
              >
                ¿No tienes cuenta? Regístrate
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const calculateExpNeeded = (level: number) => {
    if (level <= 52) {
      return 10 * (level + 1) - 15;
    } else {
      return 10 * level - 5;
    }
  };

  const expNeeded = calculateExpNeeded(user.level);
  const expPercent = Math.min(100, (user.exp / expNeeded) * 100);
  const hpPercent = Math.min(100, (user.hp / user.max_hp) * 100);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-300 font-sans">
      {/* Header */}
      <header className="bg-stone-900 border-b border-stone-800 p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-serif font-bold text-amber-500 tracking-widest uppercase">
              Gladiator
            </h1>
            <div className="hidden sm:block h-8 w-px bg-stone-700"></div>
            <div className="text-lg font-bold text-stone-100">
              {user.username}{" "}
              <span className="text-stone-500 text-sm font-normal">
                Nivel {user.level}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2" title="Oro">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="font-mono font-bold text-yellow-400">
                {user.gold}
              </span>
            </div>
            <div className="flex items-center gap-2" title="Rubíes">
              <Gem className="w-5 h-5 text-red-500" />
              <span className="font-mono font-bold text-red-400">
                {user.rubies}
              </span>
            </div>

            <div className="flex flex-col gap-1 w-32 sm:w-48">
              <div className="flex justify-between text-xs">
                <span className="text-red-400 flex items-center gap-1">
                  <Heart className="w-3 h-3" /> {user.hp}/{user.max_hp}
                </span>
              </div>
              <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-all duration-500"
                  style={{ width: `${hpPercent}%` }}
                ></div>
              </div>
            </div>

            <div className="flex flex-col gap-1 w-32 sm:w-48">
              <div className="flex justify-between text-xs">
                <span className="text-blue-400 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> EXP: {user.exp}/{expNeeded}
                </span>
              </div>
              <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${expPercent}%` }}
                ></div>
              </div>
            </div>

            <button
              onClick={logout}
              className="text-stone-500 hover:text-stone-300 text-xs uppercase tracking-wider"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 md:grid-cols-4 gap-6 mt-4">
        {/* Sidebar Navigation */}
        <aside className="md:col-span-1 space-y-2">
          <nav className="bg-stone-900 rounded-lg border border-stone-800 overflow-hidden">
            <button
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeTab === "overview" ? "bg-stone-800 text-amber-500 border-l-4 border-amber-500" : "hover:bg-stone-800/50 border-l-4 border-transparent"}`}
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium">Visión General</span>
            </button>
            <button
              onClick={() => setActiveTab("training")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeTab === "training" ? "bg-stone-800 text-amber-500 border-l-4 border-amber-500" : "hover:bg-stone-800/50 border-l-4 border-transparent"}`}
            >
              <Dumbbell className="w-5 h-5" />
              <span className="font-medium">Entrenamiento</span>
            </button>
            <button
              onClick={() => setActiveTab("expedition")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeTab === "expedition" ? "bg-stone-800 text-amber-500 border-l-4 border-amber-500" : "hover:bg-stone-800/50 border-l-4 border-transparent"}`}
            >
              <Map className="w-5 h-5" />
              <span className="font-medium">Expedición</span>
            </button>
            <button
              onClick={() => setActiveTab("arena")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeTab === "arena" ? "bg-stone-800 text-amber-500 border-l-4 border-amber-500" : "hover:bg-stone-800/50 border-l-4 border-transparent"}`}
            >
              <Swords className="w-5 h-5" />
              <span className="font-medium">Arena</span>
            </button>
            <button
              onClick={() => setActiveTab("ranking")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeTab === "ranking" ? "bg-stone-800 text-amber-500 border-l-4 border-amber-500" : "hover:bg-stone-800/50 border-l-4 border-transparent"}`}
            >
              <Trophy className="w-5 h-5" />
              <span className="font-medium">Clasificación</span>
            </button>
          </nav>

          <div className="bg-stone-900 rounded-lg border border-stone-800 p-4 mt-4">
            <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-3">
              Acciones Rápidas
            </h3>
            <button
              onClick={() => handleAction("heal")}
              disabled={isLoading || user.hp >= user.max_hp || user.gold < 20}
              className="w-full flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 text-stone-300 py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Heart className="w-4 h-4 text-red-400" />
              Curar (20 Oro)
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <section className="md:col-span-3">
          {message && (
            <div className="bg-stone-800 border-l-4 border-amber-500 text-stone-200 p-4 mb-6 rounded shadow-lg flex items-start justify-between">
              <p>{message}</p>
              <button
                onClick={() => setMessage("")}
                className="text-stone-500 hover:text-stone-300"
              >
                &times;
              </button>
            </div>
          )}

          {activeTab === "overview" && (
            <div className="bg-stone-900 rounded-lg border border-stone-800 p-6">
              <h2 className="text-2xl font-serif text-stone-100 mb-6 border-b border-stone-800 pb-2">
                Estadísticas del Gladiador
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-stone-950 rounded border border-stone-800">
                    <div className="flex items-center gap-3">
                      <Swords className="w-5 h-5 text-stone-400" />
                      <span className="font-medium">Fuerza</span>
                    </div>
                    <span className="font-mono text-lg text-amber-500">
                      {user.strength}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-stone-950 rounded border border-stone-800">
                    <div className="flex items-center gap-3">
                      <Activity className="w-5 h-5 text-stone-400" />
                      <span className="font-medium">Destreza</span>
                    </div>
                    <span className="font-mono text-lg text-amber-500">
                      {user.dexterity}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-stone-950 rounded border border-stone-800">
                    <div className="flex items-center gap-3">
                      <ActivitySquare className="w-5 h-5 text-stone-400" />
                      <span className="font-medium">Agilidad</span>
                    </div>
                    <span className="font-mono text-lg text-amber-500">
                      {user.agility}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-stone-950 rounded border border-stone-800">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-stone-400" />
                      <span className="font-medium">Constitución</span>
                    </div>
                    <span className="font-mono text-lg text-amber-500">
                      {user.constitution}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-stone-950 rounded border border-stone-800">
                    <div className="flex items-center gap-3">
                      <Heart className="w-5 h-5 text-stone-400" />
                      <span className="font-medium">Carisma</span>
                    </div>
                    <span className="font-mono text-lg text-amber-500">
                      {user.charisma}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-stone-950 rounded border border-stone-800">
                    <div className="flex items-center gap-3">
                      <Brain className="w-5 h-5 text-stone-400" />
                      <span className="font-medium">Inteligencia</span>
                    </div>
                    <span className="font-mono text-lg text-amber-500">
                      {user.intelligence}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "training" && (
            <div className="bg-stone-900 rounded-lg border border-stone-800 p-6">
              <h2 className="text-2xl font-serif text-stone-100 mb-2">
                Entrenamiento
              </h2>
              <p className="text-stone-400 mb-6 pb-4 border-b border-stone-800">
                Mejora tus atributos con oro. Cada nivel cuesta más.
              </p>

              <div className="space-y-3">
                {[
                  {
                    id: "strength",
                    name: "Fuerza",
                    icon: Swords,
                    desc: "Aumenta tu daño base.",
                  },
                  {
                    id: "dexterity",
                    name: "Destreza",
                    icon: Activity,
                    desc: "Aumenta tu probabilidad de golpear y crítico.",
                  },
                  {
                    id: "agility",
                    name: "Agilidad",
                    icon: ActivitySquare,
                    desc: "Aumenta tu probabilidad de esquivar.",
                  },
                  {
                    id: "constitution",
                    name: "Constitución",
                    icon: Shield,
                    desc: "Aumenta tu vida máxima (+25 HP por punto).",
                  },
                  {
                    id: "charisma",
                    name: "Carisma",
                    icon: Heart,
                    desc: "Aumenta la probabilidad de golpear dos veces.",
                  },
                  {
                    id: "intelligence",
                    name: "Inteligencia",
                    icon: Brain,
                    desc: "Aumenta la curación y resistencia mágica.",
                  },
                ].map((stat) => {
                  const currentVal = user[stat.id as keyof User] as number;
                  const cost = currentVal * 10;
                  const canAfford = user.gold >= cost;

                  return (
                    <div
                      key={stat.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-stone-950 rounded border border-stone-800 gap-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-stone-900 rounded-lg">
                          <stat.icon className="w-6 h-6 text-stone-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-stone-200">
                              {stat.name}
                            </h3>
                            <span className="text-xs font-mono bg-stone-800 px-2 py-0.5 rounded text-amber-500">
                              Nvl {currentVal}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 mt-1">
                            {stat.desc}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAction("train", { stat: stat.id })}
                        disabled={isLoading || !canAfford}
                        className={`shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded font-medium transition-colors ${canAfford ? "bg-stone-800 hover:bg-stone-700 text-stone-200" : "bg-stone-900 text-stone-600 cursor-not-allowed border border-stone-800"}`}
                      >
                        Entrenar
                        <span
                          className={`flex items-center gap-1 text-sm font-mono ${canAfford ? "text-yellow-500" : "text-stone-600"}`}
                        >
                          <Coins className="w-3 h-3" /> {cost}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "expedition" && (
            <div className="bg-stone-900 rounded-lg border border-stone-800 p-6">
              <h2 className="text-2xl font-serif text-stone-100 mb-2">
                Expedición
              </h2>
              <p className="text-stone-400 mb-6 pb-4 border-b border-stone-800">
                Aventúrate en lo salvaje para ganar experiencia y oro.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {expeditions.map((exp) => (
                  <div
                    key={exp.id}
                    className={`bg-stone-950 border border-stone-800 rounded-lg overflow-hidden group ${user.level < exp.minLevel ? "opacity-75 grayscale" : ""}`}
                  >
                    <div className="h-32 bg-stone-800 relative overflow-hidden">
                      <img
                        src={`https://picsum.photos/seed/${exp.image}/400/200?blur=2`}
                        alt={exp.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity duration-500"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <h3 className="text-xl font-serif font-bold text-white drop-shadow-lg text-center px-2">
                          {exp.name}
                        </h3>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-stone-400">
                            Nivel {exp.minLevel}+
                          </span>
                        </div>
                        <div className="space-y-1">
                          {exp.enemies?.map((enemy: any, idx: number) => (
                            <div
                              key={idx}
                              className={`text-[10px] flex justify-between items-center px-2 py-1 rounded ${enemy.isBoss ? "bg-amber-900/30 text-amber-500 border border-amber-800/50" : "bg-stone-900 text-stone-500"}`}
                            >
                              <span>
                                {enemy.name} {enemy.isBoss && "(BOSS)"}
                              </span>
                              <span>{enemy.chance}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          handleAction("expedition", { expeditionId: exp.id })
                        }
                        disabled={
                          isLoading ||
                          user.hp <= 0 ||
                          user.level < exp.minLevel ||
                          cooldownRemaining > 0
                        }
                        className={`w-full font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 ${
                          user.level >= exp.minLevel
                            ? "bg-amber-700 hover:bg-amber-600 text-white"
                            : "bg-stone-800 text-stone-500 cursor-not-allowed"
                        }`}
                      >
                        {cooldownRemaining > 0
                          ? `Espera ${cooldownRemaining}s`
                          : user.level >= exp.minLevel
                            ? "Explorar"
                            : "Bloqueado"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "arena" && (
            <div className="bg-stone-900 rounded-lg border border-stone-800 p-6">
              <div className="flex items-center gap-3 mb-6 border-b border-stone-800 pb-4">
                <Swords className="w-8 h-8 text-amber-500" />
                <div>
                  <h2 className="text-2xl font-serif text-stone-100">
                    La Arena
                  </h2>
                  <p className="text-stone-400 text-sm">
                    Desafía a otros gladiadores por oro y gloria
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 mb-8">
                <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest">
                  Oponentes Disponibles
                </h3>
                {opponents.length === 0 ? (
                  <p className="text-stone-600 italic">
                    Buscando oponentes dignos...
                  </p>
                ) : (
                  opponents.map((opp) => (
                    <div
                      key={opp.username}
                      className="bg-stone-950 border border-stone-800 p-4 rounded-lg flex items-center justify-between group hover:border-amber-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-stone-800 rounded-full flex items-center justify-center border border-stone-700">
                          <Shield className="w-6 h-6 text-stone-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-200">
                            {opp.username}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-stone-500">
                            <span className="text-amber-500 font-mono">
                              Nvl {opp.level}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3 text-red-500" />{" "}
                              {opp.hp}/{opp.max_hp}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          handleAction("arena", { opponentName: opp.username })
                        }
                        disabled={isLoading || user.hp <= 10}
                        className="bg-amber-900/20 hover:bg-amber-700 text-amber-500 hover:text-white border border-amber-900/50 px-4 py-2 rounded transition-all font-bold text-sm"
                      >
                        Desafiar
                      </button>
                    </div>
                  ))
                )}
                <button
                  onClick={fetchOpponents}
                  className="text-xs text-stone-500 hover:text-stone-300 underline text-center mt-2"
                >
                  Actualizar lista
                </button>
              </div>

              <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 h-48 overflow-y-auto mb-4 font-mono text-xs">
                <h3 className="text-[10px] font-bold text-stone-600 uppercase mb-2 sticky top-0 bg-stone-950 pb-1">
                  Registro de Actividad
                </h3>
                {arenaMessages.length === 0 ? (
                  <p className="text-stone-700 italic">
                    La arena está en silencio...
                  </p>
                ) : (
                  arenaMessages.map((msg, i) => (
                    <div
                      key={i}
                      className="text-stone-400 mb-1 border-b border-stone-800/30 pb-1"
                    >
                      <span className="text-amber-700 mr-2">
                        [{new Date().toLocaleTimeString()}]
                      </span>
                      {msg}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "ranking" && (
            <div className="bg-stone-900 rounded-lg border border-stone-800 p-6">
              <div className="flex items-center gap-3 mb-6 border-b border-stone-800 pb-4">
                <Trophy className="w-8 h-8 text-amber-500" />
                <div>
                  <h2 className="text-2xl font-serif text-stone-100">
                    Clasificación
                  </h2>
                  <p className="text-stone-400 text-sm">
                    Los mejores gladiadores del imperio
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-800 text-stone-400 text-sm uppercase tracking-wider">
                      <th className="p-3 font-medium">#</th>
                      <th className="p-3 font-medium">Nombre</th>
                      <th className="p-3 font-medium">Nivel</th>
                      <th className="p-3 font-medium">Experiencia</th>
                      <th className="p-3 font-medium">Oro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((player, index) => (
                      <tr
                        key={index}
                        className={`border-b border-stone-800/50 hover:bg-stone-800/30 transition-colors ${player.username === user.username ? "bg-stone-800/50" : ""}`}
                      >
                        <td className="p-3 font-mono text-stone-500">
                          {index + 1}
                        </td>
                        <td
                          className={`p-3 font-bold ${index === 0 ? "text-yellow-500" : index === 1 ? "text-stone-300" : index === 2 ? "text-amber-700" : "text-stone-200"}`}
                        >
                          {player.username}
                        </td>
                        <td className="p-3 font-mono text-amber-500">
                          {player.level}
                        </td>
                        <td className="p-3 font-mono text-blue-400">
                          {player.exp}
                        </td>
                        <td className="p-3 font-mono text-yellow-400">
                          {player.gold}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
