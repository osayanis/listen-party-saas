import time
import subprocess
import socketio

sio = socketio.Client()
ROOM_ID = ""
LAST_STATE = None
IGNORE_NEXT = False

def run_applescript(script):
    try:
        return subprocess.check_output(['osascript', '-e', script]).decode('utf-8').strip()
    except Exception:
        return None

def get_music_state():
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
    res = run_applescript(script)
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

@sio.event
def connect():
    print(f"\n✅ Connecté au SaaS ListenParty ! Vous avez rejoint le salon : {ROOM_ID}")
    sio.emit('join-room', (ROOM_ID, 'MacBridge-Helper'))

@sio.on('web-action')
def on_web_action(data):
    global IGNORE_NEXT
    print(f"🌍 Ordre reçu du site web : {data['state']}")
    IGNORE_NEXT = True
    if data['state'] == 'playing':
        run_applescript('tell application "Music" to play')
    elif data['state'] == 'paused':
        run_applescript('tell application "Music" to pause')

def main():
    global ROOM_ID, LAST_STATE, IGNORE_NEXT
    print("========================================")
    print("🎧 ListenParty - Mac Bridge (GRATUIT)")
    print("========================================")
    ROOM_ID = input("Entrez le code PIN du salon (affiché sur le site web) : ").strip()
    
    SERVER_URL = 'http://localhost:3000'
    print(f"Connexion au serveur web ({SERVER_URL})...")
    
    try:
        sio.connect(SERVER_URL)
    except Exception as e:
        print(f"Erreur de connexion ({e})")
        return
        
    try:
        while True:
            time.sleep(1.5)
            current_state = get_music_state()
            
            if IGNORE_NEXT:
                LAST_STATE = current_state
                IGNORE_NEXT = False
                continue
                
            if current_state != LAST_STATE:
                if current_state['state'] != 'stopped':
                    sio.emit('bridge-state', (ROOM_ID, current_state))
                LAST_STATE = current_state
                
    except KeyboardInterrupt:
        print("\nArrêt du Bridge.")
        sio.disconnect()

if __name__ == '__main__':
    main()
