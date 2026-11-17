module.exports = {
  apps: [{
    name: 'ujian',
    cwd: '/var/www/ujian',
    script: './node_modules/next/dist/bin/next',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '1G',

    // --- log ---
    out_file: '/var/log/ujian/out.log',
    error_file: '/var/log/ujian/error.log',
    merge_logs: true,                       // gabung log semua instance ke satu file
    log_date_format: 'YYYY-MM-DD HH:mm:ss',

    env: {
      PORT: 3000,
      NODE_ENV: 'production'
    }
  }]
}