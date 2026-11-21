// PM2 process file: keeps the website running, restarts it if it crashes or after a server reboot.
//   pm2 start ecosystem.config.js     pm2 reload sainand     pm2 logs sainand
module.exports = {
  apps: [{
    name: 'sainand',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '400M',
    kill_timeout: 10000,
    restart_delay: 3000,
    max_restarts: 20,
    time: true,
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    merge_logs: true,
    env: { NODE_ENV: 'production' },
  }],
};
