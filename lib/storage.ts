import { db } from './firebase';
import { doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';

export type MoodType = 'increible' | 'bien' | 'normal' | 'mal' | 'horrible';
export type EnergyType = 'baja' | 'media' | 'alta';

export interface DailyEntry {
  emoji: MoodType;
  nota: string;
  energia: EnergyType;
  palabra: string;
  timestamp: number;
}

export const saveEntryLocal = (dateStr: string, entry: DailyEntry) => {
  if (typeof window === 'undefined') return;
  const currentData = getLocalEntries();
  currentData[dateStr] = entry;
  localStorage.setItem('mood_tracker_entries', JSON.stringify(currentData));
};

export const getLocalEntries = (): Record<string, DailyEntry> => {
  if (typeof window === 'undefined') return {};
  const data = localStorage.getItem('mood_tracker_entries');
  return data ? JSON.parse(data) : {};
};

// ========================
// Integración con Firebase
// ========================

export const saveEntryCloud = async (userId: string, dateStr: string, entry: DailyEntry) => {
  if (!db) throw new Error("Firebase no está configurado.");
  const docRef = doc(db, `usuarios/${userId}/moods/${dateStr}`);
  await setDoc(docRef, entry);
};

export const getCloudEntries = async (userId: string): Promise<Record<string, DailyEntry>> => {
  if (!db) return {};
  try {
    const querySnapshot = await getDocs(collection(db, `usuarios/${userId}/moods`));
    const entries: Record<string, DailyEntry> = {};
    querySnapshot.forEach((doc) => {
      entries[doc.id] = doc.data() as DailyEntry;
    });
    return entries;
  } catch (err) {
    console.error("Error obteniendo datos de la nube:", err);
    return {};
  }
};

export const migrateLocalToCloud = async (userId: string) => {
  if (!db) return;
  const localData = getLocalEntries();
  const keys = Object.keys(localData);
  if (keys.length === 0) return;

  try {
    const batch = writeBatch(db);
    for (const dateStr of keys) {
      const docRef = doc(db, `usuarios/${userId}/moods/${dateStr}`);
      batch.set(docRef, localData[dateStr], { merge: true });
    }
    await batch.commit();
    // Los datos locales se conservan como caché
  } catch (err) {
    console.error("Error en la migración a la nube:", err);
    throw err;
  }
};
