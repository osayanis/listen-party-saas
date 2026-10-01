import rumps
import socketio
import subprocess
import time
import threading
import os
import json

sio = socketio.Client()
CONFIG_FILE = os.path.expanduser('~/.listenparty_config.json')
DEFAULT_CLOUD_URL = 'https://listen-party-saas.vercel.app'

class ListenPartyStatusBarApp(rumps.App):
    def __init__(self):
        super(ListenPartyStatusBarApp, self).__init__("🎧")
        self.room_id = None
        self.last_state = None
        self.ignore_next = False
        
        # Load Config
        self.load_config()
        
        # UI Elements
        self.status_menu = rumps.MenuItem("🔴 Statut: Déconnecté")
        self.target_app_menu = rumps.MenuItem(f"🎵 App cible : {self.config.get('target_app', 'Music')}")
        
        self.menu = [
            self.status_menu,
            self.target_app_menu,
            rumps.separator,
            "Rejoindre un Salon",
            "Changer de Lecteur (Apple/Spotify)",
            "⚙️ Paramètres du Serveur",
        ]
        
        # Socket.IO Event Binding
        sio.on('connect', self.on_connect)
        sio.on('disconnect', self.on_disconnect)
        sio.on('web-action', self.on_web_action)
        
        # Start Worker Thread
        threading.Thread(target=self.background_worker, daemon=True).start()

    def load_config(self):
        try:
            with open(CONFIG_FILE, 'r') as f:
                self.config = json.load(f)
        except Exception:
            self.config = {'server_url': DEFAULT_CLOUD_URL, 'target_app': 'Music'}

    def save_config(self):
        try:
            with open(CONFIG_FILE, 'w') as f:
                json.dump(self.config, f)
        except Exception as e:
            print(f"Erreur de sauvegarde config : {e}")

    def on_connect(self):
        self.status_menu.title = "🟢 Statut: Connecté au Web"
        if self.room_id:
            sio.emit('join-room', (self.room_id, 'MacBridge-Helper'))

    def on_disconnect(self):
        self.status_menu.title = "🔴 Statut: Déconnecté"

    def on_web_action(self, data):
        self.ignore_next = True
        state = data.get('state')
        app_name = self.config.get('target_app', 'Music')
        
        if state == 'playing':
            self.run_applescript(f'tell application "{app_name}" to play')
        elif state == 'paused':
            self.run_applescript(f'tell application "{app_name}" to pause')
        elif state == 'skip':
            self.run_applescript(f'tell application "{app_name}" to next track')
        elif state == 'volume':
            vol = data.get('value', 50)
            self.run_applescript(f'tell application "{app_name}" to set sound volume to {vol}')

    @rumps.clicked("Changer de Lecteur (Apple/Spotify)")
    def change_player(self, _):
        current = self.config.get('target_app', 'Music')
        new_app = "Spotify" if current == "Music" else "Music"
        self.config['target_app'] = new_app
        self.save_config()
        self.target_app_menu.title = f"🎵 App cible : {new_app}"
        rumps.notification("ListenParty", "Lecteur modifié", f"Le Bridge contrôle désormais {new_app} !")

    @rumps.clicked("⚙️ Paramètres du Serveur")
    def settings_dialog(self, _):
        window = rumps.Window(
            message="Entrez l'URL de votre serveur (ex: http://192.168.1.5:3000)\n\nLaissez vide pour utiliser le Serveur Cloud Officiel.",
            title="Paramètres Serveur",
            default_text=self.config.get('server_url', ''),
            cancel=True
        )
        response = window.run()
        if response.clicked:
            new_url = response.text.strip()
            if not new_url:
                new_url = DEFAULT_CLOUD_URL
            
            self.config['server_url'] = new_url
            self.save_config()
            
            # Forcer la reconnexion
            if sio.connected:
                sio.disconnect()
            rumps.notification("ListenParty", "Paramètres sauvegardés", f"Nouveau serveur : {new_url}")

    @rumps.clicked("Rejoindre un Salon")
    def join_room_dialog(self, _):
        window = rumps.Window(
            message="Entrez le code PIN affiché sur le site web :",
            title="ListenParty",
            default_text="",
            cancel=True
        )
        response = window.run()
        if response.clicked and response.text.strip():
            self.room_id = response.text.strip()
            self.title = f"🎧 {self.room_id}"
            
            if sio.connected:
                sio.emit('join-room', (self.room_id, 'MacBridge-Helper'))
                # Force update
                current = self.get_music_state()
                if current['state'] != 'stopped':
                    sio.emit('bridge-state', (self.room_id, current))

    def run_applescript(self, script):
        try:
            return subprocess.check_output(['osascript', '-e', script]).decode('utf-8').strip()
        except Exception:
            return None

    def get_music_state(self):
        app_name = self.config.get('target_app', 'Music')
        
        # Le script pour Spotify n'a pas accès à 'current playlist', on omet donc la file d'attente
        queue_script = """
                set upcoming to ""
                try
                    set curPl to current playlist
                    set curIdx to index of current track
                    set totalTracks to count of tracks in curPl
                    set maxQ to 10
                    set c to 0
                    repeat with i from (curIdx + 1) to totalTracks
                        set upcoming to upcoming & name of track i of curPl & "::" & artist of track i of curPl & "||"
                        set c to c + 1
                        if c is maxQ then exit repeat
                    end repeat
                on error
                    set upcoming to "NO_QUEUE"
                end try
        """ if app_name == "Music" else 'set upcoming to "NO_QUEUE"'

        script = f"""
        tell application "{app_name}"
            if it is running then
                set pState to player state as string
                try
                    set tName to name of current track
                    set tArtist to artist of current track
                on error
                    set tName to "Unknown"
                    set tArtist to "Unknown"
                end try
                
                {queue_script}
                
                return pState & "|" & tName & "|" & tArtist & "|" & upcoming
            end if
            return "stopped|Aucune musique|Aucun|NO_QUEUE"
        end tell
        """
        res = self.run_applescript(script)
        if res:
            parts = res.split('|', 3)
            if len(parts) >= 3:
                state_data = {
                    "state": parts[0],
                    "track": parts[1],
                    "artist": parts[2],
                    "queue": []
                }
                if len(parts) == 4 and parts[3] not in ["NO_QUEUE", ""]:
                    items = [x for x in parts[3].split('||') if x]
                    for idx, item in enumerate(items):
                        sub = item.split('::')
                        if len(sub) == 2:
                            state_data["queue"].append({
                                "id": str(idx),
                                "track": sub[0],
                                "artist": sub[1]
                            })
                return state_data
        return {"state": "stopped", "track": "Aucune musique", "artist": "Aucun", "queue": []}

    def background_worker(self):
        while True:
            if not sio.connected:
                try:
                    sio.connect(self.config.get('server_url', DEFAULT_CLOUD_URL))
                except Exception:
                    pass 
            
            time.sleep(1.5)
            if not self.room_id or not sio.connected:
                continue
                
            current_state = self.get_music_state()
            if self.ignore_next:
                self.last_state = current_state
                self.ignore_next = False
                continue
                
            if current_state != self.last_state:
                if current_state['state'] != 'stopped':
                    sio.emit('bridge-state', (self.room_id, current_state))
                self.last_state = current_state

if __name__ == "__main__":
    app = ListenPartyStatusBarApp()
    app.run()
