module.exports = {
  apps: [
    {
      name: "RPA-EsSalud",
      cwd: "./rpa-backend",
      script: "server.js",
      args: "",
      env: {
        PORT: 10000
      }
    },
    {
      name: "Cloudflare-Tunnel",
      script: "C:/cloudflared/cloudflared.exe",
      interpreter: "none",
      args: "tunnel --url http://localhost:10000"
    }
  ]
};
