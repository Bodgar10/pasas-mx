#!/usr/bin/env python3
"""Le pone voz mexicana a un video de bodgar.dev que llegó sin voz.

En la Mac, dentro de la carpeta donde guardaste el video:
    python3 ponvoz.py                 # toma el MP4 más reciente sin voz de esta carpeta
    python3 ponvoz.py video.mp4       # uno en particular
    python3 ponvoz.py --voz dalia     # voz de mujer (por omisión: jorge)
    python3 ponvoz.py --motor say     # sin internet: voces de la Mac (Paulina / Juan)

Sale <video>-voz.mp4 junto al original. El video no se vuelve a codificar: solo se le agrega el audio.

Cómo sabe qué decir y cuándo: el MP4 trae dentro (metadato "comment") el texto de cada escena y en qué
segundo empieza y cuánto dura. Cada frase se coloca al inicio de su escena; si una voz sale más larga
que su escena, se acelera un poco (hasta 1.3x) para que no se encime con la siguiente.

Requisitos (una sola vez):
    brew install ffmpeg
    python3 -m pip install edge-tts
"""
import argparse, asyncio, glob, importlib.util, json, os, shutil, subprocess, sys, tempfile

VOCES = {  # voces neuronales de México (edge-tts)
    "jorge": "es-MX-JorgeNeural",
    "dalia": "es-MX-DaliaNeural",
}
MARGEN = 0.15      # silencio mínimo al final de cada escena
MAX_TEMPO = 1.3    # lo más que se acelera una frase para que quepa


def falla(msg):
    print(f"\n✗ {msg}\n", file=sys.stderr)
    sys.exit(1)


def correr(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def duracion(f):
    r = correr(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f])
    return float(r.stdout.strip())


def leer_tiempos(video):
    """Los tiempos vienen dentro del MP4; si no, de <video>.voz.json al lado."""
    r = correr(["ffprobe", "-v", "error", "-show_entries", "format_tags=comment", "-of", "json", video])
    tags = json.loads(r.stdout).get("format", {}).get("tags", {})
    txt = tags.get("comment") or tags.get("COMMENT")
    if txt:
        try:
            return json.loads(txt)
        except json.JSONDecodeError:
            pass
    lado = os.path.splitext(video)[0] + ".voz.json"
    if os.path.exists(lado):
        return json.load(open(lado, encoding="utf-8"))
    falla(f"{os.path.basename(video)} no trae los tiempos de las escenas. ¿Es un video del correo diario de bodgar.dev?")


def voz_say():
    """Una voz de México instalada en la Mac (Paulina o Juan, de preferencia la versión mejorada)."""
    r = correr(["say", "-v", "?"])
    mx = [l.split("  ")[0].strip() for l in r.stdout.splitlines() if "es_MX" in l]
    mx = [v for v in mx if v.split(" ")[0] in ("Paulina", "Juan")]
    if not mx:
        falla("La Mac no tiene voces de México. Agrégalas en Configuración del Sistema → Accesibilidad → "
              "Contenido leído → Voz del sistema → Administrar voces → Español (México).")
    mejores = [v for v in mx if "Enhanced" in v or "Premium" in v or "mejorada" in v.lower()]
    return (mejores or mx)[0]


def sintetiza(texto, salida, motor, voz):
    """Genera el audio de una frase. Devuelve la ruta del archivo."""
    if motor == "edge":
        import edge_tts
        f = salida + ".mp3"
        async def _genera():
            await edge_tts.Communicate(texto, voz).save(f)
        asyncio.run(_genera())
        return f
    f = salida + ".aiff"
    correr(["say", "-v", voz, "-o", f, texto])
    return f


def poner_voz(video, motor, voz, sintetizar=sintetiza):
    datos = leer_tiempos(video)
    escenas = datos["escenas"]
    total = duracion(video)
    tmp = tempfile.mkdtemp(prefix="ponvoz-")
    entradas, filtros, avisos = [], [], []
    print(f"Voz: {voz} ({motor}) · {len(escenas)} escenas")
    for i, e in enumerate(escenas):
        f = sintetizar(e["voz"], os.path.join(tmp, f"{i + 1:02d}"), motor, voz)
        d = duracion(f)
        cabe = max(0.5, e["dur"] - MARGEN)
        tempo = 1.0
        if d > cabe:
            tempo = min(MAX_TEMPO, d / cabe)
            if d / tempo > e["dur"]:
                avisos.append(f"  escena {i + 1} ({e['id']}): la voz dura {d / tempo:.1f} s (ya acelerada) y la escena {e['dur']:.1f} s; se encima un poco con la siguiente")
        ms = int(round(e["ini"] * 1000))
        entradas += ["-i", f]
        cad = f"[{i + 1}:a]aresample=48000,aformat=channel_layouts=stereo"
        if tempo > 1.001:
            cad += f",atempo={tempo:.3f}"
        filtros.append(f"{cad},adelay={ms}|{ms}[v{i}]")
        print(f"  {i + 1:02d} {e['id']:<12} {d:5.1f} s{f'  → {tempo:.2f}x' if tempo > 1.001 else ''}")
    n = len(escenas)
    mezcla = "".join(f"[v{i}]" for i in range(n)) + f"amix=inputs={n}:normalize=0,apad,atrim=0:{total:.3f},loudnorm=I=-14:TP=-1.5:LRA=11[a]"
    salida = os.path.splitext(video)[0] + "-voz.mp4"
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", video, *entradas,
           "-filter_complex", ";".join(filtros) + ";" + mezcla,
           "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
           "-t", f"{total:.3f}", "-movflags", "+faststart", salida]
    subprocess.run(cmd, check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    for a in avisos:
        print(a)
    return salida


def main():
    p = argparse.ArgumentParser(description="Le pone voz mexicana a un video de bodgar.dev")
    p.add_argument("video", nargs="?", help="MP4 sin voz (por omisión, el más reciente de esta carpeta)")
    p.add_argument("--voz", default="jorge", help="jorge, dalia o el nombre de una voz de edge-tts / de la Mac")
    p.add_argument("--motor", choices=["edge", "say"], help="edge (voces neuronales, necesita internet) o say (voces de la Mac)")
    a = p.parse_args()

    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        falla("Falta ffmpeg. Instálalo con:  brew install ffmpeg")
    video = a.video
    if not video:
        mp4s = [f for f in glob.glob("*.mp4") if not f.endswith("-voz.mp4")]
        if not mp4s:
            falla("No encontré ningún MP4 sin voz en esta carpeta. Guarda aquí el video del correo.")
        video = max(mp4s, key=os.path.getmtime)
    if not os.path.exists(video):
        falla(f"No existe {video}")

    motor = a.motor or "edge"
    if motor == "edge" and importlib.util.find_spec("edge_tts") is None:
        falla(f"Falta edge-tts para este Python ({sys.executable}). Instálalo con:\n"
              f"    {sys.executable} -m pip install edge-tts\n"
              "  y vuelve a correr:  python3 ponvoz.py")
    if motor == "say" and not shutil.which("say"):
        falla("El motor 'say' solo existe en la Mac.")
    voz = VOCES.get(a.voz.lower(), a.voz) if motor == "edge" else (a.voz if a.voz.lower() not in VOCES else voz_say())

    print(f"Video: {video}")
    try:
        salida = poner_voz(video, motor, voz)
    except Exception as e:
        if motor == "edge" and not isinstance(e, subprocess.CalledProcessError):
            falla(f"No se pudo generar la voz con edge-tts ({e}). ¿Hay internet? Vuelve a intentar en un momento.")
        err = ((getattr(e, "stderr", None) or "").strip().splitlines()[-1:]) or [""]
        if motor == "edge":
            falla(f"No se pudo generar la voz con edge-tts ({err[0]}). ¿Hay internet? Prueba:  python3 ponvoz.py --motor say")
        falla(f"Falló un paso: {' '.join(e.cmd[:2])} {err[0]}")
    print(f"\n✓ Listo: {salida}")


if __name__ == "__main__":
    main()
