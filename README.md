# 🎴 ThumbDrop — Guide d'installation complet

Jeu de collection de miniatures YouTube, hébergé **24h/24** gratuitement.

---

## 🗺️ Architecture

| Outil | Rôle | Gratuit ? |
|---|---|---|
| **Next.js 14** | Frontend + API routes | ✅ |
| **Supabase** | Base de données + Auth | ✅ (500 MB) |
| **Vercel** | Hébergement 24/7 | ✅ (100 GB bandwidth) |
| **YouTube Data API v3** | Fetch miniatures aléatoires | ✅ (10 000 req/jour) |

---

## ÉTAPE 1 — Supabase (base de données)

1. Va sur **https://supabase.com** → **New Project**
2. Choisis un nom (ex: `thumbdrop`), un mot de passe fort, région `West EU`
3. Une fois créé, va dans **SQL Editor** → colle **tout le contenu** du fichier `supabase/schema.sql` → **Run**
4. Va dans **Settings → API** et note :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

**Important :** Dans **Authentication → URL Configuration**, ajoute :
- Site URL : `https://TON-APP.vercel.app`
- Redirect URL : `https://TON-APP.vercel.app/api/auth/callback`

---

## ÉTAPE 2 — YouTube Data API

1. Va sur **https://console.cloud.google.com**
2. Crée un nouveau projet (ex: `thumbdrop`)
3. Va dans **APIs & Services → Enable APIs → YouTube Data API v3** → Active-la
4. Va dans **Credentials → Create Credentials → API Key**
5. Copie la clé → `YOUTUBE_API_KEY`

> ⚠️ Quota gratuit : 10 000 unités/jour. Chaque ouverture de pack = ~3 unités.
> Ça représente ~3 000 packs/jour largement suffisant !

---

## ÉTAPE 3 — Déployer sur Vercel (hébergement 24/7)

### Option A — Via GitHub (recommandé)

1. **Crée un repo GitHub** → pousse le code :
   ```bash
   cd thumbdrop
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TON_USER/thumbdrop.git
   git push -u origin main
   ```

2. Va sur **https://vercel.com** → **New Project** → importe le repo GitHub

3. Dans **Environment Variables**, ajoute :
   ```
   NEXT_PUBLIC_SUPABASE_URL      = https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
   SUPABASE_SERVICE_ROLE_KEY     = eyJ...
   YOUTUBE_API_KEY               = AIza...
   ```

4. Clique **Deploy** — Vercel build et héberge automatiquement !

### Option B — Via Vercel CLI

```bash
npm i -g vercel
cd thumbdrop
vercel login
vercel --prod
```
Suis les instructions et configure les variables d'environnement quand demandé.

---

## ÉTAPE 4 — Lancer en local (développement)

```bash
cd thumbdrop
npm install

# Copie le fichier d'exemple
cp .env.local.example .env.local
# Édite .env.local avec tes vraies clés

npm run dev
# → http://localhost:3000
```

---

## 🎮 Fonctionnalités implémentées

### Currencies
| Monnaie | Obtention | Usage |
|---|---|---|
| 🪙 **Tubes** | Missions quotidiennes, connexion | Basic Pack (200), Premium Pack (500) |
| 💎 **Cristaux** | Missions hebdomadaires | Crystal Pack (15) |

### Packs
| Pack | Prix | Cartes | Chance Chaîne |
|---|---|---|---|
| 📦 Basic Pack | 200 🪙 | 3 | 0.1% |
| 🎁 Premium Pack | 500 🪙 | 5 | 0.3% |
| 💎 Crystal Pack | 15 💎 | 5 + garanti Épique | 1% |

### Raretés (basées sur les vues YouTube)
| Rareté | Seuil de vues | Couleur |
|---|---|---|
| ⚪ Basique | < 100K | Gris |
| 🟢 Rare | 100K+ | Vert |
| 🔵 Super Rare | 1M+ | Bleu |
| 🟣 Épique | 10M+ | Violet |
| 🟡 Mythique | 50M+ | Ambre |
| 🔴 Légendaire | 100M+ | Rouge |
| 🌟 Ultra Légendaire | 500M+ | Rose |
| ✨ Secret | 1B+ | Cyan |
| 📺 Chaîne YouTube | Unique par joueur ! | Or |

### Missions
- ☀️ **Quotidiennes** : connexion, ouvrir un pack, collecter 3 cartes
- 📅 **Hebdomadaires** : obtenir une Épique+, ouvrir 10 packs, 25 nouvelles miniatures

### Autres
- 🔄 **Système de trade** : propose un échange 1-contre-1 avec n'importe quel joueur
- 🏆 **Classement global** : top 50 des collectionneurs
- 📚 **Collection** : filtre par rareté, recherche par nom
- 📺 **Chaînes uniques** : possession exclusive, échangeable

---

## 🚀 Après le déploiement

- L'URL de ton jeu sera : `https://thumbdrop-xxx.vercel.app`
- Chaque `git push` redéploie automatiquement
- Surveille la conso YouTube API dans Google Cloud Console
- Supabase Dashboard → Table Editor pour voir les données en temps réel

---

## 💡 Améliorations futures possibles

- [ ] Pack d'événements saisonniers (Halloween, Noël...)
- [ ] Duels entre joueurs (qui a la meilleure carte ?)
- [ ] Marché public pour vendre ses cartes
- [ ] Notifications en temps réel (Supabase Realtime)
- [ ] PWA pour installer sur mobile
- [ ] Showcase public de collection (URL partageable)
