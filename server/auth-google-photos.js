/**
 * Script de autenticación ONE-TIME para Google Photos API
 * 
 * Ejecutar UNA SOLA VEZ localmente para obtener el refresh_token:
 *   node auth-google-photos.js
 * 
 * Luego copiar el refresh_token en el .env del servidor:
 *   GOOGLE_PHOTOS_REFRESH_TOKEN=xxxx
 */

import { OAuth2Client } from "google-auth-library";
import readline from "readline";
import open from "open";
import dotenv from "dotenv";
dotenv.config();

const CLIENT_ID = process.env.GOOGLE_PHOTOS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_PHOTOS_CLIENT_SECRET;

// Para clientes de tipo "Escritorio" (installed), usar urn:ietf:wg:oauth:2.0:oob
const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";

const SCOPES = [
  "https://www.googleapis.com/auth/photoslibrary.readonly",
];

const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

console.log("\n✅ Abre esta URL en el navegador para autorizar Google Photos:\n");
console.log(authUrl);
console.log("\nCuando autorices, Google te mostrará un código. Pégalo aquí:\n");

open(authUrl).catch(() => {});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Código: ", async (code) => {
  rl.close();
  try {
    const { tokens } = await oAuth2Client.getToken(code.trim());
    console.log("\n🎉 ¡Listo! Refresh Token obtenido:");
    console.log(tokens.refresh_token);
    console.log("\n📋 Ya fue guardado — ahora añádelo al .env de Render.");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
  process.exit(0);
});

