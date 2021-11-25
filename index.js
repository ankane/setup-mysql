const execSync = require("child_process").execSync;
const fs = require('fs');
const os = require('os');
const path = require('path');
const process = require('process');
const spawnSync = require('child_process').spawnSync;

function run(command) {
  console.log(command);
  let env = Object.assign({}, process.env);
  delete env.CI; // for Homebrew on macos-11.0
  execSync(command, {stdio: 'inherit', env: env});
}

function copyFileSync( source, target ) {
    // Source https://stackoverflow.com/a/26038979/2127939
    var targetFile = target;

    // If target is a directory, a new file with the same name will be created
    if ( fs.existsSync( target ) ) {
        if ( fs.lstatSync( target ).isDirectory() ) {
            targetFile = path.join( target, path.basename( source ) );
        }
    }

    fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync( source, target ) {
    // Source https://stackoverflow.com/a/26038979/2127939
    var files = [];

    // Check if folder needs to be created or integrated
    var targetFolder = path.join( target, path.basename( source ) );
    if ( !fs.existsSync( targetFolder ) ) {
        fs.mkdirSync( targetFolder );
    }

    // Copy
    if ( fs.lstatSync( source ).isDirectory() ) {
        files = fs.readdirSync( source );
        files.forEach( function ( file ) {
            var curSource = path.join( source, file );
            if ( fs.lstatSync( curSource ).isDirectory() ) {
                copyFolderRecursiveSync( curSource, targetFolder );
            } else {
                copyFileSync( curSource, targetFolder );
            }
        } );
    }
}

function integrateFolderRecursiveSync(source, target) {
    var files = [];

    // Check if folder needs to be created or integrated
    var targetFolder = target;
    if ( !fs.existsSync( targetFolder ) ) {
        fs.mkdirSync( targetFolder );
    }
        // Copy
    if ( fs.lstatSync( source ).isDirectory() ) {
        files = fs.readdirSync( source );
        files.forEach( function ( file ) {
            var curSource = path.join( source, file );
            if ( fs.lstatSync( curSource ).isDirectory() ) {
                copyFolderRecursiveSync( curSource, targetFolder );
            } else {
                copyFileSync( curSource, targetFolder );
            }
        } );
    }
}

function runSafe() {
  const args = Array.from(arguments);
  const command = args.shift();
  // spawn is safer and more lightweight than exec
  const ret = spawnSync(command, args, {stdio: 'inherit'});
  if (ret.status !== 0) {
    throw ret.error;
  }
}

function checkInstalled(package) {
  command = "dpkg -l | grep " + package;
  const args = Array.from(arguments);
  let env = Object.assign({}, process.env);
  delete env.CI; // for Homebrew on macos-11.0
  const ret = execSync(command).toString();
  return !ret || ret !== ""; 
}

function addToPath(newPath) {
  fs.appendFileSync(process.env.GITHUB_PATH, `${newPath}\n`);
}

const image = process.env['ImageOS'];
const defaultVersion = (image == 'ubuntu16' || image == 'ubuntu18') ? '5.7' : '8.0';
const mysqlVersion = parseFloat(process.env['INPUT_MYSQL-VERSION'] || defaultVersion).toFixed(1);
const username = process.env['INPUT_USERNAME'] || "";
const password = process.env['INPUT_PASSWORD'] || "";
const mysqlInstallDirectory = process.env['INPUT_install-directory'] || "";
// TODO make OS-specific
if (!['8.0', '5.7', '5.6'].includes(mysqlVersion)) {
  throw `MySQL version not supported: ${mysqlVersion}`;
}

const database = process.env['INPUT_DATABASE'];

let bin;

function useTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mysql-'));
  process.chdir(tmpDir);
}

function installMac() {
  // install
  run(`brew install mysql@${mysqlVersion}`);

  // start
  bin = `/usr/local/opt/mysql@${mysqlVersion}/bin`;
  run(`${bin}/mysql.server start`);

  // add user
  if(username && username !== "") {
    run(`${bin}/mysql -e "CREATE USER '${username}'@'localhost' IDENTIFIED BY '${password}'"`);
    run(`${bin}/mysql -e "GRANT ALL PRIVILEGES ON *.* TO '${username}'@'localhost'"`);
    run(`${bin}/mysql -e "FLUSH PRIVILEGES"`);
  }
  // set path
  addToPath(bin);
  return bin;
}

function installWindwos() {
 // install
  const versionMap = {
    '8.0': '8.0.27',
    '5.7': '5.7.36',
    '5.6': '5.6.51'
  };
  bin = `${mysqlInstallDirectory}\\bin`;
  if (! fs.existsSync(mysqlInstallDirectory)) {
    const fullVersion = versionMap[mysqlVersion];
    useTmpDir();
    run(`curl -Ls -o mysql.zip https://dev.mysql.com/get/Downloads/MySQL-${mysqlVersion}/mysql-${fullVersion}-winx64.zip`)
    run(`unzip -q mysql.zip`);
    integrateFolderRecursiveSync(`mysql-${fullVersion}-winx64`, mysqlInstallDirectory);

    // start
    if (mysqlVersion != '5.6') {
      run(`"${bin}\\mysqld" --initialize-insecure`);
    }
    run(`"${bin}\\mysqld" --install`);
    run(`net start MySQL`);
    addToPath(bin);
    // create windows only user odbc
    run(`"${bin}\\mysql" -u root -e "CREATE USER 'ODBC'@'localhost' IDENTIFIED BY ''"`);
    run(`"${bin}\\mysql" -u root -e "GRANT ALL PRIVILEGES ON *.* TO 'ODBC'@'localhost'"`);
    run(`"${bin}\\mysql" -u root -e "FLUSH PRIVILEGES"`);
  }

  run(`"${bin}\\mysql" -u root -e "SELECT VERSION()"`);

  // add user
  if(username && username !== "") {
    run(`"${bin}\\mysql" -u root -e "CREATE USER '${username}'@'localhost' IDENTIFIED BY '${password}'"`);
    run(`"${bin}\\mysql" -u root -e "GRANT ALL PRIVILEGES ON *.* TO '${username}'@'localhost'"`);
    run(`"${bin}\\mysql" -u root -e "FLUSH PRIVILEGES"`);
  }
  return bin;
}

function installLinux() {
    // check if it is installed
  if(!checkInstalled("mysql-server-${mysqlVersion}")) {
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
  }

  // start
  run('sudo systemctl start mysql');

  // remove root password
  try {
    run(`sudo mysqladmin -proot password ''`);
  } catch (error) {
    console.error("error on remove password: ", error);
  }

  // add user
  if(username && username !== "") {
    run(`sudo mysql -e "CREATE USER '${username}'@'localhost' IDENTIFIED BY '${password}'"`);
    run(`sudo mysql -e "GRANT ALL PRIVILEGES ON *.* TO '${username}'@'localhost'"`);
    run(`sudo mysql -e "FLUSH PRIVILEGES"`);
  }
  bin = `/usr/bin`;
  return bin;
}


if (process.platform == 'darwin') {
  bin = installMac();
} else if (process.platform == 'win32') {
  bin = installWindwos();
} else if (process.platform == 'linux') {
  bin = installLinux();
} else {
  console.error(process.platform + " is not supported");
}

if (database) {
try {
  run(path.join(bin, 'mysqladmin'), ' -u root create', database);
} catch (error) {
  console.error("error on create database: ", error);
}
  
}
