const execSync = require("child_process").execSync;

function run(command) {
  console.log(command);
  execSync(command, {stdio: 'inherit'});
}

const mysqlVersion = parseFloat(process.env['INPUT_MYSQL-VERSION'] || 8);

if (![8].includes(mysqlVersion)) {
  throw 'Invalid MySQL version: ' + mysqlVersion;
}

if (process.platform == 'darwin') {
  const bin = '/usr/local/opt/mysql@' + mysqlVersion + '/bin';
  if (mysqlVersion != 8) {
    run('brew install mysql@' + mysqlVersion);
  }
  run(bin + '/mysql.server start');
} else {
  run('sudo service mysql start');
  run(`sudo mysqladmin -proot password ''`);
  run(`sudo mysql -e "CREATE USER '$USER'@'localhost' IDENTIFIED BY ''`);
  run(`sudo mysql -e "GRANT ALL PRIVILEGES ON *.* TO '$USER'@'localhost'`);
  run(`sudo mysql -e "FLUSH PRIVILEGES"`);
}
