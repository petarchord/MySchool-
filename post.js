class Post
{
     constructor()
     {
     
     }
     
     set Topic(top)
     {
         this.topic=top;
     }
     get Topic()
     {
         return this.topic;
     }

     
     set Title(tit)
     {
         this.title=tit;
     }
     get Title()
     {
         return this.title;
     }
     
     set Lecture(lec)
     {
         this.lecture=lec;
     }
     get Lecture()
     {
         return this.lecture;
     }

    
}

module.exports.Post=Post;
/*
var post=new Post();
post.Topic='My topic';
post.Title='My title';
post.Lecture='My lecture';
console.log(post); */