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
      if (str)
     return str.replace(/_/g, ' ');
   }
  },
  defaultLayout:'main'
  });


  app.engine('handlebars', handlebars.engine);
  app.use(bodyParser.urlencoded({extended:true}));

  app.set('view engine', 'handlebars');
  app.set('port', 3085);


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

  
  function complete(){
              callbackCount++;
              if (callbackCount == 1) {
                getInterests(res, mysql, context, complete);  
              }
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
      //console.log('profile id is ', accountId);
      mysql.pool.query("SELECT * from accounts WHERE id=" + mysql.pool.escape(accountId),
      function(err,result) {
        if (err) {
          console.log(JSON.stringify(err));
          res.write(JSON.stringify(err));
          res.end();
        } 
      });
      var ids = req.body.interest_name;
     // console.log('ids is ', ids);

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
          if (result[0]) {
             var interest_id=result[0].id;
         // console.log('interest_id is ', interest_id);
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
        // console.log('id is ', result[0].id);
        req.session.user = req.body.email;
        req.session.password = req.body.password;
        req.session.userid = result[0].id;
            res.redirect('/profile');
       
      } else {
        // console.log('No match');
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


  app.post('/add-review',function(req,res){
  var dateNow = new Date();
  mysql.pool.query("SELECT attendee_id FROM event_attendees WHERE is_host=1 AND event_id=" + mysql.pool.escape(req.body.event_id),
    function(err,result) {  
     if (err) {
       console.log(JSON.stringify(err));
     } else {
      var host_id = result[0].attendee_id;
     // console.log('host_id is ', host_id);
      mysql.pool.query("INSERT INTO reviews (reviewer_id, host_id, event_id, date_time, rating, comments) VALUES (?,?,?,?,?,?)",
      [req.body.reviewer_id, host_id, req.body.event_id, dateNow, req.body.rating, req.body.comments],
        function(err,result) {
         if (err) {
          console.log('error');
          console.log(JSON.stringify(err));
          } else {  
          var accountId = result.insertId;
          //console.log('inserted id is ', accountId);
           res.redirect('/review');
          } 
        });
      }
    });
  });


  app.post('/update-name',function(req,res){

  mysql.pool.query("UPDATE `accounts` SET `first_name`=" + mysql.pool.escape(req.body.update_firstName) + ", `last_name` =" + mysql.pool.escape(req.body.update_lastName) +" WHERE `id` =" + mysql.pool.escape(req.body.update_userId),
    function(err,result) {  
     if (err) {
       console.log(JSON.stringify(err));
     } else {
           res.redirect('/profile');
      } 
    });
  });

  function getUserEvents(res,mysql,context,complete,req) {
    var sess=req.session;
    mysql.pool.query("SELECT events.*, event_attendees.is_host FROM events LEFT JOIN event_attendees ON events.id = event_attendees.event_id WHERE event_attendees.attendee_id=" + mysql.pool.escape(sess.userid), function(error,results,fields) {
           if(error){
                  res.write(JSON.stringify(error));
                  res.end();
              }
             // console.log('results is ', results);
              context.userEvents = results;
              complete();
          });
  }

  function getCountAttendees(res,mysql,context,complete) {
    //console.log(context.userEvents);
    context.userEvents.forEach(function (element) {
        mysql.pool.query("SELECT COUNT(attendee_id) as numAttendees FROM event_attendees where event_id=" + mysql.pool.escape(element.id), function(error,results,fields) {
           if(error){
                  res.write(JSON.stringify(error));
                  res.end();
              }
              //console.log('element.id is ', element.id);
             // console.log('results is ', results);
              //context.numAttendees  = results;
              element.numAttendees = results[0].numAttendees;
              //console.log('context', context);
            
          });
    });

    complete();
  }

  function getOtherEvents(res,mysql,context,complete,req) {
    var sess=req.session;
   
    mysql.pool.query("(SELECT e.* FROM events e LEFT JOIN event_attendees ea ON e.id=ea.event_id WHERE e.id NOT IN (SELECT event_attendees.event_id FROM event_attendees WHERE attendee_id =" + mysql.pool.escape(req.session.userid) + ") AND e.date_time > CURRENT_TIMESTAMP) UNION (SELECT e.* FROM events e LEFT JOIN event_attendees ea ON e.id=ea.event_id WHERE e.id NOT IN (SELECT event_attendees.event_id FROM event_attendees WHERE attendee_id =" + mysql.pool.escape(req.session.userid) + ") AND e.date_time > CURRENT_TIMESTAMP)", function(error,results,fields) {
           if(error){
                  res.write(JSON.stringify(error));
                  res.end();
              }

            //  console.log('Results after getOther events is ', results);
              context.otherEvents = results;
            
              complete();
          });
  }



  function getAttendeesNames(res,mysql,context,complete,req) {
   // console.log('req is ', req);
    var sess = req.session;
    context.userEvents.forEach(function (element) {
        mysql.pool.query("SELECT accounts.id, accounts.first_name, accounts.last_name, event_attendees.is_host from accounts left join event_attendees on event_attendees.attendee_id=accounts.id WHERE event_id=" + mysql.pool.escape(element.id), function(error,results1,fields) {
           if(error){
                  res.write(JSON.stringify(error));
                  res.end();
              }
             
              //console.log('results is ', results1);
              element.userId = sess.userid;
              element.attendees = results1;
           
             // console.log('context get attendees name', context);

               mysql.pool.query("SELECT follows_id from followers WHERE account_id=" + mysql.pool.escape(sess.userid), function(error,results,fields) {
                  if(error){
                    res.write(JSON.stringify(error));
                    res.end();
                  }
                  // console.log('\n\n\n\nresults of followers ', results);
                  element.followers = results;
                  arr = [];
                  results.forEach(function (obj) {
                    arr.push(obj.follows_id)
                  })


                  element.attendees.forEach(function (attendee) {
                    //console.log(arr.includes(attendee.id));
                

                    if (!arr.includes(attendee.id)) {
                      attendee.can_follow = 1;
                    } else if (attendee.id == req.session.userid) {
                      attendee.can_follow = 0;
                    } else {
                      attendee.can_follow = 0;
                    }
                    attendee.userId = req.session.userid;
                    attendee.eventId = element.id;
                    //console.log('attendee is ', attendee);
                  })


                  
              
             });
          });
    });

    setTimeout(function () {
    complete();
}, 1000); 
    
  }



  function checkIfIsPast(res,context,complete) {
    var currentDateTime = Date.now()
    //console.log('current data time is ', currentDateTime);

    context.userEvents.forEach(function(element) {
      // console.log('element.date_time is ', element.date_time)
      if (currentDateTime > element.date_time) {
        element.is_past = 1;
      } else {
        element.is_past = 0;
      }
    })

    //console.log('context after check past is ', context);
    complete();
  }

    app.post('/add-new-event',function(req,res) {

         mysql.pool.query("INSERT INTO events (name, date_time, event_street, event_city, event_state, event_zip_code) VALUES (?,?,?,?,?,?)",
          [req.body.name, req.body.date_time, req.body.event_street, req.body.event_city, req.body.event_state, req.body.event_zip_code],
          function(error,results,fields) {
           if(error){
                  res.write(JSON.stringify(error));
                  res.end();
              }
             // console.log('element.id is ', element.id);
             var eventId = results.insertId;
             mysql.pool.query("INSERT INTO event_attendees (event_id, attendee_id, is_host) VALUES (?,?,?)",
              [eventId, req.session.userid, "1"],
              function(error,results,fields) {
                if(error){
                  res.write(JSON.stringify(error));
                  res.end();
              }
              res.redirect('/event');
               });
            
          });
  
  });


  app.post('/remove-attendee',function(req,res) {

         mysql.pool.query("DELETE from event_attendees WHERE event_id= ? AND attendee_id = ?",
          [req.body.event_id, req.body.attendee_id],
          function(error,results,fields) {
           if(error){
                  res.write(JSON.stringify(error));
                  res.end();
              }
          });
    res.redirect('/event');
  });

    app.post('/follow',function(req,res) {
         mysql.pool.query("INSERT INTO followers (account_id,follows_id) VALUES (?,?)",
          [req.session.userid, req.body.follows_id],
          function(error,results,fields) {
           if(error){
                  res.write(JSON.stringify(error));
                  res.end();
              }
          });
    res.redirect('/event');
  });

        app.post('/unfollow',function(req,res) {
         mysql.pool.query("DELETE FROM followers WHERE account_id=? AND follows_id=?",
          [req.session.userid, req.body.follows_id],
          function(error,results,fields) {
           if(error){
                  res.write(JSON.stringify(error));
                  res.end();
              }
          });
    res.redirect('/event');
  });


  app.post('/attend-event',function(req,res) {
    mysql.pool.query("INSERT INTO event_attendees (event_id, attendee_id, is_host) VALUES (?,?,?)",
      [req.body.id, req.session.userid, "0"],
      function(error,results,fields) {
        if(error){
          res.write(JSON.stringify(error));
          res.end();
        }
        res.redirect('/event');
      });      
  });
  

  app.get('/event',auth,function(req,res){
  var callbackCount = 0;  
  var context = {};
  context.userEvents = {};
  context.userEvents.attendees = [];
  context.userEvents.followers = [];

  context.otherEvents = [];
  getUserEvents(res, mysql, context, complete, req);


  function complete(){
              callbackCount++;
              if (callbackCount == 1) {
                getCountAttendees(res,mysql,context,complete)
              } else if (callbackCount == 2) {
                checkIfIsPast(res,context,complete)
              } else if (callbackCount == 3) {
                getAttendeesNames(res,mysql,context,complete,req)
              } else if (callbackCount == 4) {
                //console.log('user events after attendees names is ', context.userEvents);
                getOtherEvents(res,mysql,context,complete,req)
              } else if (callbackCount >= 5){
               // console.log('context.otherEvents',context.otherEvents);
                  res.render('event', context);
              }

          }

  });

  app.get('/review',auth,function(req,res){
   var callbackCount = 0;  
  var context = {};
  context.userEvents = {};

  getUserEvents(res, mysql, context, complete, req);


  function complete(){
              callbackCount++;
              if (callbackCount == 1) {
                checkIfIsPast(res,context,complete);
              } else if (callbackCount == 2) {
                getAttendeesNames(res,mysql,context,complete,req)
              }
               else if (callbackCount >= 3){
                  res.render('review', context);
              }
              
            }
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
        //console.log('element is ', element.interest_name);
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
       // console.log('results is ', results);
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

  //console.log('after user interests context is ', context);
  function complete(){
              callbackCount++;
              if(callbackCount >= 3){
               // console.log('about to render profile page');
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




