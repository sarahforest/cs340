var express = require('express');
var mysql = require('./dbcon.js');
var bodyParser = require('body-parser');

var app = express();
var path = require('path'); 
var session = require('express-session');

app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: '2C44-4D44-WppQ38S',
    resave: true,
    saveUninitialized: true
}));

var auth = function(req, res, next) {
  //console.log('req.sessions is ', req.session);
  if (req.session && req.session.user && req.session.password && req.session.userid)
    return next();
  else
    return res.sendStatus(401);
};


var handlebars = require('express-handlebars').create({
helpers: {
  ifCond: function(v1,operator,v2,options) {
        switch (operator) {
        case '==':
            return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
            return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
            return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
            return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
            return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
            return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
            return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
            return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
            return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
            return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
            return options.inverse(this);
    }

},
  replaceUnderscore: function(str) {
   return str.replace(/_/g, ' ');
 }
},
defaultLayout:'main'
});


app.engine('handlebars', handlebars.engine);
app.use(bodyParser.urlencoded({extended:true}));

app.set('view engine', 'handlebars');
app.set('port', 3045);


function getInterests(res,mysql,context,complete) {
    mysql.pool.query("SELECT interest_name as name, group_name as interest_groups FROM interests", function(error,results,fields) {
      if(error){
        res.write(JSON.stringify(error));
        res.end(); 
      }
      context.groups.forEach(function(element) {
        element.results = results;
      });
      
      complete();
    });
  }        


function getDistinctGroups(res,mysql,context,complete) {

  mysql.pool.query("SELECT DISTINCT group_name FROM interests", function(error,results,fields) {
         if(error){
                res.write(JSON.stringify(error));
                res.end();
            }
            context.groups  = results;
            
            complete();
        });
}



app.get('/',function(req,res){
var callbackCount = 0;  
var context = {};

  getDistinctGroups(res, mysql, context, complete);
  getInterests(res, mysql, context, complete);        

function complete(){
            callbackCount++;
            if(callbackCount >= 2){
                res.render('home', context);
            }

        }
}
);
app.post('/add-user',function(req,res){

mysql.pool.query("INSERT INTO accounts (first_name, last_name, email, password, social_media_account, gender, zip_code, birthdate) VALUES (?,?,?,?,?,?,?,?)",
[req.body.first_name, req.body.last_name, req.body.email, req.body.password, req.body.social_media_account, req.body.gender, req.body.zip_code, req.body.birthdate],
function(err,result) {
if (err) {
  console.log(JSON.stringify(err));
  res.write(JSON.stringify(err));
  res.end();
} else {
    var accountId = result.insertId;
    req.session.user = req.body.email;
    req.session.password = req.body.password;
    req.session.userid = accountId;
    console.log('profile id is ', accountId);
    mysql.pool.query("SELECT * from accounts WHERE id=" + mysql.pool.escape(accountId),
    function(err,result) {
      if (err) {
        console.log(JSON.stringify(err));
        res.write(JSON.stringify(err));
        res.end();
      } 
    });
    var ids = req.body.interest_name;
    console.log('ids is ', ids);

    if (!Array.isArray(ids)) {
      var newArr=[];
      newArr.push(ids);
      ids=newArr;
    }
    ids.forEach(function(element) {
    mysql.pool.query("SELECT id FROM interests WHERE interest_name=" + mysql.pool.escape(element),
      function(err,result) {
        if(err) {
          console.log(JSON.stringify(err));
          res.write(JSON.stringify(err));
          res.end();
        } else {
        var interest_id=result[0].id;
        console.log('interest_id is ', interest_id);
        mysql.pool.query("INSERT INTO accounts_interests (account_id, interest_id) VALUES (?,?)",
        [accountId, interest_id],
        function(err,result) {
         if (err) {
          console.log(JSON.stringify(err));
          res.write(JSON.stringify(err));
          res.end();
         } else {
         console.log("success adding new account_interest)");
         }
        });

        }
       });
     });

      res.redirect('/profile');
    }

});
});

app.post('/get-user',function(req,res){

  mysql.pool.query("SELECT * from accounts WHERE email=" + mysql.pool.escape(req.body.email) + " AND password=" + mysql.pool.escape(req.body.password),
  function(err,result) {
   if (err) {
     console.log(JSON.stringify(err));
   } else {
    if (result.length > 0) {
      console.log('id is ', result[0].id);
      req.session.user = req.body.email;
      req.session.password = req.body.password;
      req.session.userid = result[0].id;
          res.redirect('/profile');
     
    } else {
      console.log('No match');
      res.render('login', {
        errors: 'Username or password does not match our records. Please try again.',
      });
    }
   }
  });
  });

app.get('/login',function(req,res){
    res.render('login');
});

app.get('/event',auth,function(req,res){
  res.render('event');
});

app.get('/review',auth,function(req,res){
  res.render('review');
});



function getUserInfo(res,mysql,context,complete,req) {
var sess= req.session;
    mysql.pool.query("SELECT * from accounts WHERE id=" + mysql.pool.escape(sess.userid),
     function(error,results,fields) {
      if(error){
        res.write(JSON.stringify(error));
        res.end(); 
      }
      var res = results[0];

      context.results.id = res.id;
      context.results.first_name = res.first_name ;
      context.results.last_name = res.last_name ;
      context.results.email = res.email;
      context.results.password = res.password;
      context.results.social_media_account = res.social_media_account;

      (res.gender == '1') ? res.gender='Male' : res.gender='Female';

      context.results.gender = res.gender;
      context.results.zip_code = res.zip_code;

      var myDate = res.birthdate.toISOString().split('T')[0];
      
      var myYear = myDate.slice(0, 4);
      var myMonth = myDate.slice(5,7);
      var myDay = myDate.slice(8,10);

      context.results.birthdate = myMonth + '/' + myDay + '/' + myYear;

      //console.log('context is ', context);
      complete();
    });
  }

function getUserInterests(res,mysql,context,complete,req) {
  var sess = req.session;
  mysql.pool.query("SELECT interest_name FROM accounts LEFT JOIN accounts_interests ON accounts.id = accounts_interests.account_id LEFT JOIN interests ON interests.id=accounts_interests.interest_id WHERE accounts.id=" + mysql.pool.escape(sess.userid),
     function(error,results,fields) {
      if(error){
        res.write(JSON.stringify(error));
        res.end(); 
      }
      var myArr = results;
     
      myArr.forEach(function(element) {
      console.log('element is ', element.interest_name);
      context.results.interests.push(element.interest_name);
      
    });
      complete();
      });
}

function getFollowers(res,mysql,context,complete,req) {
  var sess = req.session;
  mysql.pool.query("SELECT COUNT(follows_id) as count FROM followers WHERE follows_id=" + mysql.pool.escape(sess.userid),
     function(error,results,fields) {
      if(error){
        res.write(JSON.stringify(error));
        res.end(); 
      }
      console.log('results is ', results);
      context.results.followers = results[0].count;
      complete();
  });
}

app.get('/profile',auth, function(req,res){
var callbackCount = 0;  
var context = {};
context.results = {};
context.results.interests = [];
  getUserInfo(res, mysql, context, complete,req);
  getUserInterests(res, mysql, context, complete, req);
  getFollowers(res,mysql,context,complete,req);    

console.log('after user interests context is ', context);
function complete(){
            callbackCount++;
            if(callbackCount >= 3){
              console.log('about to render profile page');
                res.render('profile', context);
            }

        }
}
);

app.use(function(req,res){
  res.status(404);
  res.render('404');
});

app.use(function(err, req, res, next){
  console.error(err.stack);
  res.type('plain/text');
  res.status(500);
  res.render('500');
});

app.listen(app.get('port'), function(){
  console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
});
