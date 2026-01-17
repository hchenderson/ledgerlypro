# .idx/dev.nix
# Firebase Studio workspace config (Nix).
# Docs: https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  channel = "stable-24.11";

  packages = [
    pkgs.nodejs_20
    pkgs.zulu
  ];

  # Keep this empty (or non-sensitive vars only).
  # Firebase Studio notes dev.nix is typically shared/committed. :contentReference[oaicite:2]{index=2}
  env = { };

  services.firebase.emulators = {
    detect = false;
    projectId = "demo-app";
    services = [ "auth" "firestore" ];
  };

  idx = {
    extensions = [ ];

    workspace = {
      onCreate = {
        default.openFiles = [ "src/app/page.tsx" ];
      };
    };

    previews = {
      enable = true;
      previews = {
        web = {
          manager = "web";
          # Use bash to source .env.local before starting Next.js preview.
          # This makes Preview consistent with terminal "npm run dev".
          command = [
            "bash"
            "-lc"
            ''
              set -euo pipefail

              # Load dotenv if present (supports KEY='value' quoting).
              if [ -f .env.local ]; then
                set -a
                . ./.env.local
                set +a
              fi

              # Start Next dev server on the port Firebase Studio allocates.
              npm run dev -- --port "$PORT" --hostname "0.0.0.0"
            ''
          ];
        };
      };
    };
  };
}
