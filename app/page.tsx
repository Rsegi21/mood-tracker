'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { UserCircle2, Cloud, HardDrive, AlertCircle } from 'lucide-react';
import { saveEntryLocal, getLocalEntries, DailyEntry, MoodType, EnergyType, saveEntryCloud, getCloudEntries, migrateLocalToCloud } from '@/lib/storage';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';

const MOODS: { type: MoodType; emoji: string; label: string; colorClass: string }[] = [
  { type: 'horrible', emoji: '😢', label: 'Horrible', colorClass: 'bg-error text-white shadow-sm' },
  { type: 'mal', emoji: '😞', label: 'Mal', colorClass: 'bg-tertiary text-white shadow-sm' },
  { type: 'normal', emoji: '😐', label: 'Normal', colorClass: 'bg-surface-container-high text-on-surface-variant border border-outline-variant' },
  { type: 'bien', emoji: '😊', label: 'Bien', colorClass: 'bg-secondary text-white shadow-sm' },
  { type: 'increible', emoji: '😄', label: 'Increíble', colorClass: 'bg-primary text-white shadow-sm' },
];

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function MoodTracker() {
  const [isMounted, setIsMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [entries, setEntries] = useState<Record<string, DailyEntry>>({});

  // Auth & Sync State
  const [user, setUser] = useState<User | null>(null);
  const [syncMode, setSyncMode] = useState<'local' | 'cloud' | 'error'>('local');
  const [syncErrorMsg, setSyncErrorMsg] = useState('');

  // Form State
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [note, setNote] = useState('');
  const [energy, setEnergy] = useState<EnergyType | null>(null);
  const [word, setWord] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize and track auth state
  useEffect(() => {
    setIsMounted(true);
    setEntries(getLocalEntries()); // Cargar local por defecto primero

    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          setSyncMode('cloud');
          setSyncErrorMsg('');
          try {
            // Migrar datos locales existentes a la nube si hay
            await migrateLocalToCloud(currentUser.uid);
            // Obtener todos los datos combinados de la nube
            const cloudData = await getCloudEntries(currentUser.uid);
            setEntries((prev) => ({ ...prev, ...cloudData }));
          } catch (e) {
            console.error("Error sincronizando con la nube:", e);
            setSyncMode('error');
            setSyncErrorMsg('Error al sincronizar con la nube.');
          }
        } else {
          setSyncMode('local');
          setEntries(getLocalEntries());
        }
      });
      return () => unsubscribe();
    } else {
      // Firebase no configurado
      setSyncMode('error');
      setSyncErrorMsg('Falta configuración de Firebase');
    }
  }, []);

  // Update form when selected date changes
  useEffect(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const entry = entries[dateStr];

    if (entry) {
      setSelectedMood(entry.emoji);
      setNote(entry.nota);
      setEnergy(entry.energia);
      setWord(entry.palabra);
    } else {
      setSelectedMood(null);
      setNote('');
      setEnergy(null);
      setWord('');
    }
  }, [selectedDate, entries]);

  const handleLogin = async () => {
    if (!auth) {
      alert("La configuración de Firebase está vacía. Añade tus credenciales en firebase-applet-config.json para probar la nube, ¡o sigue usando el modo local!");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      console.error(e);
      alert("Error al iniciar sesión: " + e.message);
    }
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMood || !energy) return;

    setIsSaving(true);

    const dateStr = selectedDate.toISOString().split('T')[0];
    const newEntry: DailyEntry = {
      emoji: selectedMood,
      nota: note,
      energia: energy,
      palabra: word,
      timestamp: Date.now(),
    };

    if (user) {
      try {
        await saveEntryCloud(user.uid, dateStr, newEntry);
        setEntries((prev) => ({ ...prev, [dateStr]: newEntry }));
        saveEntryLocal(dateStr, newEntry); // Mantener copia local de seguridad
        setSyncMode('cloud');
      } catch (e) {
        console.error("Error guardando en la nube:", e);
        saveEntryLocal(dateStr, newEntry);
        setEntries((prev) => ({ ...prev, [dateStr]: newEntry }));
        setSyncMode('error');
      }
    } else {
      saveEntryLocal(dateStr, newEntry);
      setEntries(getLocalEntries());
    }

    setTimeout(() => {
      setIsSaving(false);
    }, 600);
  };

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Monday start

  const renderCalendarDays = () => {
    const days = [];

    // Empty slots for previous month
    for (let i = 0; i < startOffset; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square rounded-xl bg-transparent"></div>);
    }

    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      const dateStr = date.toISOString().split('T')[0];
      const entry = entries[dateStr];
      const isSelected = selectedDate.toISOString().split('T')[0] === dateStr;
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      let buttonClass = "aspect-square rounded-xl flex flex-col items-center justify-center group transition-all hover:scale-105 active:scale-95 relative ";
      let textClass = "text-sm font-bold ";

      if (entry) {
        const moodConfig = MOODS.find(m => m.type === entry.emoji);
        buttonClass += moodConfig?.colorClass || 'bg-surface-container-high';
        textClass += entry.emoji === 'normal' ? 'text-on-surface-variant font-bold' : 'text-white font-bold';
      } else {
        buttonClass += "bg-surface-container-high border border-outline-variant hover:bg-surface-bright ";
        textClass += "text-on-surface-variant group-hover:text-on-surface";
      }

      if (isSelected && !entry) {
        buttonClass += " ring-2 ring-primary border-primary ";
      }

      days.push(
        <motion.button
          key={`day-${i}`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setSelectedDate(date)}
          className={buttonClass}
        >
          <span className={textClass}>{i}</span>
          {entry && (
            <span className="text-xs mt-1">{MOODS.find(m => m.type === entry.emoji)?.emoji}</span>
          )}
          {isToday && !entry && (
            <div className="w-1 h-1 rounded-full bg-primary mt-1 absolute bottom-2"></div>
          )}
        </motion.button>
      );
    }

    return days;
  };

  const formatDateHeader = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('es-ES', options).toUpperCase();
  };

  if (!isMounted) {
    return <div className="min-h-screen bg-background"></div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Header */}
      <header className="flex justify-between items-center w-full px-6 py-4 bg-[#1e293b] sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            {syncMode === 'cloud' && <Cloud className="w-5 h-5 text-white" />}
            {syncMode === 'local' && <HardDrive className="w-5 h-5 text-white" />}
            {syncMode === 'error' && <AlertCircle className="w-5 h-5 text-white" />}
          </div>
          <span className="text-2xl font-bold text-white tracking-tight font-headline">Mood Tracker</span>
        </div>

        <div className="flex items-center gap-6">
          {!user ? (
            <button
              onClick={handleLogin}
              className="hidden md:flex items-center gap-3 bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition-colors"
            >
              <span className="text-xs text-[#94a3b8] font-medium">Inicia sesión con Google para guardar tu historial</span>
              <div className="pl-4 border-l border-white/20">
                <span className="text-xs font-bold text-white">67 Conectar a la Nube</span>
              </div>
            </button>
          ) : (
            <div className="hidden md:flex items-center gap-3 bg-white/10 px-4 py-2 rounded-full">
              <span className="text-xs text-[#94a3b8] font-medium">Sincronizado vía Nube</span>
              <div className="flex items-center gap-2 pl-4 border-l border-white/20">
                <img
                  src={user.photoURL || "https://picsum.photos/seed/user/100/100"}
                  alt="Profile"
                  className="w-8 h-8 rounded-full bg-surface-variant object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-none text-white max-w-[100px] truncate">{user.displayName || "Usuario"}</span>
                  <button
                    onClick={handleLogout}
                    className="text-[10px] text-[#94a3b8] text-left uppercase tracking-wider font-bold hover:text-white mt-1"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 md:hidden">
            <button
              onClick={!user ? handleLogin : handleLogout}
              className="p-2 rounded-full hover:bg-white/10 transition-colors relative"
            >
              <UserCircle2 className="w-5 h-5 text-[#94a3b8]" />
              {user && <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full"></div>}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row min-h-0 p-6 lg:p-10 gap-8">
        {/* Left Side: Calendar */}
        <section className="flex-1 flex flex-col p-6 lg:p-8 bg-surface rounded-[16px] shadow-sm border border-outline-variant overflow-y-auto">
          <header className="mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold font-headline text-on-surface mb-2 tracking-tight capitalize">
                {MONTHS[currentMonth]} {currentYear}
              </h1>
              <p className="text-on-surface-variant font-body text-sm lg:text-base">Visualiza tu espectro emocional del mes.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))}
                className="p-2 rounded-full bg-surface-container-high hover:bg-surface-bright transition-colors text-on-surface-variant border border-outline-variant"
              >
                ←
              </button>
              <button
                onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))}
                className="p-2 rounded-full bg-surface-container-high hover:bg-surface-bright transition-colors text-on-surface-variant border border-outline-variant"
              >
                →
              </button>
            </div>
          </header>

          <div className="max-w-3xl mx-auto lg:mx-0">
            <div className="grid grid-cols-7 gap-2 lg:gap-4 mb-4">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                <div key={day} className="text-center text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2 lg:gap-4">
              {renderCalendarDays()}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-outline-variant/30 hidden md:block">
            {syncMode === 'local' && (
              <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-sm">
                <HardDrive className="w-5 h-5 flex-shrink-0" />
                <p><strong>Modo Local Activo:</strong> Tus registros de Firebase no están sincronizados. Inicia sesión para guardarlos en la nube de forma segura y permanente.</p>
              </div>
            )}
            {syncMode === 'error' && (
              <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p><strong>Configuración Pendiente:</strong> {syncErrorMsg} Se usarán datos locales temporalmente.</p>
              </div>
            )}
            {syncMode === 'cloud' && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                <Cloud className="w-5 h-5 flex-shrink-0" />
                <p><strong>Sincronización Activa:</strong> Todos tus datos están guardados de forma segura en Firestore.</p>
              </div>
            )}
          </div>
        </section>

        {/* Right Side: Form */}
        <section className="w-full lg:w-[450px] xl:w-[500px] bg-surface rounded-[16px] shadow-sm border border-outline-variant p-6 lg:p-8 overflow-y-auto">
          <div className="sticky top-0">
            <header className="flex justify-between items-start mb-10">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-tighter mb-1 block">
                  {formatDateHeader(selectedDate)}
                </span>
                <h2 className="text-2xl font-bold font-headline text-on-surface tracking-tight">
                  {entries[selectedDate.toISOString().split('T')[0]] ? 'Editar registro' : 'Registro de hoy'}
                </h2>
              </div>
            </header>

            <form onSubmit={handleSave} className="space-y-8">
              {/* Emoji Selector */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest block">
                  ¿Cómo te sientes?
                </label>
                <div className="flex justify-between items-center w-full bg-surface-container-high border border-outline-variant rounded-2xl p-2 sm:p-4 gap-1">
                  {MOODS.map((mood) => (
                    <motion.button
                      key={mood.type}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedMood(mood.type)}
                      className={`group flex-1 min-w-0 flex flex-col items-center justify-center gap-1 sm:gap-2 transition-all p-1 sm:p-2 rounded-xl ${selectedMood === mood.type
                          ? 'ring-2 ring-primary bg-primary/10 scale-105 sm:scale-110'
                          : 'hover:bg-surface-bright'
                        }`}
                    >
                      <span className={`text-2xl sm:text-3xl transition-all ${selectedMood === mood.type ? 'grayscale-0 opacity-100' : 'grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100'}`}>
                        {mood.emoji}
                      </span>
                      <span className={`text-[8px] sm:text-[10px] truncate max-w-full text-center font-bold uppercase ${selectedMood === mood.type ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {mood.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex justify-between">
                  <span>¿Qué ha pasado hoy?</span>
                  <span className="text-[10px] opacity-50">Opcional</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={150}
                  className="w-full bg-surface-container-high border border-outline-variant focus:border-primary focus:ring-1 text-on-surface font-body p-4 rounded-lg min-h-[120px] transition-all resize-none outline-none"
                  placeholder="Escribe aquí tus pensamientos..."
                />
                <div className="text-[10px] text-right text-on-surface-variant/40">
                  {note.length}/150 caracteres máx.
                </div>
              </div>

              {/* Energy Selector */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest block">
                  Nivel de Energía
                </label>
                <div className="flex p-1 bg-surface-container-high border border-outline-variant rounded-lg gap-1">
                  {(['baja', 'media', 'alta'] as EnergyType[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setEnergy(level)}
                      className={`flex-1 py-2 text-xs font-bold rounded-md transition-all capitalize ${energy === level
                          ? 'bg-surface shadow-sm text-on-surface border border-outline-variant'
                          : 'text-on-surface-variant hover:bg-surface-bright'
                        }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Short Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex justify-between">
                  <span>Una palabra para hoy</span>
                  <span className="text-[10px] opacity-50">Opcional</span>
                </label>
                <input
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  maxLength={30}
                  className="w-full bg-surface-container-high border border-outline-variant focus:border-primary focus:ring-1 text-on-surface font-body p-4 rounded-lg transition-all outline-none"
                  placeholder="P. ej: Gratitud"
                />
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={!selectedMood || !energy}
                whileHover={{ scale: (!selectedMood || !energy) ? 1 : 1.02 }}
                whileTap={{ scale: (!selectedMood || !energy) ? 1 : 0.95 }}
                animate={isSaving ? { scale: [1, 1.05, 1], backgroundColor: ['#2563eb', '#3b82f6', '#2563eb'] } : {}}
                className={`w-full py-4 font-bold font-headline text-sm rounded-lg transition-all shadow-sm ${(!selectedMood || !energy)
                    ? 'bg-surface-container-high text-on-surface-variant cursor-not-allowed border border-outline-variant'
                    : 'bg-primary hover:bg-primary-dim text-white'
                  }`}
              >
                {isSaving ? 'Guardado ✨' : 'Guardar Registro'}
              </motion.button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
