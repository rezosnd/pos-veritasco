// PM2 Ecosystem Config — Production EC2
module.exports = {
  apps: [
    {
      name: 'pos-backend',
      script: 'server.js',
      cwd: '/home/ubuntu/restaurant-pos/backend',
      instances: 'max',          // Use all CPU cores
      exec_mode: 'cluster',       // Cluster mode for load balancing
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // Auto-restart on crash
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      // Graceful reload
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 15000,
    },
  ],
};
