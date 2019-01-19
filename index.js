const express= require('express');
const redis=require('redis');
const exphbs=require('express-handlebars');
const bodyParser=require('body-parser');
const methodOverride=require('method-override');
const path=require('path');
const Cookies =require('cookies');
const Post=require('./post');




const port=3000;

//create redis client
let client =redis.createClient();
client.on('connect',()=> {
    console.log('Connected to redis...');
});
let publisher=redis.createClient();
let subscriber=redis.createClient();
let subscriber2=redis.createClient();
let subscriber3=redis.createClient();

const app=express();

app.engine('handlebars',exphbs({defaultLayout:'main'}));
app.set('view engine','handlebars');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));

app.use(methodOverride('_method'));

var temp;
var topic;
var title;
var lecture;
var postsMath=new Array();
var postsHistory=new Array();
var postsEnglish=new Array();
var myCourses=new Array();
var cnd=true;


//sign in proccessing

app.post('/home',(req,res,next)=>{
    if(req.body.register =='some')
    {
        //request comes from register form
        
        if(!req.body.uname || !req.body.passw || !req.body.passw2)
{
    res.render('register', {
        error: 'You have to enter all fields in order to create an account!'
    });
    return;
}

    if(req.body.passw != req.body.passw2)
{
        res.render('register', {
        error: 'You have to enter the same password!'
    });
    return;
        
}

    var uname=req.body.uname;
    var passw=req.body.passw;
    client.hget('users',uname,(err,obj)=>{

        if(obj)
    {
            res.render('register', {
            error: 'The username is already in use, try another one!'
        });
        return;

    }
    
    else
    {
        client.INCR('next_user_id', (err,objid) => {
           var auth = new Buffer(uname + ':' + passw).toString('base64'); 
           console.log(auth);
           if(!client.hset('users',uname,objid))
           console.log('Failure during the db write in users');
           if(!client.hset('user:'+objid,'username',uname) || 
           !client.hset('user:'+objid,'password',passw) || !client.hset('user:'+objid,'auth',auth))
           console.log('Failure during the db write in user');
           res.render('home',{
               username:uname
           });
           return;
           

        });
    }

    });
   


}
//request comes from welcome form
else if(req.body.username.toString()=='admin' && req.body.password.toString()=='admin123')
{
    res.render('admin', {
        username:'admin'
    });
    return;

}
else
{
    
    if(!req.body.username || !req.body.password)
    {
    res.render('welcome', {
        error: 'You have to enter both , the username and password!'
    });
    return;
    }
    var username=req.body.username;
    var password=req.body.password;
    client.hget('users',username,(err,obj1)=>{

        
        if(!obj1)
        {
            res.render('welcome', {
                error: 'Wrong username or password!'
            });
        }
        else
        {
            client.hget('user:'+obj1,'password',(err,obj2)=>{
                if(obj2 != password)
                {
                    res.render('welcome', {
                        error:'Wrong username or password!'
                    });
                }
                else
                {
                        
                     var cookies=new Cookies(req,res);
                     client.hget('user:'+obj1,'auth',(err,objauth)=>{
                         cookies.set('auth',objauth);
                         
                     });
                     temp=username;
                     res.render('home',{
                     username:username
            });
                     console.log('The content of the cookie:'+cookies.get('auth'));
                }
            })
        }
    })
           
}
    
    
});

app.post('/admin',(req,res,next)=>{
    topic=req.body.topic;
    title=req.body.title;
    lecture=req.body.lecture;
    var hidden=req.body.hidden;
  
      client.INCR('next_post_id',(err,objid)=>{
        console.log('next_post_id:'+objid);
        if(!client.hmset('post:'+objid,'topic',topic,'title',title,'lecture',lecture))
        console.log('Failure during db write post!');
        switch(hidden)
        {
            case 'math':
            publisher.publish('math','post:'+objid);
            break;
            case 'history':
            publisher.publish('history','post:'+objid);
            break;
            case 'english':
            publisher.publish('english','post:'+objid);
            default: console.log('The hidden is unknown!');
        }
        
        


    });
    res.render('admin',{
            username:'admin',
            topic:topic,
            title:title,
            lecture:lecture
        }); 
});



// / get
app.get('/',(req,res,next)=>{

    res.render('welcome');
});

//register get

app.get('/register',(req,res,next)=>{

    res.render('register');
});

//home get

app.get('/home',(req,res,next)=>{

    res.render('home', {
        username: temp,
        myCourses:myCourses
    });
})

//home/math get

app.get('/home/math',(req,res,next)=>{
    res.render('math',{
        username:temp,
        myCourses:myCourses
    });

});
//home/history get
app.get('/home/history',(req,res,next)=>{
    res.render('history',{
        username:temp,
        myCourses:myCourses
    });
});

app.get('/home/english',(req,res,next)=>{

    res.render('english',{
        username:temp,
        myCourses:myCourses
    });
});

app.get('/home/about',(req,res,next)=>{
    res.render('about',{
        username:temp,
        myCourses:myCourses
    });
});


//subscriber proccessing
//problem solved by kicking this code out of get requrest handler
    subscriber.on("message",(chanel,message)=>{
        console.log('The message has arrived'+message);
        client.lpush('posts_math',message);
        client.lrange('posts_math',0,-1,(err,objlist)=>{
            console.log(objlist);
            postsMath=new Array(objlist.length);
           // posts.length=objlist.length;
            objlist.forEach((item,index)=>{
                
                 var post=new Post.Post();    
                 client.hgetall(item,(err,obj)=>{
                     post.Topic=obj.topic;
                     post.Title=obj.title;
                     post.Lecture=obj.lecture;
                     postsMath.push(post);
                     
                     

                 });
               
                
            });


            
           
        });

    });

    subscriber2.on('message',(chanel,message)=>{

        console.log('The message has arrived'+message);
        client.lpush('posts_history',message);
        client.lrange('posts_history',0,-1,(err,objlist)=>{
            console.log(objlist);
            postsHistory=new Array(objlist.length);
           // posts.length=objlist.length;
            objlist.forEach((item,index)=>{
                
                 var post=new Post.Post();    
                 client.hgetall(item,(err,obj)=>{
                     post.Topic=obj.topic;
                     post.Title=obj.title;
                     post.Lecture=obj.lecture;
                     postsHistory.push(post);
                     
                     

                 });
               
                
            });


            
           
        });

    });

    subscriber3.on('message',(chanel,message)=>{

        console.log('The message has arrived'+message);
        client.lpush('posts_english',message);
        client.lrange('posts_english',0,-1,(err,objlist)=>{
            console.log(objlist);
            postsEnglish=new Array(objlist.length);
           // posts.length=objlist.length;
            objlist.forEach((item,index)=>{
                
                 var post=new Post.Post();    
                 client.hgetall(item,(err,obj)=>{
                     post.Topic=obj.topic;
                     post.Title=obj.title;
                     post.Lecture=obj.lecture;
                     postsEnglish.push(post);
                     
                     

                 });
               
                
            });


            
           
        });

    });

 app.get('/home/history/hist',(req,res,next)=>{
        var empty=false;
        if(postsHistory.length==0)
        empty=true;
        subscriber2.subscribe('history');
        var push=true;
        myCourses.forEach((item)=>{
            if(item.name=='History')
            push=false;

        });
        if(push)
        {
            myCourses.push({name:'History',link:'/home/history/hist'});
        }
        
     res.render('hist',{
         username:temp,
         posts:postsHistory,
         empty:empty,
         myCourses:myCourses
     });
 });

 app.get('/home/english/eng',(req,res,next)=>{
        var empty=false;
        if(postsEnglish.length==0)
        empty=true;
        subscriber3.subscribe('english');
        var push=true;
        myCourses.forEach((item)=>{
            if(item.name=='English')
            push=false;

        });
        if(push)
        {
            myCourses.push({name:'English',link:'/home/english/eng'});
        }
        
     res.render('eng',{
         username:temp,
         posts:postsEnglish,
         empty:empty,
         myCourses:myCourses
     });
 });



//home/maths/mathematics get

app.get('/home/math/mathematics',(req,res,next)=>{

        
        var empty=false;
        if(postsMath.length==0)
        empty=true;
       
        subscriber.subscribe('math');
        var push=true;
        myCourses.forEach((item)=>{
            if(item.name=='Math')
            push=false;

        });
        if(push)
        {
            myCourses.push({name:'Math',link:'/home/math/mathematics'});
        }
        
            
             
        
       
        
        res.render('mathematics',{
            username:temp,
            posts:postsMath,
            empty:empty,
            myCourses:myCourses
        });
    });

    
    

//admin get
app.get('/admin',(req,res,next)=>{
    res.render('admin',{
        username:'admin'
    });
});

//home/adminmath get

app.get('/home/adminmath',(req,res,next)=>{
    res.render('adminmath',{
        username:'admin'

    });

});

//home/adminhistory get

app.get('/home/adminhistory',(req,res,next)=>{
    res.render('adminhistory',{
        username:'admin'
    });
});


//home/adminenglish get

app.get('/home/adminenglish',(req,res,next)=>{
    res.render('adminenglish',{
        username:'admin'
    });
});

app.listen(port,() => {
    console.log(`Listening on port ${port} ...`);
});