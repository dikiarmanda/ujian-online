module.exports = {
  apps: [{
    name: 'ujian',
    script: 'npm',
    args: 'run start',        // gunakan "start", bukan "dev"
    instances: 'max',
    exec_mode: 'cluster',
    env: { PORT: 3000 }
  }]
}