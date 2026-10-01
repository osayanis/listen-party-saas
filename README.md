<div align="center">
  <img src="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=300&q=80" alt="ListenParty Logo" width="120" style="border-radius: 20px;" />
  <h1>🎧 ListenParty SaaS</h1>
  <p><strong>Synchronisez Apple Music entre amis en temps réel, façon Kahoot.</strong></p>
</div>

---

## 🌟 Présentation
**ListenParty** est une plateforme SaaS permettant de créer des salons d'écoute virtuels pour Apple Music. 
Rejoignez un salon via un code PIN ou un QR Code, et profitez d'une synchronisation parfaite de la musique avec vos amis, où qu'ils soient.

💡 **L'innovation du projet :** Apple restreint son API Web (MusicKit) aux comptes développeurs payants. Pour contourner cette limite et proposer une vraie solution 100% gratuite, ce projet utilise une architecture **Web + Mac Bridge** similaire au *Rich Presence* de Discord !

---

## ✨ Fonctionnalités

- 🚀 **Interface "Kahoot-Style" :** Création de salons à la volée avec un code PIN à 6 chiffres.
- 📱 **QR Code dynamique :** Scannez l'écran pour rejoindre instantanément depuis un mobile.
- 🎵 **Synchronisation Temps Réel :** Socket.io garantit un délai de l'ordre de la milliseconde entre l'hôte et les invités.
- 🖼️ **Pochettes Haute Définition :** Intégration de l'API publique iTunes Search pour afficher les pochettes d'albums en qualité maximale (600x600).
- 📜 **File d'attente Apple Music :** Le site affiche en temps réel les 10 prochaines musiques de votre Playlist Apple Music locale.

---

## 🏗️ Architecture Technique

Ce projet est scindé en deux parties complémentaires :

1. **Le Serveur Web (SaaS)** `Next.js / Socket.io / TailwindCSS`
   - Gère les salons, la connexion des utilisateurs, et l'interface utilisateur.
2. **Le Mac Bridge** `Python / AppleScript`
   - Un script léger qui tourne en arrière-plan sur le Mac de l'hôte. Il fait le pont entre le serveur web et l'application Apple Music locale.

---

## 🚀 Installation & Lancement

### 1. Lancer la plateforme Web (Le SaaS)
Assurez-vous d'avoir [Node.js](https://nodejs.org/) installé, puis ouvrez votre terminal :

```bash
# Cloner le projet
git clone https://github.com/VOTRE_NOM/listen-party-saas.git
cd listen-party-saas

# Installer les dépendances
npm install

# Lancer le serveur web
npm run dev
```
👉 Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

### 2. Lancer le Mac Bridge (Pour contrôler Apple Music)
Le Bridge est nécessaire pour l'hôte du salon (celui qui diffuse sa musique).

```bash
# Rendre le script exécutable (à faire une seule fois)
chmod +x lancer_bridge.command

# Lancer le pont
./lancer_bridge.command
```
*(Le script créera automatiquement son environnement virtuel Python et s'y connectera).*
Il vous demandera alors de saisir le **Code PIN** affiché sur votre site web.

---

## 🍏 Notes sur la File d'Attente (Apple Music)

Apple bloque l'accès développeur à la fonction *"Jouer Ensuite"* (via clic droit). 
Pour que la file d'attente s'affiche sur le site web, **vous devez obligatoirement lancer la musique depuis une Playlist**. 
Ajoutez vos musiques dans cette Playlist sur votre Mac, et le site web se mettra à jour instantanément pour tout le monde !

---
<div align="center">
  Fait avec ❤️ par <a href="https://github.com/osayanis">osayanis</a> et <a href="https://github.com/pirrokin">pirrokin</a>
</div>
