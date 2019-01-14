const express = require('express');
const redis = require('redis');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const path = require('path');
const Cookies = require('cookies');
const Post = require('./post');

const port = 3000;

//create redis client
let client = redis.createClient();
client.on('connect', () => {
  console.log('Connected to redis...');
});
let publisher = redis.createClient();
let subscriber = redis.createClient();

const app = express();

app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(methodOverride('_method'));

var temp;
var topic;
var title;
var lecture;
var posts = [];
var cnd = true;

//sign in proccessing

app.post('/home', (req, res, next) => {
  if (req.body.register == 'some') {
    //request comes from register form

    if (!req.body.uname || !req.body.passw || !req.body.passw2) {
      res.render('register', {
        error: 'You have to enter all fields in order to create an account!',
      });
      return;
    }

    if (req.body.passw != req.body.passw2) {
      res.render('register', {
        error: 'You have to enter the same password!',
      });
      return;
    }

    var uname = req.body.uname;
    var passw = req.body.passw;
    client.hget('users', uname, (err, obj) => {
      if (obj) {
        res.render('register', {
          error: 'The username is already in use, try another one!',
        });
        return;
      } else {
        client.INCR('next_user_id', (err, objid) => {
          var auth = new Buffer(uname + ':' + passw).toString('base64');
          console.log(auth);
          if (!client.hset('users', uname, objid))
            console.log('Failure during the db write in users');
          if (
            !client.hset('user:' + objid, 'username', uname) ||
            !client.hset('user:' + objid, 'password', passw) ||
            !client.hset('user:' + objid, 'auth', auth)
          )
            console.log('Failure during the db write in user');
          res.render('home', {
            username: uname,
          });
          return;
        });
      }
    });
  }
  //request comes from welcome form
  else if (
    req.body.username.toString() == 'admin' &&
    req.body.password.toString() == 'admin123'
  ) {
    res.render('admin', {
      username: 'admin',
    });
    return;
  } else {
    if (!req.body.username || !req.body.password) {
      res.render('welcome', {
        error: 'You have to enter both , the username and password!',
      });
      return;
    }
    var username = req.body.username;
    var password = req.body.password;
    client.hget('users', username, (err, obj1) => {
      if (!obj1) {
        res.render('welcome', {
          error: 'Wrong username or password!',
        });
      } else {
        client.hget('user:' + obj1, 'password', (err, obj2) => {
          if (obj2 != password) {
            res.render('welcome', {
              error: 'Wrong username or password!',
            });
          } else {
            var cookies = new Cookies(req, res);
            client.hget('user:' + obj1, 'auth', (err, objauth) => {
              cookies.set('auth', objauth);
            });
            temp = username;
            res.render('home', {
              username: username,
            });
            console.log('The content of the cookie:' + cookies.get('auth'));
          }
        });
      }
    });
  }
});

app.post('/admin', (req, res, next) => {
  const { topic, title, lecture } = req.body;

  client.incr('next_post_id', (err, objid) => {
    client.hmset(
      'post:' + objid,
      'topic',
      topic,
      'title',
      title,
      'lecture',
      lecture,
      (err, redisRes) => {
        if (err !== null) {
          console.log('Error while writing to Redis', err);
        } else {
          publisher.publish('math', 'post:' + objid);
          res.json({
            topic,
            title,
            lecture,
          });
        }
      }
    );
  });
});

// Ne sme da bude u okviru rute jer se stalno iznova subscribe-uje i zato dobijas duple vrednosti
subscriber.on('message', (chanel, message) => {
  //to do: if post doesn't exist show the message 'there is no topics yet'
  //list my courses needs to be updated with the subscribed subjects
  //all published posts must be visible in this view
  console.log('The message has arrived' + message);
  client.lpush('posts', message);
  client.lrange('posts', 0, -1, (err, objlist) => {
    //Lista pre popunjavanja mora da se resetuje
    posts = [];
    objlist.forEach((item, index) => {
      var post = new Post.Post();
      client.hgetall(item, (err, obj) => {
        post.Topic = obj.topic;
        post.Title = obj.title;
        post.lecture = obj.lecture;
        posts.push(post);
      });
    });
  });
});

// / get
app.get('/', (req, res, next) => {
  res.render('welcome');
});

//register get

app.get('/register', (req, res, next) => {
  res.render('register');
});

//home get

app.get('/home/math/mathematics', (req, res, next) => {
  /*
              client.get('next_post_id',(err,length)=>{
              var posts=new Array(length);
              for(var i=1;i<=length;i++)
              {
                  var post=new Post.Post();
                  
                  
                  
                  
                  client.hget('post:'+i,'topic',(err,objtop)=>{
                      post.Topic=objtop;
                  });
                  client.hget('post:'+i,'title',(err,objtit)=>{
                      post.Title=objtit;
                  });
                  client.hget('post:'+i,'lecture',(err,objlec)=>{
                      post.Lecture=objlec;
                  });
  
                  posts.push(post);
                  
  
              }
              console.log(posts);
              res.render('mathematics',{
                  posts:posts
              });
  
          });
  
  
  
  */

  /*
          client.hget(message,'topic',(err,obj1)=>{
              topic=obj1;  
          });
          client.hget(message,'title',(err,obj2)=>{
              title=obj2;
          });
          client.hget(message,'lecture',(err,obj3)=>{
              lecture=obj3;
          });
          
          */

  var empty = false;
  if (posts.length == 0) empty = true;
  if (cnd) {
    subscriber.subscribe('math');
    cnd = false;
  }

  res.render('mathematics', {
    username: temp,
    posts: posts,
    empty: empty,
  });
});

app.get('/home', (req, res, next) => {
  res.render('home', {
    username: temp,
  });
});

//home/math get

app.get('/home/math', (req, res, next) => {
  res.render('math', {
    username: temp,
  });
});
//home/history get
app.get('/home/history', (req, res, next) => {
  res.render('history', {
    username: temp,
  });
});

app.get('/home/english', (req, res, next) => {
  res.render('english', {
    username: temp,
  });
});

//home/maths/mathematics get

//admin get
app.get('/admin', (req, res, next) => {
  console.log('posts', posts);
  res.render('admin', {
    username: 'admin',
    posts,
  });
});

//home/adminmath get

app.get('/home/adminmath', (req, res, next) => {
  res.render('adminmath', {
    username: 'admin',
  });
});

//home/adminhistory get

app.get('/home/adminhistory', (req, res, next) => {
  res.render('adminhistory', {
    username: 'admin',
  });
});

//home/adminenglish get

app.get('/home/adminenglish', (req, res, next) => {
  res.render('adminenglish', {
    username: 'admin',
  });
});

app.listen(port, () => {
  console.log(`Listening on port ${port} ...`);
});
