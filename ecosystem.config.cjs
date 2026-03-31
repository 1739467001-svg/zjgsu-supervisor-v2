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
        // 全局时区配置：确保 Node.js 进程使用中国标准时间（UTC+8）
        // 影响：new Date()、console.log 时间戳、日志记录等所有时间相关操作
        TZ: "Asia/Shanghai",
      },
      error_file: "/root/logs/zjgsu-error.log",
      out_file: "/root/logs/zjgsu-out.log",
      // PM2 日志时间戳格式（使用 TZ 环境变量指定的时区）
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
