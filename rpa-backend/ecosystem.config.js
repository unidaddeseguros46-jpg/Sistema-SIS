module.exports = {
    apps: [
        {
            name: "Cloudflare-Tunnel",
            script: "C:/cloudflared/cloudflared.exe",
            interpreter: "none",
            args: "tunnel --url http://localhost:10000"
        }
    ]
};