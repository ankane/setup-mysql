const fs = require('fs');
const os = require('os');
const path = require('path');
const process = require('process');
const spawnSync = require('child_process').spawnSync;

function run() {
  const args = Array.from(arguments);
  console.log(args.map(v => v.toString().includes(' ') ? `"${v}"` : v).join(' '));
  const command = args.shift();
  let env = Object.assign({}, process.env);
  env.HOMEBREW_NO_AUTO_UPDATE = '1';
  env.HOMEBREW_NO_INSTALL_CLEANUP = '1';
  // spawn is safer and more lightweight than exec
  const ret = spawnSync(command, args, {stdio: 'inherit', env: env});
  if (ret.status !== 0) {
    throw ret.error;
  }
}

function addToPath(newPath) {
  fs.appendFileSync(process.env.GITHUB_PATH, `${newPath}\n`);
}

const image = process.env['ImageOS'];
const defaultVersion = '8.0';
const mysqlVersion = parseFloat(process.env['INPUT_MYSQL-VERSION'] || defaultVersion).toFixed(1);

// TODO make OS-specific
if (!['8.4', '8.0'].includes(mysqlVersion)) {
  throw `MySQL version not supported: ${mysqlVersion}`;
}

const database = process.env['INPUT_DATABASE'];
const user = process.platform == 'win32' ? 'ODBC' : process.env['USER'];

let bin;
let cmdPrefix;

function useTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mysql-'));
  process.chdir(tmpDir);
}

if (process.platform == 'darwin') {
  // install
  run(`brew`, `install`, `--quiet`, `mysql@${mysqlVersion}`);

  // start
  const prefix = process.arch == 'arm64' ? '/opt/homebrew' : '/usr/local';
  bin = `${prefix}/opt/mysql@${mysqlVersion}/bin`;
  run(`${bin}/mysql.server`, `start`);

  // set path
  addToPath(bin);

  cmdPrefix = [`${bin}/mysql`];
} else if (process.platform == 'win32') {
  // install
  const install = mysqlVersion != '8.0';
  if (install) {
    // https://dev.mysql.com/downloads/mysql/
    const versionMap = {
      '8.4': '8.4.3',
      '8.0': '8.0.40'
    };
    const fullVersion = versionMap[mysqlVersion];
    useTmpDir();
    run(`curl`, `-Ls`, `-o`, `mysql.zip`, `https://dev.mysql.com/get/Downloads/MySQL-${mysqlVersion}/mysql-${fullVersion}-winx64.zip`)
    run(`unzip`, `-q`, `mysql.zip`);
    fs.renameSync(`mysql-${fullVersion}-winx64`, `C:\\Program Files\\MySQL\\MySQL Server ${mysqlVersion}`);
  }

  // start
  bin = `C:\\Program Files\\MySQL\\MySQL Server ${mysqlVersion}\\bin`;
  run(`${bin}\\mysqld`, `--initialize-insecure`);
  run(`${bin}\\mysqld`, `--install`);
  run(`net`, `start`, `MySQL`);

  addToPath(bin);

  run(`${bin}\\mysql`, `-u`, `root`, `-e`, `SELECT VERSION()`);

  cmdPrefix = [`${bin}\\mysql`, `-u`, `root`];
} else {
  if (mysqlVersion != '8.0' || process.arch == 'arm64') {
    // install
    useTmpDir();
    // https://dev.mysql.com/downloads/repo/apt/
    run(`wget`, `-q`, `-O`, `mysql-apt-config.deb`, `https://dev.mysql.com/get/mysql-apt-config_0.8.30-1_all.deb`);
    const selections = `mysql-apt-config mysql-apt-config/select-server select mysql-${mysqlVersion}-lts\n`;
    spawnSync(`sudo`, [`debconf-set-selections`], {input: selections});
    run(`sudo`, `dpkg`, `-i`, `mysql-apt-config.deb`);
    // TODO only update single list
    run(`sudo`, `apt-get`, `-qq`, `update`);
    run(`sudo`, `apt-get`, `-qq`, `-o`, `Dpkg::Use-Pty=0`, `install`, `mysql-server`);
  }

  // start
  run(`sudo`, `systemctl`, `start`, `mysql`);

  // remove root password
  run(`sudo`, `mysqladmin`, `-proot`, `password`, ``);

  bin = `/usr/bin`;
  cmdPrefix = [`sudo`, `mysql`];
}

if (user != 'runner' && user != 'ODBC') {
  // TODO fix
  throw `Unsupported user: ${user}`;
}
run(...cmdPrefix, `-e`, `CREATE USER '${user}'@'localhost' IDENTIFIED BY ''`);
run(...cmdPrefix, `-e`, `GRANT ALL PRIVILEGES ON *.* TO '${user}'@'localhost'`);
run(...cmdPrefix, `-e`, `FLUSH PRIVILEGES`);

if (database) {
  run(path.join(bin, 'mysqladmin'), 'create', database);
}
