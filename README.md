# AnonChat

Frontend React/Vite e backend Node/Socket.IO per una chat casuale con minigiochi.

## Struttura

```text
anonchat/
|- public/                # asset statici frontend
|- src/                   # app React
|- server/
|  |- models/             # modelli MongoDB
|  |- server.js           # API + Socket.IO
|  |- package.json
|  `- .env.example
|- .env.example           # variabili frontend
|- package.json           # script frontend + script root utili
`- vite.config.ts
```

## Sviluppo locale

Frontend:

```bash
npm install
npm run dev:client
```

Backend:

```bash
cd server
npm install
npm run dev
```

## Variabili ambiente

Frontend `.env`:

```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

Backend `server/.env`:

```env
PORT=3001
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://127.0.0.1:27017/anonchat
JWT_SECRET=change-this-super-secret-key
```

Nota: il backend legge le variabili da `process.env`, quindi in produzione vanno impostate nel provider hosting.

## Check prima del deploy

Frontend + controllo sintassi backend:

```bash
npm run check
```

Solo frontend:

```bash
npm run build:client
```

## Pubblicazione

Setup consigliato:

1. Pubblica il frontend statico (`dist/`) su Vercel, Netlify o simili.
2. Pubblica il backend `server/` su Render, Railway, Fly.io o VPS Node.
3. Usa un MongoDB remoto.
4. Imposta nel frontend gli URL pubblici del backend.
5. Imposta nel backend `CLIENT_URL` con il dominio reale del frontend.

### Vercel + Render

Frontend su Vercel:

1. Importa il repository su Vercel.
2. Lascia la root del progetto sulla cartella principale del repo.
3. Framework preset: Vite.
4. Build command: `npm run build:client`
5. Output directory: `dist`
6. Environment variables:

```env
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
VITE_SOCKET_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

Backend su Render:

1. Puoi creare il servizio dal file [render.yaml](C:\Users\M S I\Desktop\anonchat\render.yaml) oppure dal dashboard.
2. Se lo crei dal dashboard:
   Root Directory: `server`
   Build Command: `npm install`
   Start Command: `npm start`
   Health Check Path: `/health`
3. Environment variables:

```env
CLIENT_URL=https://YOUR-PROJECT.vercel.app,https://YOUR-DOMAIN.com
MONGO_URI=your-mongodb-uri
JWT_SECRET=your-secret
```

Ordine consigliato:

1. Pubblica prima il backend su Render.
2. Copia l'URL Render nel frontend Vercel.
3. Pubblica il frontend su Vercel.
4. Aggiorna `CLIENT_URL` su Render con il dominio Vercel finale.

## Nota importante per Linux

E stato corretto un import case-sensitive nel backend (`./models/user.js`). Questo e importante perche in locale su Windows puo funzionare anche con maiuscole/minuscole sbagliate, mentre online spesso no.
