import rumps
import socketio
import subprocess
import time
import threading

sio = socketio.Client()
SERVER_URL = 'http://localhost:3000'

class ListenPartyStatusBarApp(rumps.App):
    def __init__(self):
        super(ListenPartyStatusBarApp, self).__init__("🎧")
        self.room_id = None
        self.last_state = None
        self.ignore_next = False
        
        # UI Elements
        self.status_menu = rumps.MenuItem("Statut: Déconnecté")
        self.menu = [
            self.status_menu,
            rumps.separator,
            "Rejoindre un Salon",
        ]
        
        # Socket.IO Event Binding
        sio.on('connect', self.on_connect)
        sio.on('disconnect', self.on_disconnect)
        sio.on('web-action', self.on_web_action)
        
        # Start Worker Thread
        threading.Thread(target=self.background_worker, daemon=True).start()

    def on_connect(self):
        self.status_menu.title = "🟢 Statut: Connecté au Web"
        if self.room_id:
            sio.emit('join-room', (self.room_id, 'MacBridge-Helper'))

    def on_disconnect(self):
        self.status_menu.title = "🔴 Statut: Déconnecté"

    def on_web_action(self, data):
        self.ignore_next = True
        state = data.get('state')
        if state == 'playing':
            self.run_applescript('tell application "Music" to play')
        elif state == 'paused':
            self.run_applescript('tell application "Music" to pause')

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
        script = """
        tell application "Music"
            if it is running then
                set pState to player state as string
                try
                    set tName to name of current track
                    set tArtist to artist of current track
                on error
                    set tName to "Unknown"
                    set tArtist to "Unknown"
                end try
                
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
        # Attempt to connect to the Node.js server
        while not sio.connected:
            try:
                sio.connect(SERVER_URL)
            except Exception:
                time.sleep(2)
            
        while True:
            time.sleep(1.5)
            if not self.room_id:
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
