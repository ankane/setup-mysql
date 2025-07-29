const fs = require('fs');
const os = require('os');
const path = require('path');
const spawnSync = require('child_process').spawnSync;

const cmdEnv = Object.assign({}, process.env);
cmdEnv.HOMEBREW_NO_AUTO_UPDATE = '1';
cmdEnv.HOMEBREW_NO_INSTALL_CLEANUP = '1';

function run() {
  const args = Array.from(arguments);
  console.log(args.map(v => v.toString().includes(' ') ? `"${v}"` : v).join(' '));
  const command = args.shift();
  // spawn is safer and more lightweight than exec
  const ret = spawnSync(command, args, {stdio: 'inherit', env: cmdEnv});
  if (ret.status !== 0) {
    throw ret.error;
  }
}

function addToPath(newPath) {
  fs.appendFileSync(process.env.GITHUB_PATH, `${newPath}\n`);
  for (const k of Object.keys(cmdEnv)) {
    console.log(k);
  }
  console.log(cmdEnv.Path);
  cmdEnv.PATH += `${path.delimiter}${newPath}`;
}

function isMac() {
  return process.platform == 'darwin';
}

function isWindows() {
  return process.platform == 'win32';
}

const image = process.env['ImageOS'];
const defaultVersion = '8.0';
const mysqlVersion = parseFloat(process.env['INPUT_MYSQL-VERSION'] || defaultVersion).toFixed(1);

// TODO make OS-specific
if (!['8.4', '8.0'].includes(mysqlVersion)) {
  throw `MySQL version not supported: ${mysqlVersion}`;
}

const database = process.env['INPUT_DATABASE'];
const defaultUser = isWindows() ? 'ODBC' : os.userInfo().username;
const user = process.env['INPUT_USER'] || defaultUser;
if (!/^[a-z0-9_-]+$/i.test(user)) {
  throw `Unsupported user: ${user}`;
}
const userExists = user == 'root';

let cmdPrefix;

function useTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mysql-'));
  process.chdir(tmpDir);
}

if (isMac()) {
  // install
  run(`brew`, `install`, `--quiet`, `mysql@${mysqlVersion}`);

  // set path
  const prefix = process.arch == 'arm64' ? '/opt/homebrew' : '/usr/local';
  addToPath(`${prefix}/opt/mysql@${mysqlVersion}/bin`);

  // start
  run(`mysql.server`, `start`);

  cmdPrefix = [`mysql`];
} else if (isWindows()) {
  // install
  const install = mysqlVersion != '8.0';
  if (install) {
    // https://dev.mysql.com/downloads/mysql/
    const versionMap = {
      '8.4': '8.4.6',
      '8.0': '8.0.43'
    };
    const fullVersion = versionMap[mysqlVersion];
    useTmpDir();
    run(`curl`, `-Ls`, `-o`, `mysql.zip`, `https://dev.mysql.com/get/Downloads/MySQL-${mysqlVersion}/mysql-${fullVersion}-winx64.zip`)
    run(`unzip`, `-q`, `mysql.zip`);
    fs.renameSync(`mysql-${fullVersion}-winx64`, `C:\\Program Files\\MySQL\\MySQL Server ${mysqlVersion}`);
  }

  // set path
  addToPath(`C:\\Program Files\\MySQL\\MySQL Server ${mysqlVersion}\\bin`);

  // start
  run(`mysqld`, `--initialize-insecure`);
  run(`mysqld`, `--install`);
  run(`net`, `start`, `MySQL`);

  cmdPrefix = [`mysql`, `-u`, `root`];
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

  cmdPrefix = [`sudo`, `mysql`];
}

if (!userExists) {
  run(...cmdPrefix, `-e`, `CREATE USER '${user}'@'localhost' IDENTIFIED BY ''`);
  run(...cmdPrefix, `-e`, `GRANT ALL PRIVILEGES ON *.* TO '${user}'@'localhost'`);
  run(...cmdPrefix, `-e`, `FLUSH PRIVILEGES`);
}

if (database) {
  run('mysqladmin', `-u`, user, `create`, database);
}
