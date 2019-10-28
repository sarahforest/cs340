var mysql = require('mysql');
var pool = mysql.createPool({
  connectionLimit : 10,
  host            : 'classmysql.engr.oregonstate.edu',
  user            : 'cs340_forests',
  password        : '3060',
  database        : 'cs340_forests'
});
module.exports.pool = pool;
