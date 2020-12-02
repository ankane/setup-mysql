const execSync = require("child_process").execSync;
const fs = require('fs');
const os = require('os');
const path = require('path');
const process = require('process');

function run(command) {
  console.log(command);
  execSync(command, {stdio: 'inherit'});
}

function addToPath(newPath) {
  fs.appendFileSync(process.env.GITHUB_PATH, `${newPath}\n`);
}

const image = process.env['ImageOS'];
const defaultVersion = (process.platform == 'win32' || image == 'ubuntu16' || image == 'ubuntu18') ? '5.7' : '8.0';
const mysqlVersion = parseFloat(process.env['INPUT_MYSQL-VERSION'] || defaultVersion).toFixed(1);

// TODO make OS-specific
if (!['8.0', '5.7', '5.6'].includes(mysqlVersion)) {
  throw `MySQL version not supported: ${mysqlVersion}`;
}

function useTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mysql-'));
  process.chdir(tmpDir);
}

if (process.platform == 'darwin') {
  // install
  run(`brew install mysql@${mysqlVersion}`);

  // start
  const bin = `/usr/local/opt/mysql@${mysqlVersion}/bin`;
  run(`${bin}/mysql.server start`);

  // set path
  run(`echo "${bin}" >> $GITHUB_PATH`);
} else if (process.platform == 'win32') {
  if (mysqlVersion == '5.6') {
    throw `MySQL version not supported for Windows: ${mysqlVersion}`;
  }

  // install
  const versionMap = {
    '8.0': '8.0.22',
    '5.7': '5.7.32',
    '5.6': '5.6.50'
  };
  const fullVersion = versionMap[mysqlVersion];
  useTmpDir();
  run(`curl -Ls -o mysql.zip https://dev.mysql.com/get/Downloads/MySQL-${mysqlVersion}/mysql-${fullVersion}-winx64.zip`)
  run(`unzip -q mysql.zip`);
  fs.mkdirSync(`C:\\Program Files\\MySQL`);
  fs.renameSync(`mysql-${fullVersion}-winx64`, `C:\\Program Files\\MySQL\\MySQL Server ${mysqlVersion}`);

  // start
  const bin = `C:\\Program Files\\MySQL\\MySQL Server ${mysqlVersion}\\bin`;
  run(`"${bin}\\mysqld" --initialize-insecure`);
  run(`"${bin}\\mysqld" --install`);
  run(`net start MySQL`);

  addToPath(bin);

  run(`"${bin}\\mysql" -u root -e "SELECT VERSION()"`);

  // add user
  run(`"${bin}\\mysql" -u root -e "CREATE USER 'ODBC'@'localhost' IDENTIFIED BY ''"`);
  run(`"${bin}\\mysql" -u root -e "GRANT ALL PRIVILEGES ON *.* TO 'ODBC'@'localhost'"`);
  run(`"${bin}\\mysql" -u root -e "FLUSH PRIVILEGES"`);
} else {
  if (image == 'ubuntu20') {
    if (mysqlVersion != '8.0') {
      // install
      run(`sudo apt-get install mysql-server-${mysqlVersion}`);
    }
  } else {
    if (mysqlVersion != '5.7') {
      if (mysqlVersion == '5.6') {
        throw `MySQL version not supported yet: ${mysqlVersion}`;
      }

      // install
      useTmpDir();
      run(`wget -q -O mysql-apt-config.deb https://dev.mysql.com/get/mysql-apt-config_0.8.16-1_all.deb`);
      run(`echo mysql-apt-config mysql-apt-config/select-server select mysql-${mysqlVersion} | sudo debconf-set-selections`);
      run(`sudo dpkg -i mysql-apt-config.deb`);
      // TODO only update single list
      run(`sudo apt-get update`);
      run(`sudo apt-get install mysql-server`);
    }
  }

  // start
  run('sudo systemctl start mysql');

  // remove root password
  run(`sudo mysqladmin -proot password ''`);

  // add user
  run(`sudo mysql -e "CREATE USER '$USER'@'localhost' IDENTIFIED BY ''"`);
  run(`sudo mysql -e "GRANT ALL PRIVILEGES ON *.* TO '$USER'@'localhost'"`);
  run(`sudo mysql -e "FLUSH PRIVILEGES"`);
}
