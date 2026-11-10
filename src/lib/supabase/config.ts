// Lee de .env.local la dirección y la clave pública de Supabase.
// Nunca se escriben las claves en el código: solo se leen de aquí.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !clave) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local",
  );
}

export const SUPABASE_URL: string = url;
export const SUPABASE_CLAVE: string = clave;
