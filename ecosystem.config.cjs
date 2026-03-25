module.exports = {
  apps: [
    {
      name: "zjgsu-supervisor",
      script: "/root/zjgsu-supervisor/dist/index.js",
      cwd: "/root/zjgsu-supervisor",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        DATABASE_URL: "mysql://zjgsu:zjgsu_pass_2026@localhost:3306/zjgsu_supervisor",
        JWT_SECRET: "zjgsu_supervisor_jwt_secret_2026_secure_key",
      },
      error_file: "/root/logs/zjgsu-error.log",
      out_file: "/root/logs/zjgsu-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
