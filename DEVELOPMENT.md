# Vývojářská dokumentace (Development Guide)

Tento soubor obsahuje instrukce pro instalaci závislostí, spuštění vývojového režimu a kompilaci produkčního buildu aplikace **Fit Reporter**.

---

## Požadavky na prostředí

Pro spuštění a kompilaci aplikace na vašem počítači musíte mít nainstalované:

1.  **Node.js** (verze 18 a novější, doporučeno LTS) – stahujte z [nodejs.org](https://nodejs.org/).
2.  **Rust a Cargo** (Rust toolchain) – stahujte z [rustup.rs](https://rustup.rs/).
3.  **C++ Build Tools** (pro Windows kompilaci přes MSVC) – nainstaluje se automaticky při instalaci Rustu nebo přes Visual Studio Installer (zvolte sadu *Vývoj desktopových aplikací pomocí C++*).

---

## Spuštění vývoje (Development)

1.  Nainstalujte Node.js závislosti v kořenové složce projektu:
    ```bash
    npm install
    ```
2.  Spusťte vývojovou verzi aplikace:
    ```bash
    npm run tauri dev
    ```
    *Tento příkaz automaticky spustí Vite vývojový server pro frontend a následně otevře okno aplikace v Tauri.*

---

## Sestavení produkční verze (Build)

Před spuštěním buildu musíte v PowerShellu nastavit proměnnou prostředí pro automatické podepisování balíčků (bez toho kompilátor nepovolí sestavit updater).

### PowerShell (Windows):

```powershell
# 1. Nastavte podpisový klíč (klíč naleznete v tauri-updater-keys.txt)
$env:TAURI_SIGNING_PRIVATE_KEY="váš_soukromý_klíč"

# 2. Spusťte sestavení aplikace
npm run tauri build
```

Po dokončení najdete hotové instalátory v adresáři:
`src-tauri/target/release/bundle/`

*   `.exe` (NSIS instalátor s licencí a ikonami)
*   `.msi` (WIX instalační balíček)
*   `.zip` (balíček pro automatické aktualizace)

---

## Správa updateru a klíčů

*   **Veřejný klíč** (Public Key) je zapsán v souboru [tauri.conf.json](src-tauri/tauri.conf.json) pod položkem `plugins.updater.pubkey`. Slouží k tomu, aby nainstalovaná aplikace před stažením aktualizace ověřila její podpis.
*   **Soukromý klíč** (Private Key) slouží k podepsání balíčku při buildu. Tento klíč nesmí být nikdy nahrán na GitHub (je ignorován v `.gitignore`).
